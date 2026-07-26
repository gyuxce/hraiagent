import { NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/cv/extract-text";
import { screenCandidateWithAI } from "@/lib/ai/openrouter";
import {
  consumeAiQuota,
  quotaExceededMessage,
} from "@/lib/ai/usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(request: Request): boolean {
  const secret =
    process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function formatError(error: unknown): string {
  if (!error) return "Terjadi kesalahan";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  return "Terjadi kesalahan";
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let candidateIdForError = "";

  try {
    const body = (await request.json()) as {
      candidateId?: string;
      userId?: string | null;
    };
    const candidateId = String(body.candidateId || "").trim();
    candidateIdForError = candidateId;
    if (!candidateId) {
      return NextResponse.json(
        { error: "candidateId wajib" },
        { status: 400 }
      );
    }

    const db = createAdminClient();
    const { data: candidate, error: cErr } = await db
      .from("candidates")
      .select(
        "id, agency_id, cv_file_path, job_requisitions(title, description, requirements)"
      )
      .eq("id", candidateId)
      .single();

    if (cErr || !candidate) {
      return NextResponse.json(
        { error: "Kandidat tidak ditemukan" },
        { status: 404 }
      );
    }
    if (!candidate.cv_file_path) {
      await db
        .from("candidates")
        .update({ ai_summary: "AI screening gagal: CV tidak ada." })
        .eq("id", candidateId);
      return NextResponse.json({ error: "CV tidak ada" }, { status: 400 });
    }

    const jobRaw = candidate.job_requisitions as unknown;
    const job = Array.isArray(jobRaw) ? jobRaw[0] : jobRaw;
    const jobObj = job as {
      title?: string;
      description?: string;
      requirements?: string[];
    } | null;
    if (!jobObj?.title) {
      return NextResponse.json({ error: "Job tidak ada" }, { status: 400 });
    }

    const { data: fileData, error: dlErr } = await db.storage
      .from("cvs")
      .download(candidate.cv_file_path as string);
    if (dlErr || !fileData) {
      await db
        .from("candidates")
        .update({
          ai_summary:
            "AI screening gagal: tidak bisa download CV — " +
            (dlErr?.message || "unknown"),
        })
        .eq("id", candidateId);
      return NextResponse.json({ error: "Download CV gagal" }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const fileName =
      String(candidate.cv_file_path).split("/").pop() || "cv.pdf";
    const mime = fileName.match(/\.docx$/i)
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : fileName.match(/\.doc$/i)
        ? "application/msword"
        : fileName.match(/\.txt$/i)
          ? "text/plain"
          : "application/pdf";
    let cvText: string;
    try {
      cvText = await extractTextFromFile(buffer, mime, fileName);
    } catch (err) {
      await db
        .from("candidates")
        .update({ ai_summary: "AI screening gagal: " + formatError(err) })
        .eq("id", candidateId);
      return NextResponse.json({ error: formatError(err) }, { status: 500 });
    }

    const quota = await consumeAiQuota(db, {
      agencyId: String(candidate.agency_id),
      eventType: "cv_screen",
      userId: body.userId || null,
      resourceType: "candidate",
      resourceId: candidateId,
    });
    if (!quota.ok && !quota.soft) {
      const msg = quotaExceededMessage(quota);
      await db
        .from("candidates")
        .update({ ai_summary: msg })
        .eq("id", candidateId);
      return NextResponse.json({ error: msg }, { status: 429 });
    }

    const result = await screenCandidateWithAI({
      cvText,
      jobTitle: jobObj.title,
      jobDescription: jobObj.description || "",
      requirements: Array.isArray(jobObj.requirements)
        ? jobObj.requirements
        : [],
    });

    const { error: upErr } = await db
      .from("candidates")
      .update({
        ai_score: result.score,
        ai_summary: result.summary,
        ai_score_breakdown: result.breakdown,
        parsed_data: result.parsed,
        status: "screened",
        manual_score: null,
        manual_score_reason: null,
        manual_score_updated_at: null,
      })
      .eq("id", candidateId);

    if (upErr) {
      await db
        .from("candidates")
        .update({
          ai_summary: "AI screening gagal simpan skor: " + upErr.message,
        })
        .eq("id", candidateId);
      return NextResponse.json(
        { error: "Gagal simpan skor: " + upErr.message },
        { status: 500 }
      );
    }

    const { data: row } = await db
      .from("candidates")
      .select("name, email, phone")
      .eq("id", candidateId)
      .maybeSingle();

    if (row) {
      const patch: Record<string, string> = {};
      if ((!row.name || row.name === "Kandidat") && result.parsed.name) {
        patch.name = result.parsed.name;
      }
      if (!row.email && result.parsed.email) patch.email = result.parsed.email;
      if (!row.phone && result.parsed.phone) patch.phone = result.parsed.phone;
      if (Object.keys(patch).length) {
        await db.from("candidates").update(patch).eq("id", candidateId);
      }
    }

    revalidatePath("/candidates");
    revalidatePath(`/candidates/${candidateId}`);
    return NextResponse.json({
      ok: true,
      score: result.score,
      candidateId,
    });
  } catch (err) {
    const message = formatError(err);
    try {
      if (candidateIdForError && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const db = createAdminClient();
        await db
          .from("candidates")
          .update({ ai_summary: "AI screening gagal: " + message })
          .eq("id", candidateIdForError);
      }
    } catch {
      // ignore secondary failure
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

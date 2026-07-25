import { NextResponse } from "next/server";
import { purgeExpiredInterviewMedia } from "@/lib/interview/video-retention";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  // Vercel Cron sends this header when CRON_SECRET is configured
  const vercelCron = request.headers.get("x-vercel-cron");
  if (vercelCron === "1" && auth === `Bearer ${secret}`) return true;

  return false;
}

async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY belum di-set. Tambahkan di Vercel env lalu redeploy.",
      },
      { status: 500 }
    );
  }

  try {
    const result = await purgeExpiredInterviewMedia({ limit: 40 });
    return NextResponse.json({
      ok: true,
      ...result,
      at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Purge gagal";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

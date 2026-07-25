import { createAdminClient } from "@/lib/supabase/admin";

export const VIDEO_RETENTION_PRESETS = [0, 7, 14, 30, 60, 90, 180, 365] as const;

export type PurgeResult = {
  agenciesScanned: number;
  sessionsPurged: number;
  filesRemoved: number;
  skippedRetentionOff: number;
  errors: string[];
};

type SessionRow = {
  id: string;
  agency_id: string;
  selfie_path: string | null;
  face_frame_path: string | null;
  completed_at: string | null;
  expires_at: string | null;
  created_at: string;
};

type AnswerRow = {
  id: string;
  session_id: string;
  video_path: string | null;
};

function anchorDate(session: SessionRow): Date {
  const raw =
    session.completed_at || session.expires_at || session.created_at;
  return new Date(raw);
}

function isPastRetention(session: SessionRow, days: number, now: Date): boolean {
  if (days <= 0) return false;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return anchorDate(session) <= cutoff;
}

/**
 * Hapus file video/selfie/face-frame yang sudah melewati retensi agency.
 * Skor AI, transkrip, dan summary tetap dipertahankan.
 */
export async function purgeExpiredInterviewMedia(options?: {
  limit?: number;
  agencyId?: string;
}): Promise<PurgeResult> {
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 200);
  const admin = createAdminClient();
  const now = new Date();
  const result: PurgeResult = {
    agenciesScanned: 0,
    sessionsPurged: 0,
    filesRemoved: 0,
    skippedRetentionOff: 0,
    errors: [],
  };

  let agencyQuery = admin
    .from("agencies")
    .select("id, video_retention_days");

  if (options?.agencyId) {
    agencyQuery = agencyQuery.eq("id", options.agencyId);
  }

  const { data: agencies, error: agencyError } = await agencyQuery;
  if (agencyError) {
    result.errors.push(agencyError.message);
    return result;
  }

  const retentionByAgency = new Map<string, number>();
  for (const a of agencies || []) {
    const days =
      typeof a.video_retention_days === "number" ? a.video_retention_days : 30;
    retentionByAgency.set(String(a.id), days);
    if (days === 0) result.skippedRetentionOff += 1;
  }
  result.agenciesScanned = retentionByAgency.size;

  // Prefetch candidate sessions (media not yet purged)
  let sessionQuery = admin
    .from("async_interview_sessions")
    .select(
      "id, agency_id, selfie_path, face_frame_path, completed_at, expires_at, created_at"
    )
    .is("media_purged_at", null)
    .order("created_at", { ascending: true })
    .limit(Math.max(limit * 4, 80));

  if (options?.agencyId) {
    sessionQuery = sessionQuery.eq("agency_id", options.agencyId);
  }

  const { data: sessions, error: sessionError } = await sessionQuery;
  if (sessionError) {
    result.errors.push(sessionError.message);
    return result;
  }

  const due = (sessions || []).filter((s) => {
    const days = retentionByAgency.get(String(s.agency_id));
    if (days == null || days === 0) return false;
    return isPastRetention(s as SessionRow, days, now);
  }) as SessionRow[];

  const batch = due.slice(0, limit);
  if (batch.length === 0) return result;

  const sessionIds = batch.map((s) => s.id);
  const { data: answers, error: answersError } = await admin
    .from("async_interview_answers")
    .select("id, session_id, video_path")
    .in("session_id", sessionIds);

  if (answersError) {
    result.errors.push(answersError.message);
    return result;
  }

  const answersBySession = new Map<string, AnswerRow[]>();
  for (const a of (answers || []) as AnswerRow[]) {
    const list = answersBySession.get(a.session_id) || [];
    list.push(a);
    answersBySession.set(a.session_id, list);
  }

  for (const session of batch) {
    try {
      const paths = new Set<string>();
      if (session.selfie_path) paths.add(session.selfie_path);
      if (session.face_frame_path) paths.add(session.face_frame_path);

      const sessionAnswers = answersBySession.get(session.id) || [];
      for (const ans of sessionAnswers) {
        if (ans.video_path) paths.add(ans.video_path);
      }

      const pathList = Array.from(paths);
      if (pathList.length > 0) {
        const { error: removeError } = await admin.storage
          .from("interview-videos")
          .remove(pathList);
        if (removeError) {
          result.errors.push(
            `session ${session.id}: storage remove — ${removeError.message}`
          );
          // Continue clearing DB paths so we don't retry forever on missing files
        } else {
          result.filesRemoved += pathList.length;
        }
      }

      const answerIds = sessionAnswers
        .filter((a) => a.video_path)
        .map((a) => a.id);
      if (answerIds.length > 0) {
        const { error: clearAnswersError } = await admin
          .from("async_interview_answers")
          .update({ video_path: null })
          .in("id", answerIds);
        if (clearAnswersError) {
          result.errors.push(
            `session ${session.id}: clear answers — ${clearAnswersError.message}`
          );
          continue;
        }
      }

      const { error: clearSessionError } = await admin
        .from("async_interview_sessions")
        .update({
          selfie_path: null,
          face_frame_path: null,
          media_purged_at: now.toISOString(),
        })
        .eq("id", session.id);

      if (clearSessionError) {
        result.errors.push(
          `session ${session.id}: clear session — ${clearSessionError.message}`
        );
        continue;
      }

      result.sessionsPurged += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`session ${session.id}: ${msg}`);
    }
  }

  return result;
}

export function retentionLabel(days: number): string {
  if (days === 0) return "Tidak auto-hapus";
  return `${days} hari`;
}

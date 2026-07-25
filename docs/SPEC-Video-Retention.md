# Spec: Auto-hapus video interview setelah X hari

## Ringkasan

Media interview (video jawaban, selfie, face-frame) dihapus otomatis setelah **X hari** per agency. **Skor AI, transkrip, feedback, dan summary tetap disimpan** — video hanya bukti review manusia, bukan input skor.

## Mengapa

- Storage Supabase tumbuh cepat (video ~1–5 MB/jawaban × 5 soal).
- Privacy / kebijakan retensi data kandidat.
- Biaya bucket & signed URL yang tidak perlu untuk sesi lama.

## Apa yang dihapus

| Asset | Lokasi | Setelah purge |
|---|---|---|
| Video jawaban | `interview-videos` + `async_interview_answers.video_path` | File dihapus, path → `null` |
| Selfie | bucket + `async_interview_sessions.selfie_path` | File dihapus, path → `null` |
| Face frame | bucket + `face_frame_path` | File dihapus, path → `null` |

## Apa yang tetap

- `transcript`, `ai_score`, `ai_feedback`
- `overall_score`, `overall_summary`
- Status identitas (`face_match_status`, `challenge_passed`, `identity_summary`, dll.)
- Metadata sesi (`completed_at`, `created_at`, …)

## Konfigurasi

- Kolom `agencies.video_retention_days` (default **30**)
- Preset UI: `0` (off), `7`, `14`, `30`, `60`, `90`, `180`, `365`
- Hanya `admin_agency` yang boleh mengubah (halaman **Team**)

## Kapan dihitung “X hari”

Anchor = `completed_at` → else `expires_at` → else `created_at`.  
Purge jika `anchor + retention_days <= now` dan `media_purged_at IS NULL`.

## Job

- Endpoint: `GET|POST /api/cron/purge-interview-videos`
- Auth: `Authorization: Bearer $CRON_SECRET`
- Env: `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
- Schedule Vercel: harian `0 17 * * *` (≈ 00:00 WIB)
- Batch: max 40 sesi / run (aman untuk timeout)

## Setup ops

1. Jalankan `supabase/migrations/00012_video_retention.sql`
2. Set di Vercel:
   - `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → service_role)
   - `CRON_SECRET` (string acak kuat)
3. Redeploy (agar `vercel.json` cron aktif)
4. Opsional uji manual:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://your-app.vercel.app/api/cron/purge-interview-videos
   ```

## UX

- Team → kartu **Retensi video interview**
- Di detail kandidat: badge “Media dihapus (retensi)” bila `media_purged_at` terisi

## Non-goals (nanti)

- Hapus selektif “hanya non-shortlist”
- Export video sebelum purge
- Retensi per job / per klien
- Migrasi ke R2/S3

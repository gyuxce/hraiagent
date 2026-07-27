# Checklist Status & Polish — Cullr

Terakhir diaudit: Juli 2026. Centang = terverifikasi (typecheck + build + code review).

## ✅ Fondasi & Keamanan

- [x] Build production sukses, typecheck bersih (17 halaman)
- [x] RLS aktif semua tabel + isolasi `agency_id` + scope `client_id` (client_viewer)
- [x] Service role hanya di server (cron/background/STT) — tidak bocor ke browser
- [x] Public interview pakai token 24-byte hex + RPC SECURITY DEFINER
- [x] Video/selfie via signed URL 1 jam (bukan public URL)
- [x] Cron & internal API diverifikasi `CRON_SECRET`
- [x] Rate limiting endpoint publik interview (submit/upload/transcribe/consent/complete)
- [x] `.env.local` bersih & tidak ter-commit (`.env.local.bak` lama berisi key — **hapus sebelum commit/push**)
- [x] Consent eksplisit UU PDP + tercatat di DB (`00013_interview_consent.sql`) + halaman `/privacy`

## ✅ Fitur per Fase PRD

- [x] Fase 1: clients, jobs, CV parsing (PDF/DOCX), AI scoring + override, pipeline, multi-role auth, import CSV
- [x] Fase 2: interview notes + AI summary, compare kandidat
- [x] Fase 2.5: async video interview, AI questions, recorder, STT (browser + Whisper fallback), analisis, ranking
- [x] Fase 3: scheduling + email undangan (.ics + Add to Google/Outlook), dashboard multi-klien, reports + export CSV
- [x] Ekstra: AI usage metering, identity guards, video retention + cron, team invites, client portal
- [ ] Fase 2.6: Voice Interview (PRD ada, belum dibangun — **next**)
- [ ] Fase 4: Live conversational interview (jangka panjang, by design)

## ✅ Integrasi (env terverifikasi hidup)

- [x] Supabase (URL/anon/service role) — health 200
- [x] OpenRouter (`OPENROUTER_API_KEY`) — 200
- [x] Groq Whisper (`GROQ_API_KEY`) — 200
- [x] Resend (`RESEND_API_KEY`, sending access) — valid

## ✅ Desain "Executive Trust" (formal B2B)

- [x] Palet biru korporat #1F5FBF menggantikan coral; gradient atmosphere dibersihkan
- [x] Sidebar accent oren `#e16a40` → biru muda; amber/warning pakai token `--warn-soft`
- [x] Satu font (Plus Jakarta Sans), radius 0.5rem
- [x] Logo inline SVG + `public/brand/logo.svg` → biru
- [x] Landing page → Bahasa Indonesia + ikon Mail/WhatsApp + link Kebijakan Privasi
- [x] Email template → tombol & brand biru korporat

## 🔴 Sisa sebelum production (prioritas)

- [ ] **Hapus `.env.local.bak`** (berisi API key asli)
- [ ] **Aset raster masih tema lama**: `public/brand/logo-mark.png` & `og.png` (og:image tampil saat link dibagikan di WA/LinkedIn) — regenerate dengan tema biru
- [ ] **Domain email terverifikasi** di Resend + set `EMAIL_FROM` (sekarang hanya bisa kirim ke email pemilik akun Resend)
- [ ] **Uji akurasi Gemini 3 Flash** untuk screening CV asli B. Indonesia (20–30 sampel) — bandingkan skor vs penilaian manual
- [ ] Deploy + set env di Vercel → Redeploy → tes cron purge jalan

## 🟡 Polish nanti (tidak blocking)

- [ ] Rate limiter terdistribusi (Vercel WAF / Upstash) — sekarang in-memory per instance
- [ ] Error monitoring (Sentry)
- [ ] `hero.jpg` landing — ganti foto yang lebih korporat bila perlu
- [ ] `metadata`/`og` locale masih `en_US` di layout — ubah `id_ID`
- [ ] Lint: 2 warning pre-existing (`set-state-in-effect` di public-interview-client, unused `err`)
- [ ] Email domain di landing (`partnership@ilusa.id`) — sesuaikan dengan domain final
- [ ] Integrasi kalender penuh (auto-buat Google Meet link via OAuth) — sekarang one-click Add to Calendar + .ics

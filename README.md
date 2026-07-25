# RecruitAI — Platform Rekrutmen Berbasis AI

Agency/vendor recruitment platform (B2B2B) sesuai [PRD](./docs/PRD-Platform-Rekrutmen-AI.md).

## Stack

- **Next.js** (App Router)
- **Supabase** (Postgres + Auth + Storage + RLS)
- **OpenRouter** (AI screening / interview)
- **mammoth** (DOCX parsing) + **unpdf** (PDF)

## Fitur (status)

- **Fase 1:** Clients, Jobs, Candidates, CV parse (PDF/DOCX/TXT), AI scoring, pipeline, multi-role invite
- **Fase 2:** Interview notes + AI summary, compare kandidat
- **Fase 2.5:** Async AI interview + auto-analyze + ranking
- **Fase 3:** Schedule (in-app + .ics), dashboard multi-klien, reports CSV

## Setup

1. Install deps: `npm install`
2. Setup Supabase — lihat `supabase/README.md` (jalankan migration `00000`–`00008`)
3. Copy `.env.example` → `.env.local` dan isi key
4. `npm run dev` → http://localhost:3000

## Roles

| Role | Akses |
|---|---|
| `admin_agency` | Full + kelola Team |
| `recruiter` | Write clients/jobs/candidates/interview |
| `client_viewer` | Read-only, scoped ke satu client company |

Undang anggota via menu **Team** (admin).

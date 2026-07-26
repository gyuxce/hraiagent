# Cullr

**Cull the best. Hire faster.**

AI platform for recruiting agencies: CV screening, multi-client pipeline, async interviews, and client reporting.

Brand notes: [docs/BRAND-Cullr.md](./docs/BRAND-Cullr.md) · Product PRD: [docs/PRD-Platform-Rekrutmen-AI.md](./docs/PRD-Platform-Rekrutmen-AI.md)

## Stack

- Next.js 16 · React 19 · Tailwind 4
- Supabase (Postgres + Auth + Storage + RLS)
- OpenRouter (default Grok 4.5) · mammoth (DOCX) · unpdf (PDF)

## Setup

1. `npm install`
2. Jalankan migration Supabase `00000`–`00012` (lihat `supabase/README.md`)
3. Copy `.env.example` → `.env.local`
4. `npm run dev` → http://localhost:3000

## Roles

| Role | Akses |
|---|---|
| `admin_agency` | Full + Team |
| `recruiter` | Write data rekrutmen |
| `client_viewer` | Portal klien read-only |

# Saring

**Saring kandidat terbaik — lebih cepat.**

Platform AI untuk agency/vendor rekrutmen (B2B2B): screening CV, pipeline multi-klien, interview async, dan reporting ke client.

PRD: [docs/PRD-Platform-Rekrutmen-AI.md](./docs/PRD-Platform-Rekrutmen-AI.md)

## Stack

- Next.js 16 · React 19 · Tailwind 4
- Supabase (Postgres + Auth + Storage + RLS)
- OpenRouter (default DeepSeek) · mammoth (DOCX) · unpdf (PDF)

## Setup

1. `npm install`
2. Jalankan migration Supabase `00000`–`00009` (lihat `supabase/README.md`)
3. Copy `.env.example` → `.env.local`
4. `npm run dev` → http://localhost:3000

## Roles

| Role | Akses |
|---|---|
| `admin_agency` | Full + Team |
| `recruiter` | Write data rekrutmen |
| `client_viewer` | Portal klien read-only |

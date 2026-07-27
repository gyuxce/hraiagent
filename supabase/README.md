# Database Setup Instructions

## Quick Start (Recommended)

Run migrations **in order** in the Supabase SQL Editor:

1. `00000_complete_setup.sql` — schema inti + RLS
2. `00001_fix_auth_trigger.sql` — jika signup gagal
3. `00002_fix_agencies_rls.sql` — RPC create agency (wajib untuk register)
4. `00003_fix_orphan_users.sql` — recovery user orphan
5. `00004_storage_cvs.sql` — bucket CV
6. `00005_interview_notes.sql` — Fase 2
7. `00006_async_interview.sql` — Fase 2.5
8. `00007_team_invites_client_scope.sql` — multi-role invite + client_viewer scope + auto-analyze RPC
9. `00008_interview_schedules.sql` — Fase 3 scheduling
10. `00009_score_breakdown_override.sql` — AI rubric breakdown + manual score override
11. `00010_ai_usage_metering.sql` — kuota AI per agency
12. `00011_interview_identity_guards.sql` — selfie / challenge / face match
13. `00012_video_retention.sql` — retensi auto-hapus video interview
14. `00013_interview_consent.sql` — persetujuan eksplisit kandidat (UU PDP)

### Steps:

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In your project dashboard, go to **SQL Editor**
3. Run each migration file above in order
4. If register/login fails, re-check `00001` / `00002`

---

## After Setup

1. Go to **Authentication > Sign In / Providers > Email**
   - Enable "Allow new users to sign up"
   - **Disable "Confirm email"** (for local dev)
2. Copy your project URL and anon key from **Settings > API**
3. Create `.env.local` from `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENROUTER_API_KEY=your-openrouter-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-random-cron-secret
```

Lihat juga `docs/SPEC-Video-Retention.md` untuk auto-hapus video setelah X hari.

4. Run the dev server:

```bash
npm run dev
```

---

## Schema Overview

```
Agency
 └── Client Company
      └── Job Requisition
           └── Candidate
                ├── AI Screening Result
                ├── Interview Note
                ├── Async Interview Session
                └── Interview Schedule
User (role + agency_id [+ client_id for client_viewer])
Team Invite (pending join links)
```

### Enums

- `user_role`: admin_agency, recruiter, client_viewer
- `job_status`: open, closed, on_hold
- `candidate_status`: submitted, screened, interview, offer, hired, rejected
- `async_interview_status`: draft, sent, in_progress, completed, expired
- `interview_schedule_status`: scheduled, completed, cancelled, no_show

### Multi-Tenant Isolation

All tables have Row Level Security (RLS) enabled via `agency_id`.
`client_viewer` is further scoped to a single `client_id`.

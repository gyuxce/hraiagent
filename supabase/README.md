# Database Setup Instructions

## Quick Start (Recommended)

1. Run `00000_complete_setup.sql` in **Supabase SQL Editor** (first time only)
2. Run `00001_fix_auth_trigger.sql` if signup fails with "Database error saving new user"

### Steps:

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In your project dashboard, go to **SQL Editor**
3. Copy the entire contents of `00000_complete_setup.sql`
4. Paste into SQL Editor and click **Run**
5. If register/login fails, also run `00001_fix_auth_trigger.sql`

---

## After Setup

1. Go to **Authentication > Sign In / Providers > Email**
   - Enable "Allow new users to sign up"
   - **Disable "Confirm email"** (for local dev)
2. Go to **Storage** and create a bucket named `cvs` for CV file uploads
3. Copy your project URL and anon key from **Settings > API**
4. Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

5. Run the dev server:

```bash
npm run dev
```

---

## Schema Overview

```
agencies (1) ──── (many) client_companies
agencies (1) ──── (many) job_requisitions
client_companies (1) ──── (many) job_requisitions
job_requisitions (1) ──── (many) candidates
auth.users (1) ──── (1) users
```

### Enums

- `user_role`: admin_agency, recruiter, client_viewer
- `job_status`: open, closed, on_hold
- `candidate_status`: submitted, screened, interview, offer, hired, rejected

### Multi-Tenant Isolation

All tables have Row Level Security (RLS) enabled. Users can only access data belonging to their agency via `agency_id` check.

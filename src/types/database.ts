export type UserRole = "admin_agency" | "recruiter" | "client_viewer";

export interface Agency {
  id: string;
  name: string;
  created_at: string;
}

export interface ClientCompany {
  id: string;
  agency_id: string;
  name: string;
  industry: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}

export type JobStatus = "open" | "closed" | "on_hold";

export interface JobRequisition {
  id: string;
  client_id: string;
  agency_id: string;
  title: string;
  description: string;
  requirements: string[];
  status: JobStatus;
  created_at: string;
}

export interface Candidate {
  id: string;
  job_id: string;
  name: string;
  email: string;
  phone: string | null;
  cv_file_path: string | null;
  parsed_data: Record<string, unknown> | null;
  ai_score: number | null;
  ai_summary: string | null;
  status:
    | "submitted"
    | "screened"
    | "interview"
    | "offer"
    | "hired"
    | "rejected";
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  agency_id: string;
  client_id: string | null;
  full_name: string;
  created_at: string;
}

export interface TeamInvite {
  id: string;
  agency_id: string;
  email: string;
  role: UserRole;
  client_id: string | null;
  token: string;
  invited_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export type InterviewScheduleStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "no_show";

export interface InterviewSchedule {
  id: string;
  agency_id: string;
  candidate_id: string;
  job_id: string;
  client_id: string | null;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  meeting_url: string | null;
  notes: string | null;
  status: InterviewScheduleStatus;
  created_by: string | null;
  created_at: string;
}

export interface InterviewNote {
  id: string;
  agency_id: string;
  candidate_id: string;
  created_by: string | null;
  title: string;
  transcript: string;
  ai_summary: string | null;
  interviewer_notes: string | null;
  conducted_at: string;
  created_at: string;
}

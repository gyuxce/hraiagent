-- 00014: Conversational interview — AI berbicara (TTS), follow-up otomatis,
-- kandidat tetap direkam video per jawaban. Satu fitur interview, engine baru.
-- Sesi lama (statis) tidak terpengaruh: conversational default false.

ALTER TABLE async_interview_sessions
  ADD COLUMN IF NOT EXISTS conversational BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS strict_identity BOOLEAN NOT NULL DEFAULT false;

-- Turn-by-turn log percakapan (greeting, pertanyaan, follow-up, jawaban, closing)
CREATE TABLE IF NOT EXISTS async_interview_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES async_interview_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES async_interview_questions(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ai', 'candidate')),
  kind TEXT NOT NULL CHECK (kind IN ('greeting', 'question', 'follow_up', 'challenge', 'closing', 'answer')),
  text TEXT,
  video_path TEXT,
  tts_path TEXT,
  decision TEXT CHECK (decision IS NULL OR decision IN ('follow_up', 'next', 'end')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_async_turns_session ON async_interview_turns(session_id, turn_index);

ALTER TABLE async_interview_turns ENABLE ROW LEVEL SECURITY;

-- Recruiter/admin agency bisa baca turn sesi milik agency-nya.
-- Tulis dilakukan server-side (service role) — tidak ada policy insert untuk anon.
CREATE POLICY async_turns_select_agency ON async_interview_turns
  FOR SELECT USING (agency_id = get_user_agency_id());

-- Event quota baru untuk turn conversational (LLM per turn) & TTS
ALTER TABLE ai_usage_events DROP CONSTRAINT IF EXISTS ai_usage_events_event_type_check;
ALTER TABLE ai_usage_events ADD CONSTRAINT ai_usage_events_event_type_check
  CHECK (event_type IN (
    'cv_screen',
    'interview_summary',
    'async_question_gen',
    'async_analyze',
    'interview_turn',
    'interview_tts'
  ));

-- Migration 002: durable job queue foundation for agent drafts and scheduled publishing.
CREATE TABLE IF NOT EXISTS botverse_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL DEFAULT 'default',
  kind VARCHAR(30) NOT NULL CHECK (kind IN ('agent_draft', 'publish')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error VARCHAR(1000) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS botverse_jobs_workspace_schedule_idx
  ON botverse_jobs (workspace_id, status, scheduled_at NULLS FIRST, created_at);

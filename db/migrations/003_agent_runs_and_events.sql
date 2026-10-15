-- Migration 003: auditable agent run records and append-only workflow events.
CREATE TABLE IF NOT EXISTS botverse_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL DEFAULT 'default',
  agent_id VARCHAR(30) NOT NULL CHECK (agent_id IN ('orbit','pixel','echo','byte','scout')),
  task_id UUID REFERENCES botverse_tasks(id) ON DELETE SET NULL,
  job_id UUID REFERENCES botverse_jobs(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','needs_review','completed','failed','cancelled')),
  attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  error_code VARCHAR(80) NOT NULL DEFAULT '',
  artifact JSONB,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS botverse_agent_runs_workspace_created_idx
  ON botverse_agent_runs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS botverse_agent_runs_workspace_status_idx
  ON botverse_agent_runs (workspace_id, status);

CREATE TABLE IF NOT EXISTS botverse_workflow_events (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  task_id UUID REFERENCES botverse_tasks(id) ON DELETE SET NULL,
  run_id UUID REFERENCES botverse_agent_runs(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  from_state VARCHAR(30) NOT NULL DEFAULT '',
  to_state VARCHAR(30) NOT NULL DEFAULT '',
  message VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS botverse_workflow_events_workspace_created_idx
  ON botverse_workflow_events (workspace_id, created_at DESC);

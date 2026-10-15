-- BOTVERSE Creator OS schema v1
-- Run against the chosen PostgreSQL database before starting the API.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS botverse_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL DEFAULT 'default',
  name VARCHAR(100) NOT NULL,
  goal TEXT NOT NULL DEFAULT '',
  channel VARCHAR(40) NOT NULL DEFAULT 'YouTube',
  status VARCHAR(30) NOT NULL DEFAULT 'Planning',
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS botverse_projects_workspace_updated_idx
  ON botverse_projects (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS botverse_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL DEFAULT 'default',
  title VARCHAR(180) NOT NULL,
  agent VARCHAR(30) NOT NULL DEFAULT 'orbit',
  channel VARCHAR(40) NOT NULL DEFAULT 'TikTok',
  status VARCHAR(30) NOT NULL DEFAULT 'Idea',
  priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
  due_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  project_id UUID REFERENCES botverse_projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS botverse_tasks_workspace_due_idx
  ON botverse_tasks (workspace_id, due_date);
CREATE INDEX IF NOT EXISTS botverse_tasks_workspace_status_idx
  ON botverse_tasks (workspace_id, status);

CREATE TABLE IF NOT EXISTS botverse_activity (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  message VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS botverse_activity_workspace_created_idx
  ON botverse_activity (workspace_id, created_at DESC);

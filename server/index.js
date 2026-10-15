import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';

const { Pool } = pg;
const PORT = Number(process.env.PORT || 3000);
const API_TOKEN = process.env.BOTVERSE_API_TOKEN || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (API_TOKEN.length < 32) throw new Error('BOTVERSE_API_TOKEN must be at least 32 characters.');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: true },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id'],
  maxAge: 600,
}));
app.use(express.json({ limit: '256kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));

function sendError(res, status, message) {
  return res.status(status).json({ error: { message } });
}
function requireAuth(req, res, next) {
  const value = req.get('authorization') || '';
  const token = value.startsWith('Bearer ') ? value.slice(7) : '';
  const a = Buffer.from(token);
  const b = Buffer.from(API_TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return sendError(res, 401, 'Valid Bearer token required.');
  }
  const workspaceId = req.get('x-workspace-id') || 'default';
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(workspaceId)) {
    return sendError(res, 400, 'X-Workspace-Id may contain only letters, numbers, underscores, and hyphens (max 64).');
  }
  req.workspaceId = workspaceId;
  return next();
}
const AGENTS = new Set(['orbit', 'pixel', 'echo', 'byte', 'scout']);
const STATUSES = new Set(['Idea', 'Scripting', 'Editing', 'Blocked', 'Ready', 'Scheduled', 'Published']);
const PRIORITIES = new Set(['Low', 'Medium', 'High']);
const CHANNELS = new Set(['TikTok', 'YouTube', 'Facebook', 'Instagram', 'Editing', 'Research', 'General', 'Cross-platform']);
const PROJECT_STATUSES = new Set(['Planning', 'Active', 'Paused', 'Completed']);
const isText = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
const isOptionalText = (v, max) => v === undefined || v === null || (typeof v === 'string' && v.length <= max);
const isDate = (v) => v === undefined || v === null || v === '' || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)));
const asDate = (v) => v ? v : null;
async function activity(workspaceId, message) {
  await pool.query('INSERT INTO botverse_activity (workspace_id, message) VALUES ($1, $2)', [workspaceId, message.slice(0, 500)]);
}
function mapTask(row) {
  return { id: row.id, title: row.title, agent: row.agent, channel: row.channel, status: row.status, priority: row.priority, due: row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : '', notes: row.notes, projectId: row.project_id, created: row.created_at, updated: row.updated_at };
}
function mapProject(row) {
  return { id: row.id, name: row.name, goal: row.goal, channel: row.channel, status: row.status, due: row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : '', created: row.created_at, updated: row.updated_at };
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'botverse-creator-api', database: 'connected', version: '0.1.0' });
  } catch {
    sendError(res, 503, 'API is running but database is unavailable.');
  }
});
app.use('/api', requireAuth);

const AGENT_GUIDES = {
  orbit: 'You are ORBIT, the studio lead. Break goals into clear, prioritized next steps and identify dependencies.',
  pixel: 'You are PIXEL, a video editor. Help with editing briefs, pacing, captions, audio, shot lists, and visual polish.',
  echo: 'You are ECHO, a social manager. Draft platform-aware captions, calls to action, publishing checklists, and schedules.',
  byte: 'You are BYTE, a script and tools specialist. Help with scripts, workflow templates, code, and safe automation.',
  scout: 'You are SCOUT, a trend researcher. Suggest research questions, content angles, and validation steps. Do not invent live trend data.'
};
app.post('/api/agents/run', async (req, res) => {
  const b = req.body || {};
  const agent = typeof b.agent === 'string' ? b.agent : 'orbit';
  const prompt = typeof b.prompt === 'string' ? b.prompt.trim() : '';
  if (!AGENT_GUIDES[agent]) return sendError(res, 400, 'Unknown agent.');
  if (!isText(prompt, 4000)) return sendError(res, 400, 'prompt is required (max 4000 characters).');
  const aiKey = process.env.AI_API_KEY || '';
  if (!aiKey) return sendError(res, 503, 'AI provider is not configured on the server yet. Set AI_API_KEY in the backend host environment.');
  const endpoint = process.env.AI_BASE_URL || 'https://api.openai.com/v1/chat/completions';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  let endpointUrl;
  try { endpointUrl = new URL(endpoint); } catch { return sendError(res, 500, 'AI_BASE_URL is invalid.'); }
  if (endpointUrl.protocol !== 'https:' && endpointUrl.hostname !== 'localhost' && endpointUrl.hostname !== '127.0.0.1') {
    return sendError(res, 500, 'AI_BASE_URL must use HTTPS.');
  }
  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + aiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: AGENT_GUIDES[agent] + ' Be practical, concise, transparent about uncertainty, and return a useful draft or plan. You cannot publish content, access accounts, or execute external actions. Never claim that you did.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 900
      }),
      signal: AbortSignal.timeout(30000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('AI provider returned HTTP ' + response.status);
      return sendError(res, response.status === 429 ? 429 : 502, response.status === 429 ? 'AI provider rate limit reached. Try again later.' : 'AI provider request failed. Check the server-side AI configuration.');
    }
    const answer = payload?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) return sendError(res, 502, 'AI provider returned an empty response.');
    res.json({ data: { agent, model, answer: answer.trim(), generatedAt: new Date().toISOString() } });
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return sendError(res, timedOut ? 504 : 502, timedOut ? 'AI request timed out. Try again.' : 'Could not reach the AI provider.');
  }
});

app.get('/api/tasks', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
    const result = await pool.query('SELECT * FROM botverse_tasks WHERE workspace_id = $1 ORDER BY due_date NULLS LAST, created_at DESC LIMIT $2', [req.workspaceId, limit]);
    res.json({ data: result.rows.map(mapTask) });
  } catch (err) { next(err); }
});
app.post('/api/tasks', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!isText(b.title, 180)) return sendError(res, 400, 'title is required (max 180 characters).');
    if (b.agent !== undefined && !AGENTS.has(b.agent)) return sendError(res, 400, 'Unknown agent.');
    if (b.status !== undefined && !STATUSES.has(b.status)) return sendError(res, 400, 'Unknown task status.');
    if (b.priority !== undefined && !PRIORITIES.has(b.priority)) return sendError(res, 400, 'Unknown priority.');
    if (b.channel !== undefined && !CHANNELS.has(b.channel)) return sendError(res, 400, 'Unknown channel.');
    if (!isDate(b.due)) return sendError(res, 400, 'due must be YYYY-MM-DD.');
    if (!isOptionalText(b.notes, 10000)) return sendError(res, 400, 'notes must be at most 10000 characters.');
    const projectId = b.projectId || null;
    if (projectId) {
      const p = await pool.query('SELECT id FROM botverse_projects WHERE id = $1 AND workspace_id = $2', [projectId, req.workspaceId]);
      if (!p.rowCount) return sendError(res, 400, 'Project not found in this workspace.');
    }
    const result = await pool.query(
      'INSERT INTO botverse_tasks (workspace_id,title,agent,channel,status,priority,due_date,notes,project_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [req.workspaceId, b.title.trim(), b.agent || 'orbit', b.channel || 'TikTok', b.status || 'Idea', b.priority || 'Medium', asDate(b.due), (b.notes || '').trim(), projectId],
    );
    await activity(req.workspaceId, 'Created task: ' + b.title.trim());
    res.status(201).json({ data: mapTask(result.rows[0]) });
  } catch (err) { next(err); }
});
app.patch('/api/tasks/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const fields = [];
    const values = [];
    const add = (column, value) => { values.push(value); fields.push(column + ' = $' + values.length); };
    if (b.title !== undefined) { if (!isText(b.title, 180)) return sendError(res, 400, 'Invalid title.'); add('title', b.title.trim()); }
    if (b.agent !== undefined) { if (!AGENTS.has(b.agent)) return sendError(res, 400, 'Unknown agent.'); add('agent', b.agent); }
    if (b.channel !== undefined) { if (!CHANNELS.has(b.channel)) return sendError(res, 400, 'Unknown channel.'); add('channel', b.channel); }
    if (b.status !== undefined) { if (!STATUSES.has(b.status)) return sendError(res, 400, 'Unknown status.'); add('status', b.status); }
    if (b.priority !== undefined) { if (!PRIORITIES.has(b.priority)) return sendError(res, 400, 'Unknown priority.'); add('priority', b.priority); }
    if (b.due !== undefined) { if (!isDate(b.due)) return sendError(res, 400, 'Invalid due date.'); add('due_date', asDate(b.due)); }
    if (b.notes !== undefined) { if (!isOptionalText(b.notes, 10000)) return sendError(res, 400, 'Invalid notes.'); add('notes', b.notes || ''); }
    if (b.projectId !== undefined) {
      if (b.projectId) {
        const p = await pool.query('SELECT id FROM botverse_projects WHERE id = $1 AND workspace_id = $2', [b.projectId, req.workspaceId]);
        if (!p.rowCount) return sendError(res, 400, 'Project not found in this workspace.');
      }
      add('project_id', b.projectId || null);
    }
    if (!fields.length) return sendError(res, 400, 'No editable fields supplied.');
    const previous = b.status !== undefined ? await pool.query('SELECT id, status, title FROM botverse_tasks WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]) : null;
    if (previous && !previous.rowCount) return sendError(res, 404, 'Task not found.');
    values.push(req.params.id, req.workspaceId);
    const result = await pool.query('UPDATE botverse_tasks SET ' + fields.join(', ') + ', updated_at = NOW() WHERE id = 
    res.json({ data: mapTask(result.rows[0]) });
  } catch (err) { next(err); }
});
app.delete('/api/tasks/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM botverse_tasks WHERE id = $1 AND workspace_id = $2 RETURNING title', [req.params.id, req.workspaceId]);
    if (!result.rowCount) return sendError(res, 404, 'Task not found.');
    await activity(req.workspaceId, 'Deleted task: ' + result.rows[0].title);
    res.status(204).end();
  } catch (err) { next(err); }
});

app.get('/api/projects', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM botverse_projects WHERE workspace_id = $1 ORDER BY updated_at DESC', [req.workspaceId]);
    res.json({ data: result.rows.map(mapProject) });
  } catch (err) { next(err); }
});
app.post('/api/projects', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!isText(b.name, 100)) return sendError(res, 400, 'name is required (max 100 characters).');
    if (!isOptionalText(b.goal, 10000)) return sendError(res, 400, 'goal must be at most 10000 characters.');
    if (b.channel !== undefined && !CHANNELS.has(b.channel)) return sendError(res, 400, 'Unknown channel.');
    if (b.status !== undefined && !PROJECT_STATUSES.has(b.status)) return sendError(res, 400, 'Unknown project status.');
    if (!isDate(b.due)) return sendError(res, 400, 'due must be YYYY-MM-DD.');
    const result = await pool.query('INSERT INTO botverse_projects (workspace_id,name,goal,channel,status,due_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [req.workspaceId, b.name.trim(), (b.goal || '').trim(), b.channel || 'YouTube', b.status || 'Planning', asDate(b.due)]);
    await activity(req.workspaceId, 'Created project: ' + b.name.trim());
    res.status(201).json({ data: mapProject(result.rows[0]) });
  } catch (err) { next(err); }
});
app.patch('/api/projects/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const fields = [], values = [];
    const add = (column, value) => { values.push(value); fields.push(column + ' = $' + values.length); };
    if (b.name !== undefined) { if (!isText(b.name, 100)) return sendError(res, 400, 'Invalid name.'); add('name', b.name.trim()); }
    if (b.goal !== undefined) { if (!isOptionalText(b.goal, 10000)) return sendError(res, 400, 'Invalid goal.'); add('goal', b.goal || ''); }
    if (b.channel !== undefined) { if (!CHANNELS.has(b.channel)) return sendError(res, 400, 'Unknown channel.'); add('channel', b.channel); }
    if (b.status !== undefined) { if (!PROJECT_STATUSES.has(b.status)) return sendError(res, 400, 'Unknown status.'); add('status', b.status); }
    if (b.due !== undefined) { if (!isDate(b.due)) return sendError(res, 400, 'Invalid due date.'); add('due_date', asDate(b.due)); }
    if (!fields.length) return sendError(res, 400, 'No editable fields supplied.');
    values.push(req.params.id, req.workspaceId);
    const result = await pool.query('UPDATE botverse_projects SET ' + fields.join(', ') + ', updated_at = NOW() WHERE id = $' + (values.length - 1) + ' AND workspace_id = $' + values.length + ' RETURNING *', values);
    if (!result.rowCount) return sendError(res, 404, 'Project not found.');
    await activity(req.workspaceId, 'Updated project: ' + result.rows[0].name);
    res.json({ data: mapProject(result.rows[0]) });
  } catch (err) { next(err); }
});
app.delete('/api/projects/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM botverse_projects WHERE id = $1 AND workspace_id = $2 RETURNING name', [req.params.id, req.workspaceId]);
    if (!result.rowCount) return sendError(res, 404, 'Project not found.');
    await activity(req.workspaceId, 'Deleted project: ' + result.rows[0].name);
    res.status(204).end();
  } catch (err) { next(err); }
});
function mapJob(row) {
  return { id: row.id, kind: row.kind, payload: row.payload, status: row.status, scheduledAt: row.scheduled_at, attempts: row.attempts, lastError: row.last_error, created: row.created_at, updated: row.updated_at };
}
app.get('/api/jobs', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
    const result = await pool.query('SELECT * FROM botverse_jobs WHERE workspace_id = $1 ORDER BY scheduled_at NULLS FIRST, created_at DESC LIMIT $2', [req.workspaceId, limit]);
    res.json({ data: result.rows.map(mapJob) });
  } catch (err) { next(err); }
});
app.post('/api/jobs', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!['agent_draft', 'publish'].includes(b.kind)) return sendError(res, 400, 'kind must be agent_draft or publish.');
    if (!b.payload || typeof b.payload !== 'object' || Array.isArray(b.payload)) return sendError(res, 400, 'payload must be a JSON object.');
    if (JSON.stringify(b.payload).length > 10000) return sendError(res, 400, 'payload must be at most 10000 characters.');
    if (b.scheduledAt !== undefined && b.scheduledAt !== null && b.scheduledAt !== '' && (typeof b.scheduledAt !== 'string' || Number.isNaN(Date.parse(b.scheduledAt)))) return sendError(res, 400, 'scheduledAt must be a valid ISO date/time.');
    if (b.kind === 'publish' && (!isText(b.payload.channel, 40) || !isText(b.payload.content, 1_000_000))) return sendError(res, 400, 'publish jobs require payload.channel and payload.content.');
    const result = await pool.query(
      'INSERT INTO botverse_jobs (workspace_id, kind, payload, scheduled_at) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.workspaceId, b.kind, JSON.stringify(b.payload), b.scheduledAt || null],
    );
    await activity(req.workspaceId, 'Queued ' + b.kind + ' job');
    res.status(201).json({ data: mapJob(result.rows[0]) });
  } catch (err) { next(err); }
});
app.patch('/api/jobs/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!['queued', 'cancelled'].includes(b.status)) return sendError(res, 400, 'Only queued or cancelled status can be set through this endpoint.');
    const result = await pool.query(
      "UPDATE botverse_jobs SET status = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 AND status IN ('queued','failed') RETURNING *",
      [b.status, req.params.id, req.workspaceId],
    );
    if (!result.rowCount) return sendError(res, 404, 'Queued job not found or cannot be changed.');
    await activity(req.workspaceId, 'Updated queued job: ' + result.rows[0].kind + ' → ' + b.status);
    res.json({ data: mapJob(result.rows[0]) });
  } catch (err) { next(err); }
});
app.delete('/api/jobs/:id', async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM botverse_jobs WHERE id = $1 AND workspace_id = $2 AND status IN ('queued','cancelled','failed') RETURNING id", [req.params.id, req.workspaceId]);
    if (!result.rowCount) return sendError(res, 404, 'Job not found or already running.');
    res.status(204).end();
  } catch (err) { next(err); }
});

app.get('/api/integrations/status', async (_req, res) => {
  // Status-only discovery: credentials are never returned to the browser.
  const platforms = [
    { id: 'youtube', name: 'YouTube', configured: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REDIRECT_URI) },
    { id: 'tiktok', name: 'TikTok', configured: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_REDIRECT_URI) },
    { id: 'facebook', name: 'Facebook', configured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_REDIRECT_URI) },
    { id: 'instagram', name: 'Instagram', configured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_REDIRECT_URI) }
  ].map(platform => ({ ...platform, connected: false, publishEnabled: false, note: 'OAuth callback, granted scopes, account selection, and token storage are not implemented yet.' }));
  res.json({ data: { platforms, livePublishingEnabled: false } });
});

app.get('/api/workflow/events', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
    const result = await pool.query('SELECT id, task_id, run_id, event_type, from_state, to_state, message, created_at FROM botverse_workflow_events WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2', [req.workspaceId, limit]);
    res.json({ data: result.rows.map(row => ({ id: row.id, taskId: row.task_id, runId: row.run_id, type: row.event_type, from: row.from_state, to: row.to_state, message: row.message, time: row.created_at })) });
  } catch (err) { next(err); }
});

app.get('/api/activity', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, message, created_at FROM botverse_activity WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100', [req.workspaceId]);
    res.json({ data: result.rows.map((r) => ({ id: r.id, text: r.message, time: r.created_at })) });
  } catch (err) { next(err); }
});

app.use((req, res) => sendError(res, 404, 'Route not found.'));
app.use((err, _req, res, _next) => {
  if (err.message === 'Origin is not allowed by CORS.') return sendError(res, 403, err.message);
  console.error('BOTVERSE API error:', err.message);
  return sendError(res, 500, 'Internal server error.');
});

const server = app.listen(PORT, () => console.log('BOTVERSE Creator API listening on port ' + PORT));
async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
 + (values.length - 1) + ' AND workspace_id = 
    res.json({ data: mapTask(result.rows[0]) });
  } catch (err) { next(err); }
});
app.delete('/api/tasks/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM botverse_tasks WHERE id = $1 AND workspace_id = $2 RETURNING title', [req.params.id, req.workspaceId]);
    if (!result.rowCount) return sendError(res, 404, 'Task not found.');
    await activity(req.workspaceId, 'Deleted task: ' + result.rows[0].title);
    res.status(204).end();
  } catch (err) { next(err); }
});

app.get('/api/projects', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM botverse_projects WHERE workspace_id = $1 ORDER BY updated_at DESC', [req.workspaceId]);
    res.json({ data: result.rows.map(mapProject) });
  } catch (err) { next(err); }
});
app.post('/api/projects', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!isText(b.name, 100)) return sendError(res, 400, 'name is required (max 100 characters).');
    if (!isOptionalText(b.goal, 10000)) return sendError(res, 400, 'goal must be at most 10000 characters.');
    if (b.channel !== undefined && !CHANNELS.has(b.channel)) return sendError(res, 400, 'Unknown channel.');
    if (b.status !== undefined && !PROJECT_STATUSES.has(b.status)) return sendError(res, 400, 'Unknown project status.');
    if (!isDate(b.due)) return sendError(res, 400, 'due must be YYYY-MM-DD.');
    const result = await pool.query('INSERT INTO botverse_projects (workspace_id,name,goal,channel,status,due_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [req.workspaceId, b.name.trim(), (b.goal || '').trim(), b.channel || 'YouTube', b.status || 'Planning', asDate(b.due)]);
    await activity(req.workspaceId, 'Created project: ' + b.name.trim());
    res.status(201).json({ data: mapProject(result.rows[0]) });
  } catch (err) { next(err); }
});
app.patch('/api/projects/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const fields = [], values = [];
    const add = (column, value) => { values.push(value); fields.push(column + ' = $' + values.length); };
    if (b.name !== undefined) { if (!isText(b.name, 100)) return sendError(res, 400, 'Invalid name.'); add('name', b.name.trim()); }
    if (b.goal !== undefined) { if (!isOptionalText(b.goal, 10000)) return sendError(res, 400, 'Invalid goal.'); add('goal', b.goal || ''); }
    if (b.channel !== undefined) { if (!CHANNELS.has(b.channel)) return sendError(res, 400, 'Unknown channel.'); add('channel', b.channel); }
    if (b.status !== undefined) { if (!PROJECT_STATUSES.has(b.status)) return sendError(res, 400, 'Unknown status.'); add('status', b.status); }
    if (b.due !== undefined) { if (!isDate(b.due)) return sendError(res, 400, 'Invalid due date.'); add('due_date', asDate(b.due)); }
    if (!fields.length) return sendError(res, 400, 'No editable fields supplied.');
    values.push(req.params.id, req.workspaceId);
    const result = await pool.query('UPDATE botverse_projects SET ' + fields.join(', ') + ', updated_at = NOW() WHERE id = $' + (values.length - 1) + ' AND workspace_id = $' + values.length + ' RETURNING *', values);
    if (!result.rowCount) return sendError(res, 404, 'Project not found.');
    await activity(req.workspaceId, 'Updated project: ' + result.rows[0].name);
    res.json({ data: mapProject(result.rows[0]) });
  } catch (err) { next(err); }
});
app.delete('/api/projects/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM botverse_projects WHERE id = $1 AND workspace_id = $2 RETURNING name', [req.params.id, req.workspaceId]);
    if (!result.rowCount) return sendError(res, 404, 'Project not found.');
    await activity(req.workspaceId, 'Deleted project: ' + result.rows[0].name);
    res.status(204).end();
  } catch (err) { next(err); }
});
function mapJob(row) {
  return { id: row.id, kind: row.kind, payload: row.payload, status: row.status, scheduledAt: row.scheduled_at, attempts: row.attempts, lastError: row.last_error, created: row.created_at, updated: row.updated_at };
}
app.get('/api/jobs', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
    const result = await pool.query('SELECT * FROM botverse_jobs WHERE workspace_id = $1 ORDER BY scheduled_at NULLS FIRST, created_at DESC LIMIT $2', [req.workspaceId, limit]);
    res.json({ data: result.rows.map(mapJob) });
  } catch (err) { next(err); }
});
app.post('/api/jobs', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!['agent_draft', 'publish'].includes(b.kind)) return sendError(res, 400, 'kind must be agent_draft or publish.');
    if (!b.payload || typeof b.payload !== 'object' || Array.isArray(b.payload)) return sendError(res, 400, 'payload must be a JSON object.');
    if (JSON.stringify(b.payload).length > 10000) return sendError(res, 400, 'payload must be at most 10000 characters.');
    if (b.scheduledAt !== undefined && b.scheduledAt !== null && b.scheduledAt !== '' && (typeof b.scheduledAt !== 'string' || Number.isNaN(Date.parse(b.scheduledAt)))) return sendError(res, 400, 'scheduledAt must be a valid ISO date/time.');
    if (b.kind === 'publish' && (!isText(b.payload.channel, 40) || !isText(b.payload.content, 1_000_000))) return sendError(res, 400, 'publish jobs require payload.channel and payload.content.');
    const result = await pool.query(
      'INSERT INTO botverse_jobs (workspace_id, kind, payload, scheduled_at) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.workspaceId, b.kind, JSON.stringify(b.payload), b.scheduledAt || null],
    );
    await activity(req.workspaceId, 'Queued ' + b.kind + ' job');
    res.status(201).json({ data: mapJob(result.rows[0]) });
  } catch (err) { next(err); }
});
app.patch('/api/jobs/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!['queued', 'cancelled'].includes(b.status)) return sendError(res, 400, 'Only queued or cancelled status can be set through this endpoint.');
    const result = await pool.query(
      "UPDATE botverse_jobs SET status = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 AND status IN ('queued','failed') RETURNING *",
      [b.status, req.params.id, req.workspaceId],
    );
    if (!result.rowCount) return sendError(res, 404, 'Queued job not found or cannot be changed.');
    await activity(req.workspaceId, 'Updated queued job: ' + result.rows[0].kind + ' → ' + b.status);
    res.json({ data: mapJob(result.rows[0]) });
  } catch (err) { next(err); }
});
app.delete('/api/jobs/:id', async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM botverse_jobs WHERE id = $1 AND workspace_id = $2 AND status IN ('queued','cancelled','failed') RETURNING id", [req.params.id, req.workspaceId]);
    if (!result.rowCount) return sendError(res, 404, 'Job not found or already running.');
    res.status(204).end();
  } catch (err) { next(err); }
});

app.get('/api/integrations/status', async (_req, res) => {
  // Status-only discovery: credentials are never returned to the browser.
  const platforms = [
    { id: 'youtube', name: 'YouTube', configured: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REDIRECT_URI) },
    { id: 'tiktok', name: 'TikTok', configured: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_REDIRECT_URI) },
    { id: 'facebook', name: 'Facebook', configured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_REDIRECT_URI) },
    { id: 'instagram', name: 'Instagram', configured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_REDIRECT_URI) }
  ].map(platform => ({ ...platform, connected: false, publishEnabled: false, note: 'OAuth callback, granted scopes, account selection, and token storage are not implemented yet.' }));
  res.json({ data: { platforms, livePublishingEnabled: false } });
});

app.get('/api/activity', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, message, created_at FROM botverse_activity WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100', [req.workspaceId]);
    res.json({ data: result.rows.map((r) => ({ id: r.id, text: r.message, time: r.created_at })) });
  } catch (err) { next(err); }
});

app.use((req, res) => sendError(res, 404, 'Route not found.'));
app.use((err, _req, res, _next) => {
  if (err.message === 'Origin is not allowed by CORS.') return sendError(res, 403, err.message);
  console.error('BOTVERSE API error:', err.message);
  return sendError(res, 500, 'Internal server error.');
});

const server = app.listen(PORT, () => console.log('BOTVERSE Creator API listening on port ' + PORT));
async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
 + values.length + ' RETURNING *', values);
    if (!result.rowCount) return sendError(res, 404, 'Task not found.');
    if (previous && previous.rows[0].status !== result.rows[0].status) {
      await pool.query('INSERT INTO botverse_workflow_events (workspace_id, task_id, event_type, from_state, to_state, message) VALUES ($1,$2,$3,$4,$5,$6)', [req.workspaceId, result.rows[0].id, 'task.status_changed', previous.rows[0].status, result.rows[0].status, 'Task status changed: ' + previous.rows[0].title]);
    }
    await activity(req.workspaceId, 'Updated task: ' + result.rows[0].title);
    res.json({ data: mapTask(result.rows[0]) });
  } catch (err) { next(err); }
});
app.delete('/api/tasks/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM botverse_tasks WHERE id = $1 AND workspace_id = $2 RETURNING title', [req.params.id, req.workspaceId]);
    if (!result.rowCount) return sendError(res, 404, 'Task not found.');
    await activity(req.workspaceId, 'Deleted task: ' + result.rows[0].title);
    res.status(204).end();
  } catch (err) { next(err); }
});

app.get('/api/projects', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM botverse_projects WHERE workspace_id = $1 ORDER BY updated_at DESC', [req.workspaceId]);
    res.json({ data: result.rows.map(mapProject) });
  } catch (err) { next(err); }
});
app.post('/api/projects', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!isText(b.name, 100)) return sendError(res, 400, 'name is required (max 100 characters).');
    if (!isOptionalText(b.goal, 10000)) return sendError(res, 400, 'goal must be at most 10000 characters.');
    if (b.channel !== undefined && !CHANNELS.has(b.channel)) return sendError(res, 400, 'Unknown channel.');
    if (b.status !== undefined && !PROJECT_STATUSES.has(b.status)) return sendError(res, 400, 'Unknown project status.');
    if (!isDate(b.due)) return sendError(res, 400, 'due must be YYYY-MM-DD.');
    const result = await pool.query('INSERT INTO botverse_projects (workspace_id,name,goal,channel,status,due_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [req.workspaceId, b.name.trim(), (b.goal || '').trim(), b.channel || 'YouTube', b.status || 'Planning', asDate(b.due)]);
    await activity(req.workspaceId, 'Created project: ' + b.name.trim());
    res.status(201).json({ data: mapProject(result.rows[0]) });
  } catch (err) { next(err); }
});
app.patch('/api/projects/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const fields = [], values = [];
    const add = (column, value) => { values.push(value); fields.push(column + ' = $' + values.length); };
    if (b.name !== undefined) { if (!isText(b.name, 100)) return sendError(res, 400, 'Invalid name.'); add('name', b.name.trim()); }
    if (b.goal !== undefined) { if (!isOptionalText(b.goal, 10000)) return sendError(res, 400, 'Invalid goal.'); add('goal', b.goal || ''); }
    if (b.channel !== undefined) { if (!CHANNELS.has(b.channel)) return sendError(res, 400, 'Unknown channel.'); add('channel', b.channel); }
    if (b.status !== undefined) { if (!PROJECT_STATUSES.has(b.status)) return sendError(res, 400, 'Unknown status.'); add('status', b.status); }
    if (b.due !== undefined) { if (!isDate(b.due)) return sendError(res, 400, 'Invalid due date.'); add('due_date', asDate(b.due)); }
    if (!fields.length) return sendError(res, 400, 'No editable fields supplied.');
    values.push(req.params.id, req.workspaceId);
    const result = await pool.query('UPDATE botverse_projects SET ' + fields.join(', ') + ', updated_at = NOW() WHERE id = $' + (values.length - 1) + ' AND workspace_id = $' + values.length + ' RETURNING *', values);
    if (!result.rowCount) return sendError(res, 404, 'Project not found.');
    await activity(req.workspaceId, 'Updated project: ' + result.rows[0].name);
    res.json({ data: mapProject(result.rows[0]) });
  } catch (err) { next(err); }
});
app.delete('/api/projects/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM botverse_projects WHERE id = $1 AND workspace_id = $2 RETURNING name', [req.params.id, req.workspaceId]);
    if (!result.rowCount) return sendError(res, 404, 'Project not found.');
    await activity(req.workspaceId, 'Deleted project: ' + result.rows[0].name);
    res.status(204).end();
  } catch (err) { next(err); }
});
function mapJob(row) {
  return { id: row.id, kind: row.kind, payload: row.payload, status: row.status, scheduledAt: row.scheduled_at, attempts: row.attempts, lastError: row.last_error, created: row.created_at, updated: row.updated_at };
}
app.get('/api/jobs', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
    const result = await pool.query('SELECT * FROM botverse_jobs WHERE workspace_id = $1 ORDER BY scheduled_at NULLS FIRST, created_at DESC LIMIT $2', [req.workspaceId, limit]);
    res.json({ data: result.rows.map(mapJob) });
  } catch (err) { next(err); }
});
app.post('/api/jobs', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!['agent_draft', 'publish'].includes(b.kind)) return sendError(res, 400, 'kind must be agent_draft or publish.');
    if (!b.payload || typeof b.payload !== 'object' || Array.isArray(b.payload)) return sendError(res, 400, 'payload must be a JSON object.');
    if (JSON.stringify(b.payload).length > 10000) return sendError(res, 400, 'payload must be at most 10000 characters.');
    if (b.scheduledAt !== undefined && b.scheduledAt !== null && b.scheduledAt !== '' && (typeof b.scheduledAt !== 'string' || Number.isNaN(Date.parse(b.scheduledAt)))) return sendError(res, 400, 'scheduledAt must be a valid ISO date/time.');
    if (b.kind === 'publish' && (!isText(b.payload.channel, 40) || !isText(b.payload.content, 1_000_000))) return sendError(res, 400, 'publish jobs require payload.channel and payload.content.');
    const result = await pool.query(
      'INSERT INTO botverse_jobs (workspace_id, kind, payload, scheduled_at) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.workspaceId, b.kind, JSON.stringify(b.payload), b.scheduledAt || null],
    );
    await activity(req.workspaceId, 'Queued ' + b.kind + ' job');
    res.status(201).json({ data: mapJob(result.rows[0]) });
  } catch (err) { next(err); }
});
app.patch('/api/jobs/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!['queued', 'cancelled'].includes(b.status)) return sendError(res, 400, 'Only queued or cancelled status can be set through this endpoint.');
    const result = await pool.query(
      "UPDATE botverse_jobs SET status = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 AND status IN ('queued','failed') RETURNING *",
      [b.status, req.params.id, req.workspaceId],
    );
    if (!result.rowCount) return sendError(res, 404, 'Queued job not found or cannot be changed.');
    await activity(req.workspaceId, 'Updated queued job: ' + result.rows[0].kind + ' → ' + b.status);
    res.json({ data: mapJob(result.rows[0]) });
  } catch (err) { next(err); }
});
app.delete('/api/jobs/:id', async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM botverse_jobs WHERE id = $1 AND workspace_id = $2 AND status IN ('queued','cancelled','failed') RETURNING id", [req.params.id, req.workspaceId]);
    if (!result.rowCount) return sendError(res, 404, 'Job not found or already running.');
    res.status(204).end();
  } catch (err) { next(err); }
});

app.get('/api/integrations/status', async (_req, res) => {
  // Status-only discovery: credentials are never returned to the browser.
  const platforms = [
    { id: 'youtube', name: 'YouTube', configured: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REDIRECT_URI) },
    { id: 'tiktok', name: 'TikTok', configured: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_REDIRECT_URI) },
    { id: 'facebook', name: 'Facebook', configured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_REDIRECT_URI) },
    { id: 'instagram', name: 'Instagram', configured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_REDIRECT_URI) }
  ].map(platform => ({ ...platform, connected: false, publishEnabled: false, note: 'OAuth callback, granted scopes, account selection, and token storage are not implemented yet.' }));
  res.json({ data: { platforms, livePublishingEnabled: false } });
});

app.get('/api/activity', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, message, created_at FROM botverse_activity WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100', [req.workspaceId]);
    res.json({ data: result.rows.map((r) => ({ id: r.id, text: r.message, time: r.created_at })) });
  } catch (err) { next(err); }
});

app.use((req, res) => sendError(res, 404, 'Route not found.'));
app.use((err, _req, res, _next) => {
  if (err.message === 'Origin is not allowed by CORS.') return sendError(res, 403, err.message);
  console.error('BOTVERSE API error:', err.message);
  return sendError(res, 500, 'Internal server error.');
});

const server = app.listen(PORT, () => console.log('BOTVERSE Creator API listening on port ' + PORT));
async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

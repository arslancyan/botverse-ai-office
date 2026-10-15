import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) throw new Error('DATABASE_URL is required.');
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: true },
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});
const pollMs = Math.max(1000, Number(process.env.BOTVERSE_WORKER_POLL_MS) || 5000);
const maxAttempts = Math.max(1, Math.min(5, Number(process.env.BOTVERSE_WORKER_MAX_ATTEMPTS) || 3));
const guides = {
  orbit: 'You are ORBIT, the studio lead. Create prioritized plans with dependencies.',
  pixel: 'You are PIXEL, a video editor. Create editing briefs, shot lists, pacing and captions.',
  echo: 'You are ECHO, a social manager. Draft platform-aware captions and publishing checklists.',
  byte: 'You are BYTE, a script and tools specialist. Create safe scripts and workflow templates.',
  scout: 'You are SCOUT, a trend researcher. Suggest angles and validation steps; never invent live trend data.'
};
let stopping = false;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function claimJob() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      `SELECT * FROM botverse_jobs
       WHERE status = 'queued' AND (scheduled_at IS NULL OR scheduled_at <= NOW())
       ORDER BY scheduled_at NULLS FIRST, created_at
       FOR UPDATE SKIP LOCKED LIMIT 1`
    );
    if (!found.rowCount) { await client.query('COMMIT'); return null; }
    const row = found.rows[0];
    const claimed = await client.query(
      `UPDATE botverse_jobs SET status = 'running', attempts = attempts + 1, updated_at = NOW()
       WHERE id = $1 RETURNING *`, [row.id]
    );
    let runId = null;
    if (row.kind === 'agent_draft') {
      const requestedAgent = typeof row.payload?.agent === 'string' && guides[row.payload.agent] ? row.payload.agent : 'orbit';
      const run = await client.query(
        `INSERT INTO botverse_agent_runs (workspace_id, agent_id, job_id, status, attempt, started_at)
         VALUES ($1,$2,$3,'running',$4,NOW()) RETURNING id`,
        [row.workspace_id, requestedAgent, row.id, claimed.rows[0].attempts]
      );
      runId = run.rows[0].id;
      await client.query(
        `INSERT INTO botverse_workflow_events (workspace_id, run_id, event_type, from_state, to_state, message)
         VALUES ($1,$2,'agent_run.started','queued','running',$3)`,
        [row.workspace_id, runId, 'Agent draft run started']
      );
    }
    await client.query('COMMIT');
    return { ...claimed.rows[0], run_id: runId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

async function createDraft(payload) {
  const agent = typeof payload.agent === 'string' ? payload.agent : 'orbit';
  const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
  if (!guides[agent] || !prompt || prompt.length > 4000) throw new Error('agent_draft requires a valid agent and prompt (max 4000 characters).');
  const key = process.env.AI_API_KEY || '';
  if (!key) throw new Error('AI provider is not configured. Set AI_API_KEY on the worker environment.');
  const endpoint = new URL(process.env.AI_BASE_URL || 'https://api.openai.com/v1/chat/completions');
  if (endpoint.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(endpoint.hostname)) throw new Error('AI_BASE_URL must use HTTPS.');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: guides[agent] + ' Return a useful draft or plan only. Do not claim to publish or execute external actions.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 900
    }),
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 429 ? 'AI provider rate limit reached.' : 'AI provider request failed with HTTP ' + response.status + '.');
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) throw new Error('AI provider returned an empty response.');
  return { agent, model: process.env.AI_MODEL || 'gpt-4o-mini', answer: answer.trim(), generatedAt: new Date().toISOString() };
}

async function processJob(job) {
  let result;
  if (job.kind === 'agent_draft') {
    result = await createDraft(job.payload || {});
  } else if (job.kind === 'publish') {
    // Deliberate safety gate: no platform adapter/OAuth account is connected yet.
    throw new Error('Publishing is disabled: connect and verify an official platform OAuth adapter before enabling real posts.');
  } else {
    throw new Error('Unsupported job kind.');
  }
  await pool.query(
    `UPDATE botverse_jobs SET status = 'completed', payload = payload || $2::jsonb,
     last_error = '', updated_at = NOW() WHERE id = $1`,
    [job.id, JSON.stringify({ result })]
  );
  if (job.run_id) {
    await pool.query("UPDATE botverse_agent_runs SET status = 'completed', artifact = $2::jsonb, finished_at = NOW(), updated_at = NOW() WHERE id = $1", [job.run_id, JSON.stringify({ agent: result.agent, model: result.model, answer: result.answer, generatedAt: result.generatedAt })]);
    await pool.query("INSERT INTO botverse_workflow_events (workspace_id, run_id, event_type, from_state, to_state, message) VALUES ($1,$2,'agent_run.completed','running','completed','Agent draft completed')", [job.workspace_id, job.run_id]);
  }
  await pool.query('INSERT INTO botverse_activity (workspace_id, message) VALUES ($1, $2)', [job.workspace_id, 'Completed ' + job.kind + ' job']);
}

async function failJob(job, error) {
  const message = String(error?.message || 'Unknown worker error').slice(0, 1000);
  const retry = job.attempts < maxAttempts && job.kind === 'agent_draft' && !/not configured|disabled|requires a valid/i.test(message);
  await pool.query(
    `UPDATE botverse_jobs SET status = $2, last_error = $3, updated_at = NOW()
     WHERE id = $1`,
    [job.id, retry ? 'queued' : 'failed', message]
  );
  if (job.run_id) {
    await pool.query('UPDATE botverse_agent_runs SET status = $2, error_code = $3, finished_at = $4, updated_at = NOW() WHERE id = $1', [job.run_id, retry ? 'cancelled' : 'failed', 'worker_error', retry ? null : new Date()]);
    await pool.query('INSERT INTO botverse_workflow_events (workspace_id, run_id, event_type, from_state, to_state, message) VALUES ($1,$2,$3,\'running\',$4,$5)', [job.workspace_id, job.run_id, retry ? 'agent_run.retrying' : 'agent_run.failed', retry ? 'queued' : 'failed', message.slice(0, 400)]);
  }
  await pool.query('INSERT INTO botverse_activity (workspace_id, message) VALUES ($1, $2)', [job.workspace_id, 'Job ' + job.kind + ' ' + (retry ? 'will retry' : 'failed') + ': ' + message.slice(0, 180)]);
  console.error('BOTVERSE job ' + job.id + ' failed: ' + message);
}

async function main() {
  console.log('BOTVERSE worker started; poll=' + pollMs + 'ms, maxAttempts=' + maxAttempts + '. Publish jobs remain disabled until official adapters are implemented.');
  while (!stopping) {
    try {
      const job = await claimJob();
      if (!job) { await sleep(pollMs); continue; }
      try { await processJob(job); console.log('Completed job ' + job.id); }
      catch (error) { await failJob(job, error); }
    } catch (error) {
      console.error('Worker loop error:', error?.message || error);
      await sleep(pollMs);
    }
  }
}
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());

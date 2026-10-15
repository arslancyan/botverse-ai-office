import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const token = process.env.BOTVERSE_API_TOKEN || 'botverse-ci-test-token-0123456789abcdef';
const port = Number(process.env.TEST_PORT || 3187);
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, PORT: String(port), BOTVERSE_API_TOKEN: token };
const server = spawn(process.execPath, ['server/index.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    if (server.exitCode !== null) throw new Error('API process exited early. ' + serverOutput);
    try {
      const response = await fetch(base + '/api/health');
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('API did not become ready. ' + serverOutput);
}
async function request(path, { method = 'GET', body, auth = true, workspace = 'ci-test' } = {}) {
  const headers = { Accept: 'application/json', 'X-Workspace-Id': workspace };
  if (auth) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(base + path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

try {
  await waitForServer();

  const health = await fetch(base + '/api/health');
  assert.equal(health.status, 200, 'health endpoint should be available');
  assert.equal((await health.json()).ok, true, 'health endpoint should report ok');

  const unauthorized = await request('/api/tasks', { auth: false });
  assert.equal(unauthorized.status, 401, 'API data routes must require a token');

  const invalidAgent = await request('/api/agents/run', { method: 'POST', body: { agent: 'unknown', prompt: 'test' } });
  assert.equal(invalidAgent.status, 400, 'unknown AI agent should be rejected before provider access');

  const missingAiPrompt = await request('/api/agents/run', { method: 'POST', body: { agent: 'orbit', prompt: 'Make a short plan' } });
  assert.ok([200, 503].includes(missingAiPrompt.status), 'agent route should return a response or a clear unconfigured-provider status');
  if (missingAiPrompt.status === 503) {
    assert.match((await missingAiPrompt.json()).error.message, /AI provider is not configured/i);
  }

  const invalid = await request('/api/tasks', { method: 'POST', body: { title: '' } });
  assert.equal(invalid.status, 400, 'invalid task payload should be rejected');

  const projectResponse = await request('/api/projects', {
    method: 'POST',
    body: { name: 'CI test project', goal: 'API smoke test', channel: 'YouTube', status: 'Planning' },
  });
  assert.equal(projectResponse.status, 201, 'project should be created');
  const project = (await projectResponse.json()).data;
  assert.ok(project.id, 'created project should have an id');

  const taskResponse = await request('/api/tasks', {
    method: 'POST',
    body: { title: 'CI test task', projectId: project.id, agent: 'orbit', channel: 'TikTok', status: 'Idea', priority: 'High' },
  });
  assert.equal(taskResponse.status, 201, 'task should be created');
  const task = (await taskResponse.json()).data;
  assert.equal(task.projectId, project.id, 'task should reference the project');

  const listResponse = await request('/api/tasks');
  assert.equal(listResponse.status, 200);
  assert.ok((await listResponse.json()).data.some((item) => item.id === task.id), 'task should appear in its workspace');

  const otherWorkspace = await request('/api/tasks', { workspace: 'ci-other-workspace' });
  assert.equal(otherWorkspace.status, 200);
  assert.equal((await otherWorkspace.json()).data.some((item) => item.id === task.id), false, 'workspaces must not see each other’s tasks');

  const updateResponse = await request('/api/tasks/' + task.id, { method: 'PATCH', body: { status: 'Editing' } });
  assert.equal(updateResponse.status, 200, 'task should be editable');
  assert.equal((await updateResponse.json()).data.status, 'Editing');

  const deleteTask = await request('/api/tasks/' + task.id, { method: 'DELETE' });
  assert.equal(deleteTask.status, 204, 'task should be deletable');
  const deleteProject = await request('/api/projects/' + project.id, { method: 'DELETE' });
  assert.equal(deleteProject.status, 204, 'project should be deletable');

  const activityResponse = await request('/api/activity');
  assert.equal(activityResponse.status, 200);
  assert.ok((await activityResponse.json()).data.some((item) => item.text.includes('CI test project')), 'mutations should be recorded in activity');

  console.log('BOTVERSE API smoke tests passed: health, auth, validation, workspace isolation, project/task CRUD, activity.');
} catch (error) {
  console.error(error);
  console.error(serverOutput);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    server.once('exit', resolve);
    setTimeout(resolve, 2000).unref();
  });
}

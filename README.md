# BOTVERSE — Creator OS

BOTVERSE is a creator-company workspace for TikTok, YouTube, Facebook, and Instagram workflows, with a cozy virtual office and five specialist robot teammates.

## Current product

### Frontend
- CSS-rendered pseudo-3D Creator Office with animated robot mascots: ORBIT, PIXEL, ECHO, BYTE, and SCOUT.
- Content Calendar, Production Board, Projects & Campaigns, AI Team, Analytics, Activity Log, and workspace backup.
- Responsive layout for desktop, tablet, and mobile.
- Browser-local prototype data until the frontend is configured to use the API.

### Backend foundation (new)
- Node.js + Express REST API.
- PostgreSQL persistence using parameterized SQL queries.
- Bearer-token authentication, request-size limit, rate limit, Helmet security headers, and CORS allowlist.
- Workspace-scoped tasks, projects, and activity records.
- Input validation and consistent JSON errors.

## API endpoints

Health check (no token required):
- `GET /api/health`

All other endpoints require:
`Authorization: Bearer YOUR_BOTVERSE_API_TOKEN`

Optional workspace header:
`X-Workspace-Id: default`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/tasks` | List tasks (optional `?limit=100`, max 250) |
| POST | `/api/tasks` | Create a task |
| PATCH | `/api/tasks/:id` | Update task fields |
| DELETE | `/api/tasks/:id` | Delete a task |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create a project |
| PATCH | `/api/projects/:id` | Update project fields |
| DELETE | `/api/projects/:id` | Delete a project |
| GET | `/api/activity` | Read latest 100 activity entries |

### Example request

```bash
curl https://YOUR_API_HOST/api/tasks \
  -H "Authorization: Bearer YOUR_BOTVERSE_API_TOKEN" \
  -H "X-Workspace-Id: default"
```

Task JSON example:
```json
{
  "title": "Edit a YouTube Short",
  "agent": "pixel",
  "channel": "YouTube",
  "status": "Editing",
  "priority": "High",
  "due": "2026-10-25",
  "notes": "Captions, pacing, sound mix"
}
```

## Local setup

Requirements: Node.js 20+ and PostgreSQL.

1. Create a PostgreSQL database.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` first.
3. Run `npm run migrate` to apply the versioned, transactional initial migration. It records completion in `botverse_schema_migrations` and safely skips version 1 on repeat runs. The legacy `db/schema.sql` remains available as a manual bootstrap option.
4. Set the remaining variables in `.env`:
   - `DATABASE_URL`
   - `BOTVERSE_API_TOKEN` (use a long random secret of at least 32 characters)
   - `CORS_ORIGINS` (comma-separated exact origins that may call the API)
5. Install and run:

```bash
npm install
npm run check
npm start
```

6. Open `http://localhost:3000/api/health`.

Never commit `.env`, database passwords, API tokens, or model-provider keys. Do not put privileged secrets in frontend JavaScript.

## Deploying the API

Deploy this repository as a Node service on a host such as Railway. Use the repository root, build/install command `npm install`, start command `npm start`, and health-check path `/api/health`. Set environment variables in the host dashboard. Apply `db/schema.sql` to the chosen PostgreSQL database before relying on the API.

GitHub Pages only serves the static frontend; it cannot run this Node API. The API must be hosted separately.

## Important current limitations

- The frontend remains local-first. Settings now supports a session-only API token, API health/auth test, and an explicit confirmed read/import of server tasks, projects, and activity. Normal create/edit/delete actions still use local storage; write-through sync awaits proper user authentication and workspace authorization.
- The five robot characters are role definitions, not autonomous LLM agents yet.
- Social accounts are not connected; no real posts are published.
- Analytics currently reflect local task records, not live platform performance.
- Bearer-token authentication is a secure starting point for a single-owner prototype, not a complete multi-user login system. Before public multi-user use, add real user authentication, per-user/workspace authorization, token rotation, audit policies, and deployment monitoring.

## Roadmap

1. Deploy and smoke-test the API and database.
2. Finish API write-through after adding real user authentication and workspace authorization.
3. Implement secure user authentication and workspace membership.
4. Connect a model provider through the backend with bounded tools and human approval.
5. Add media library, job queue, and retryable scheduled publishing.
6. Integrate official social APIs and live analytics where account access and platform policy permit.
7. Upgrade the virtual office to a true 3D engine after the workflow is validated.

# BOTVERSE AI OFFICE — Seven-stage implementation plan

This plan is the source of truth for development. The public GitHub Pages frontend remains available throughout. The backend, database, AI provider, and social platforms remain disconnected until separately configured and explicitly approved.

## Stage 1 — Clean foundation and truthful UI
- [x] Re-audit demo/local/API labels and stop presenting illustrative values as live metrics.
- [x] Add an explicit Blocked task state across the local UI and API validation.
- [x] Derive teammate status from assigned tasks and synchronize the team list, character and selected profile.
- [ ] Add automated browser-level tests and visually verify desktop/mobile rendering.

## Stage 2 — Shared workflow state and audit trail
- [x] Add durable database schema for agent runs and append-only workflow events.
- [x] Record task status transitions in workspace-scoped events.
- [x] Expose read-only API endpoints for workflow events and agent runs.
- [ ] Add full concurrency/transaction tests against a real ephemeral PostgreSQL CI service.

## Stage 3 — Office interaction and workflow visibility
- [x] Show all seven workflow lanes in a horizontal-scroll board.
- [x] Connect room selections to relevant teammates.
- [x] Give blocked, working, review, scheduled, assigned and completed states visible cues.
- [ ] Verify keyboard navigation, small screens and reduced-motion behavior in a real browser.

## Stage 4 — Agent execution lifecycle
- [x] Associate worker draft jobs with durable run records.
- [x] Record started/completed/failed/retry events and retain a bounded result artifact.
- [x] Keep the worker's external publishing branch explicitly disabled.
- [ ] Add cancellation semantics, idempotency, stale-run recovery and bounded end-to-end worker tests.

## Stage 5 — Security and reliability
- [x] Keep AI credentials server-side; use API token authentication, workspace scoping, payload validation, Helmet, CORS allowlisting and rate limits.
- [x] Keep public analytics labeled as local planning data; never expose provider credentials through integration status.
- [ ] Replace the single shared API token with real user authentication and per-workspace authorization before public backend deployment.
- [ ] Add secret scanning, dependency auditing and operational alerting.

## Stage 6 — Official integrations and approvals
- [x] Add an informational readiness endpoint for YouTube, TikTok, Facebook and Instagram.
- [x] Keep all platforms disconnected and publishing disabled until OAuth and permissions are implemented.
- [ ] Implement official OAuth callbacks, encrypted server-side token storage, revocation, scopes, audit logs and a human approval gate.
- [ ] Add platform-specific publishing adapters and verify each one in a test account before any production enablement.

## Stage 7 — Office polish and release validation
- [x] Refine the dark neon glass-cube office, responsive layout and status-linked character cues.
- [x] Keep the CSS scene lightweight; do not add WebGL or paid services without evidence they are needed.
- [ ] Run current CI and verify the GitHub Pages deployment after the latest commits.
- [ ] Complete browser QA for desktop/mobile, accessibility and local/offline mode.

## Current operating constraints
- No backend deployment or paid database resource is created by this plan.
- No social account is connected and no real post can be published.
- AI generation requires an explicitly configured server-side key and a running worker.
- Until the API is connected, task/project edits stay in the current browser's local storage.

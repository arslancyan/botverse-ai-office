# BOTVERSE AI OFFICE — Public Product Research

Last reviewed: 2026-10-16

This document records product patterns observed in public AI-agent products and open-source projects. It is a design/engineering guide for BOTVERSE, not a claim that BOTVERSE already implements these capabilities. No third-party source code or assets are copied here.

## Public references reviewed

- OpenAI Workspace Agents: https://openai.com/index/introducing-workspace-agents-in-chatgpt/
  - Useful patterns: shared agents, repeatable workflows, connected tools, scheduling, permission boundaries, and admin controls.
- Manus: https://manus.im/ and https://open.manus.ai/docs/v2/agents-overview
  - Useful patterns: named agents, task-centric interaction, persistent task threads, and an API surface for agent/task operations.
- LangGraph: https://langchain-ai.github.io/langgraph/
  - Useful patterns: explicit workflow states, durable execution, retries, checkpoints, human-in-the-loop approvals, and observable transitions.
- Pixel Team Studio (public repository): https://github.com/NJ-A2A/pixel-team-studio
  - Useful patterns: office positions driven by task state, visible blockers/waiting states, project/calendar context, configurable rooms, and a normalized event stream. Its README emphasizes that activity frequency is not a performance score and warns against employee surveillance.
- OpenHands Agent Canvas: https://github.com/OpenHands/agent-canvas
  - Its README says the project has moved to https://github.com/OpenHands/OpenHands; treat it as a pointer, not an active implementation reference.

## Findings for our product

BOTVERSE already has a CSS pseudo-3D creator office, five specialist characters, tasks/projects/calendar, local activity logs, an API foundation, a draft-job queue, and an AI endpoint that requires server configuration. The API/database and live integrations are not deployed/connected, so current public pages must continue to label demo/local data accurately.

The biggest opportunity is to make the office a trustworthy visualization of actual workflow state rather than decorative animation.

## Proposed product principles

1. **State before spectacle.** Every character's status and location should be derived from task/agent state, not random animation.
2. **Explicit lifecycle.** Use a controlled lifecycle such as idle → assigned → working → needs_review → blocked / completed, with valid transitions and timestamps.
3. **Human approval for external actions.** Agents may draft and prepare; publishing, account changes, deletion, and other consequential actions require explicit approval until secure platform adapters exist.
4. **Traceability.** Each run should have a task ID, agent ID, timestamps, status, bounded logs, result artifact, and retry/error state. Do not expose secrets or hidden reasoning.
5. **Honest data provenance.** Distinguish demo, browser-local, API-connected, and verified live platform metrics. Never present mock values as real-time analytics.
6. **Privacy and least privilege.** Scope data by workspace, minimize retained content, keep provider credentials server-side, and do not treat agent activity as employee-performance surveillance.
7. **Graceful offline mode.** The static GitHub Pages frontend must remain useful without a backend; connection state must be visible.

## Implementation roadmap

### Phase A — UI truth and interaction (safe with current GitHub Pages setup)
- Add explicit Demo / Local / API status labels.
- Add agent states and task-state badges with accessible text, not color alone.
- Make selecting a character open a detail panel with role, current task, status, last transition, and next allowed action.
- Make room tags filter or focus tasks by department.
- Remove or label hard-coded metrics so sample counts cannot be mistaken for production data.
- Add empty, loading, offline, and error states for panels.

### Phase B — Agent run records (backend remains undeployed until separately approved)
- Introduce an agent-run record with id, workspace_id, agent_id, task_id, status, started_at, finished_at, attempt, error_code, and artifact_reference.
- Store append-only state-transition events; do not store API keys, raw credentials, or unnecessary prompt content in event logs.
- Add bounded retries, idempotency keys, timeouts, cancellation rules, and a maximum run duration.
- Surface safe run status to the UI using polling first; consider Server-Sent Events only when the backend is deployed and authenticated.
- Keep publish jobs disabled until OAuth, token storage, permissions, and approval flow are implemented.

### Phase C — Workflow orchestration
- Start with a deterministic state machine and the current queue; do not introduce a large agent framework until requirements justify it.
- Define tools as narrow server-side functions with schemas and authorization checks.
- Add a review/approval step before any external side effect.
- Evaluate LangGraph or another orchestrator only if long-running tasks, resumability, multi-agent handoffs, or durable checkpoints exceed the current worker's needs.

### Phase D — Real integrations and analytics
- Implement official OAuth flows and least-privilege scopes per platform.
- Use a server-side token vault, rotation/revocation, audit events, and workspace/user authorization.
- Add platform metrics only after the API permissions and data freshness are verified.
- Keep publish adapters disabled by default until tested end-to-end.

### Phase E — richer office visualization
- Make room assignment, character position, and idle/working/review/blocked states reflect real workflow events.
- Add optional room layout presets only after core state and task mapping are reliable.
- Consider WebGL/3D only when the workflow is proven; the current CSS scene is lighter and easier to deploy.

## Immediate next implementation slice

1. Audit the current front-end demo metrics and labels for accuracy.
2. Add an explicit per-agent state model derived from tasks.
3. Connect the office status card, team list, and selected-character panel to that shared state.
4. Add tests for status derivation and task transitions.
5. Run CI and confirm the GitHub Pages deployment before moving to backend work.

## Acceptance checklist

- [ ] Demo data is visibly labeled.
- [ ] Agent state is derived from task/run state, not random motion.
- [ ] A blocked or review-needed task is distinguishable from active work.
- [ ] No external publish action can run without an explicit approval path.
- [ ] No secrets are placed in frontend files or logs.
- [ ] Offline frontend remains functional.
- [ ] Automated checks pass and Pages deployment is verified.

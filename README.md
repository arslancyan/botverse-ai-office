# BOTVERSE — Creator OS

A responsive creator-company workspace with a cozy, isometric-inspired office and cute robot teammates.

## Features in this MVP

- **Creator Office:** CSS-rendered pseudo-3D studio with animated robot mascots ORBIT, PIXEL, ECHO, BYTE, and SCOUT.
- **Content Calendar:** month view; click a date to plan a content item.
- **Production Pipeline:** create/edit/delete content tasks and move them through Idea → Scripting → Editing → Ready → Scheduled → Published.
- **Projects & Campaigns:** organize content series, define goals, channel, status, and target dates.
- **AI Team:** role profiles and task assignments for studio lead, editor, social manager, scripts/tools, and trend researcher.
- **Dashboard & Analytics:** local workflow counts and channel mix. These are not live social-platform metrics.
- **Workspace backup:** export/import JSON, local browser persistence, activity log, reset demo data.
- Responsive layouts for desktop, tablet, and mobile.

## Run / publish

This is a static site. Open `index.html` in a browser or enable GitHub Pages for the repository:
**Settings → Pages → Deploy from a branch → main → /(root)**.

## Important limitations

This release is a frontend prototype. The robot agents do not run AI models, social accounts are not connected, scheduled posts are not actually published, and analytics are based only on local task records. Browser storage is local to one browser/device and does not sync between devices.

Never place secret API keys in public frontend files.

## Roadmap

1. Backend API, authentication, and shared database.
2. Secure AI provider integration and tool permissions.
3. Media asset library and production brief templates.
4. Official platform integrations where APIs and account permissions allow.
5. Server-side scheduling, retry/error monitoring, and publishing approvals.
6. Live performance analytics, audit logs, and multi-user access.
7. Upgrade robot characters and environment to a true 3D engine after workflow validation.

# BOTVERSE — AI Virtual Office

BOTVERSE is an interactive, responsive prototype for a game-like AI office dashboard.

## Current MVP

- Isometric-inspired virtual office with five selectable robot agents.
- Agent profiles for ORBIT (Manager), BYTE (Developer), PIXEL (Designer), ECHO (Marketing), and SCOUT (Research).
- Create tasks, assign an agent, set priority, change status, and delete tasks.
- Activity log, workspace export to JSON, zoom controls, responsive mobile/tablet layout.
- Local persistence using browser `localStorage`.
- Task and activity state is explicitly labeled as a local simulation.

## Run it

Open `index.html` in a modern browser, or enable GitHub Pages for this repository.

## Important limitations

This frontend is a prototype. Agents do **not** call an AI model or execute work yet. Data is stored in the current browser only and is not shared across devices. Do not paste API secrets into the frontend.

## Next milestones

1. Split the single HTML file into maintainable CSS and JavaScript modules.
2. Deploy a preview with GitHub Pages.
3. Add a secure backend, persistent database, authentication, and server-side secrets.
4. Connect an AI provider and a controlled task execution layer.
5. Add realtime task updates and richer 3D models when the product flow is validated.

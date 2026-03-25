# Web UI (src/web)

Overview
--------

This directory contains the lightweight web UI for the questionnaire project: a small HTTP server plus the static frontend assets used to run questionnaires and view responses.

Files
-----

- `server.ts` — HTTP server that serves the static frontend and any minimal API endpoints used by the web UI.

- `dtos/index.ts` — Data Transfer Object definitions used by the server and frontend when exchanging JSON.

- `middleware/`
  - `auth.ts` — authentication/authorization middleware for protected endpoints.
  - `error-handler.ts` — centralized error handling for the server.
  - `index.ts` — convenience exports for middleware.

- `public/` — static frontend assets (served by `server.ts`):
  - `app.js` — frontend JavaScript glue for the web UI.
  - `builder.html` — UI for building or editing questionnaires (static entry).
  - `index.html` — main landing page for the web UI.
  - `responses.html` — page for viewing stored responses.
  - `runner.html` — runner UI used to execute a questionnaire in a browser.
  - `style.css` — styles for the frontend pages.

Running / Development
---------------------

This code is written in TypeScript and is built together with the rest of the project. Typical workflow:

1. Build the project:

```
npm run build
```

2. Run the compiled server (the build preserves the `web` path under `dist`):

```
node dist/web/server.js
```

For quick development you can run the TypeScript source directly using a tool like `ts-node` or your editor's run configuration.

Notes
-----

- Static files under `public/` are served by `server.ts`.
- When editing TypeScript sources, rebuild the project so the compiled `dist/web` output stays in sync.
- See the repository root README for top-level build and run scripts.

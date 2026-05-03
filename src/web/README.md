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
  - `config.js` — **served dynamically by the server** (not a static file); sets `window.APP_BASE` to the configured `BASE_PATH` value so the frontend knows the URL prefix.

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

Configuration
-------------

The web server reads the following environment variables at startup:

| Variable   | Default        | Description                                                                                              |
| ---------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `PORT`     | `3000`         | TCP port the server listens on.                                                                          |
| `DATA_DIR` | `./data`       | Directory used for file-based storage. Ignored when `S3_BUCKET` is set.                                 |
| `BASE_PATH`| *(empty)*      | Optional URL path prefix. When set, the UI and API are both served under this prefix (see below).       |
| `NODE_ENV` | `development`  | Set to `production` to enforce stricter CORS and disable development-only behaviour.                    |
| `CORS_ORIGINS` | *(empty)*  | Comma-separated list of allowed origins for CORS in non-development environments.                       |

See the repository root README for the full list of storage-related variables (`S3_BUCKET`, etc.).

### Hosting under a sub-path (`BASE_PATH`)

By default the server mounts the UI at `/` and the API at `/api`. If you need to host the application under a path prefix — for example behind an nginx `location /qqq` block — set the `BASE_PATH` environment variable:

```
BASE_PATH=/qqq node dist/web/server.js
```

With this configuration:

- The landing page is served at `http://host/qqq/`
- All API endpoints are available under `http://host/qqq/api/`

The server automatically injects the base path into the browser via a small `/qqq/config.js` script that sets `window.APP_BASE`, which the frontend JavaScript uses when constructing API request URLs.

Leading slashes are normalised automatically; trailing slashes are stripped. Both `BASE_PATH=qqq` and `BASE_PATH=/qqq` produce the same result.

Notes
-----

- Static files under `public/` are served by `server.ts`.
- When editing TypeScript sources, rebuild the project so the compiled `dist/web` output stays in sync.
- See the repository root README for top-level build and run scripts.

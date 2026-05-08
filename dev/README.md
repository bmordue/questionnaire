# Local Development Authentication Stack

This directory contains configuration and scripts for running the full
authentication stack locally so you can test the real proxy-header flow
without deploying to a server.

## Architecture

```
Browser
  │
  ▼
nginx (port 8080)          ← only public-facing port
  │  auth_request → oauth2-proxy (port 4180)
  │                        └── OIDC flow → Dex (port 5556)
  │
  │  (after successful auth, nginx injects identity headers)
  │  Remote-User   ← user's email from Dex
  │  Remote-Name   ← username from Dex
  │  Remote-Groups ← (empty for static Dex users; see note below)
  │
  ▼
questionnaire service (port 3000)
```

## Prerequisites

Enter the Nix devshell to get all required tools (`dex`, `nginx`,
`oauth2-proxy`, `nodejs_22`, `curl`):

```bash
# With nix-direnv (auto-activates on cd):
direnv allow

# Or manually:
nix develop
```

> **nix-direnv note**: The `.envrc` uses `use flake`, which requires
> [nix-direnv](https://github.com/nix-community/nix-direnv).  Install it
> once with `nix profile install nixpkgs#nix-direnv` (or via home-manager)
> and then run `direnv allow`.

## Quick Start

```bash
# 1. Build and start the questionnaire web server (port 3000)
npm run build
npm run web &

# 2. Start Dex + oauth2-proxy + nginx
./dev/scripts/start-auth.sh

# 3. Open http://localhost:8080 in your browser
#    Log in with one of the test credentials below
```

## Test Users

| Email                  | Password   | Notes                         |
|------------------------|------------|-------------------------------|
| `admin@example.com`    | `password` | See admin group note below    |
| `user@example.com`     | `password` | Regular authenticated user    |

## Admin Group Testing

Dex's built-in static-password users do not carry group memberships in
their OIDC claims.  As a result, `Remote-Groups` will be empty when you
log in via this stack, and the questionnaire service will treat both test
users as ordinary (non-admin) authenticated users.

**Options for testing admin flows:**

1. **Set `ADMIN_GROUP` to empty**: The questionnaire service treats anyone
   as an admin if the admin group is set to an empty string.

   ```bash
   ADMIN_GROUP="" npm run web
   ```

2. **Use `DEV_STUB_USER`**: Bypass the full auth stack and inject a fake
   identity with specific groups directly.

   ```bash
   DEV_STUB_USER="admin@example.com:Admin User:admins" npm run web
   # Then access the service directly on port 3000, not through nginx
   ```

   See [../docs/auth.md](../docs/auth.md) for more details.

## Stopping the Stack

```bash
./dev/scripts/stop-auth.sh
```

## Logs

All runtime files land under `/tmp/questionnaire-dev/` (never committed):

| File                                            | Contents             |
|-------------------------------------------------|----------------------|
| `/tmp/questionnaire-dev/logs/dex.log`           | Dex output           |
| `/tmp/questionnaire-dev/logs/oauth2-proxy.log`  | oauth2-proxy output  |
| `/tmp/questionnaire-dev/nginx/access.log`       | nginx access log     |
| `/tmp/questionnaire-dev/nginx/error.log`        | nginx error log      |

## Port Reference

| Service           | Address               | Purpose                            |
|-------------------|-----------------------|------------------------------------|
| nginx             | `http://localhost:8080` | Browser entry point              |
| questionnaire     | `http://localhost:3000` | App server (internal)            |
| oauth2-proxy      | `http://127.0.0.1:4180` | Session management (internal)    |
| Dex               | `http://localhost:5556/dex` | OIDC identity provider       |

## Configuration Files

| File                      | Description                                      |
|---------------------------|--------------------------------------------------|
| `dex/config.yaml`         | Dex OIDC provider config (clients, users)        |
| `nginx/nginx.conf`        | nginx reverse proxy with `auth_request` forward auth |
| `scripts/start-auth.sh`   | Starts the full auth stack                       |
| `scripts/stop-auth.sh`    | Gracefully stops the auth stack                  |

## Security Note

All secrets in these configuration files (`questionnaire-dev-secret`,
`devlockcookiekey`) are **hard-coded, insecure, and intended for local
development only**.  Never use these values in production.

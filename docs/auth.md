# Authentication & Authorisation

## Overview

This service does **not** handle credentials, passwords, sessions, or tokens.
Authentication is delegated entirely to an nginx reverse proxy running Authelia forward-auth.
The service is auth-agnostic: it trusts the identity headers injected by the proxy and uses them for ownership and permission checks only.

---

## Deployment Topology

```
Internet
  │
  ▼
nginx  (TLS termination, rate limiting)
  │  auth_request → Authelia
  │  strips untrusted Remote-* headers from client
  │  injects Remote-User / Remote-Name / Remote-Email / Remote-Groups after auth
  ▼
questionnaire service  (binds to 127.0.0.1:3000)
```

**Key invariants:**

* nginx MUST strip any incoming `Remote-User`, `Remote-Name`, `Remote-Email`, and `Remote-Groups` headers sent by untrusted clients **before** forwarding them to the application.
* The service binds to `127.0.0.1` in production so it cannot be reached without going through the proxy.
* If a request reaches the service without the expected identity headers, it is processed as the built-in guest user. The guest user has no group memberships and no ownership privileges, so protected endpoints (those wrapped in `requireAuth` or per-resource ACL checks) will still reject the request with `401` or `403` as appropriate.
* Deployments that prefer to reject unauthenticated requests outright as defense-in-depth can opt in to the `requireProxyAuth` middleware (see `src/web/middleware/auth.ts`).

---

## Identity Headers

| Header           | Set by         | Purpose                                    |
|------------------|----------------|--------------------------------------------|
| `Remote-User`    | Authelia/nginx | Primary identity — the user's email        |
| `Remote-Name`    | Authelia/nginx | Display name                               |
| `Remote-Email`   | Authelia/nginx | Fallback email (used only when `Remote-User` is absent) |
| `Remote-Groups`  | Authelia/nginx | Comma-separated list of group memberships  |

**Header resolution order** per request:

1. `Remote-User` (preferred) — set by Authelia after forward-auth succeeds
2. `Remote-Email` — fallback for oauth2-proxy deployments that use this header instead
3. `DEV_STUB_USER` environment variable — development-only stub (ignored in production)
4. Guest sentinel — used when none of the above are present (no auth headers, no stub)

The service reads these headers in `src/web/middleware/auth.ts` via the `loadUser` middleware.
User records are provisioned just-in-time on the first authenticated request.
All emails from headers are normalised to lowercase before storage or comparison.

---

## Example nginx Configuration

```nginx
# /etc/nginx/sites-enabled/questionnaire.conf

upstream questionnaire {
    server 127.0.0.1:3000;
}

server {
    listen 443 ssl http2;
    server_name questionnaire.example.com;

    # TLS configuration (Let's Encrypt / your CA)
    ssl_certificate     /etc/letsencrypt/live/questionnaire.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/questionnaire.example.com/privkey.pem;

    # ── Strip proxy headers from untrusted clients ──────────────────────────
    # CRITICAL: prevents header spoofing by malicious clients
    proxy_set_header Remote-User   "";
    proxy_set_header Remote-Name   "";
    proxy_set_header Remote-Email  "";
    proxy_set_header Remote-Groups "";

    # ── Authelia forward auth ────────────────────────────────────────────────
    location /authelia {
        internal;
        proxy_pass http://127.0.0.1:9091/api/verify;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URL $scheme://$http_host$request_uri;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        # Require Authelia authentication for every request
        auth_request /authelia;

        # Inject identity headers from Authelia's response
        auth_request_set $remote_user   $upstream_http_remote_user;
        auth_request_set $remote_name   $upstream_http_remote_name;
        auth_request_set $remote_groups $upstream_http_remote_groups;

        proxy_set_header Remote-User   $remote_user;
        proxy_set_header Remote-Name   $remote_name;
        proxy_set_header Remote-Groups $remote_groups;

        # Pass the real client IP so the app can log it
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP       $remote_addr;

        proxy_pass http://questionnaire;
    }
}
```

---

## Example Authelia Access Control Rules

```yaml
# authelia/configuration.yml (access_control section)

access_control:
  default_policy: deny

  rules:
    # Allow all authenticated users to access the questionnaire service
    - domain: questionnaire.example.com
      policy: one_factor          # or two_factor for higher assurance

    # Allow only the 'admins' group to access admin-only API endpoints
    - domain: questionnaire.example.com
      resources:
        - "^/api/users.*"
      subject: "group:admins"
      policy: one_factor
```

Adjust `policy` values and `subject` filters to match your organisation's requirements.

---

## OIDC / oauth2-proxy (if OIDC tokens are required)

If downstream services require a valid OIDC access token (e.g., to call a protected API on behalf of the user), deploy oauth2-proxy in front of the service alongside (or instead of) Authelia.

```
nginx → oauth2-proxy → Dex (OIDC IdP) → questionnaire service
```

oauth2-proxy injects the access token in the `X-Forwarded-Access-Token` header after authentication. The service can read this header if it needs to make downstream API calls:

```typescript
const accessToken = req.headers['x-forwarded-access-token'];
// Pass accessToken to downstream service in Authorization: Bearer header
```

> **Important**: Never log the access token. The audit logging in this service logs only the principal email (`Remote-User`), never tokens or credentials.

---

## Environment Variables

| Variable             | Default          | Description                                                              |
|----------------------|------------------|--------------------------------------------------------------------------|
| `NODE_ENV`           | `development`    | Set to `production` for production-style binding (127.0.0.1) and logging |
| `REQUIRE_PROXY_AUTH` | (unset)          | Reserved for the optional `requireProxyAuth` middleware (not registered by default) |
| `DEV_STUB_USER`      | (unset)          | Development-only stub identity (ignored in production; see below)        |
| `ADMIN_GROUP`        | `admins`         | Name of the group whose members have admin privileges                    |
| `PORT`               | `3000`           | TCP port the server listens on                                           |

---

## Running Locally Without the Full Auth Stack

Set the `DEV_STUB_USER` environment variable to inject a fake identity:

```bash
# Format: "email:Display Name:group1,group2"
export DEV_STUB_USER="dev@example.com:Developer:admins"
npm run dev
```

The stub identity is used when `Remote-User` / `Remote-Email` headers are absent.
`DEV_STUB_USER` is **silently ignored** when `NODE_ENV=production` or `REQUIRE_PROXY_AUTH=true`.

If neither proxy headers nor `DEV_STUB_USER` are present, the request is processed with the
`guest` sentinel identity, which has no group memberships and therefore no ownership or admin privileges.

---

## Production Checklist

- [ ] nginx strips `Remote-User`, `Remote-Name`, `Remote-Email`, `Remote-Groups` from client requests
- [ ] Authelia `auth_request` is configured and injects headers on success
- [ ] The service is bound to `127.0.0.1` (automatic when `NODE_ENV=production`)
- [ ] `DEV_STUB_USER` is **not** set in production
- [ ] Audit logs show `[auth] principal="..."` lines for every request
- [ ] (Optional) Register the `requireProxyAuth` middleware if you want to reject unauthenticated requests outright instead of treating them as guest

---

## Threat Model

| Threat                                   | Mitigation                                                                           |
|------------------------------------------|--------------------------------------------------------------------------------------|
| Client spoofs identity headers           | nginx strips `Remote-*` headers from untrusted clients before forwarding             |
| Request bypasses nginx                   | Service binds to `127.0.0.1`; unauthenticated requests are processed as the unprivileged guest identity (or rejected with 401 if `requireProxyAuth` is enabled) |
| Token leakage via logs                   | Only the principal email is logged; tokens and passwords are never logged            |
| Privilege escalation via group spoofing  | Groups are injected by Authelia only after authentication; clients cannot set them   |

**Non-goals** (intentionally out of scope for this service):

* Password storage, hashing, or complexity rules
* MFA, account lockout, or password reset flows
* OIDC/OAuth2 client implementation
* User account management or session handling inside the application

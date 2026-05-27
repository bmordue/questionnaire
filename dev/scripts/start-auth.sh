#!/usr/bin/env bash
# start-auth.sh — start the local authentication stack for development
#
# Starts (in order):
#   1. Dex      — OIDC identity provider   (http://localhost:5556/dex)
#   2. oauth2-proxy — session/cookie broker (http://127.0.0.1:4180)
#   3. nginx    — reverse proxy + forward auth (http://localhost:8080)
#
# Run the questionnaire web server separately first:
#   pnpm run build && pnpm run web   # (listens on port 3000)
#
# Then browse to http://localhost:8080 to exercise the full auth flow.
#
# Logs are written to /tmp/questionnaire-dev/logs/
# PIDs are stored in  /tmp/questionnaire-dev/pids/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEV_DIR="$PROJECT_DIR/dev"

TMP_DIR="/tmp/questionnaire-dev"
PID_DIR="$TMP_DIR/pids"
LOG_DIR="$TMP_DIR/logs"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# ── Prerequisite check ────────────────────────────────────────────────────────

for cmd in dex nginx oauth2-proxy curl; do
    if ! command -v "$cmd" > /dev/null 2>&1; then
        echo "ERROR: '$cmd' not found. Make sure you are inside the Nix devshell:"
        echo "  nix develop"
        echo "  # or, with nix-direnv: direnv allow"
        exit 1
    fi
done

# ── Create runtime directories ────────────────────────────────────────────────

mkdir -p \
    "$PID_DIR" \
    "$LOG_DIR" \
    "$TMP_DIR/dex" \
    "$TMP_DIR/nginx/client_body_temp" \
    "$TMP_DIR/nginx/proxy_temp" \
    "$TMP_DIR/nginx/fastcgi_temp" \
    "$TMP_DIR/nginx/uwsgi_temp" \
    "$TMP_DIR/nginx/scgi_temp"

# ── Helper: wait for an HTTP endpoint ────────────────────────────────────────

wait_for_http() {
    local url="$1"
    local timeout="${2:-30}"
    local elapsed=0
    local interval=1

    while ! curl -sf --max-time 2 "$url" > /dev/null 2>&1; do
        if [ "$elapsed" -ge "$timeout" ]; then
            return 1
        fi
        sleep "$interval"
        elapsed=$((elapsed + interval))
    done
    return 0
}

# ── Helper: stop a previously-started service ────────────────────────────────

stop_if_running() {
    local name="$1"
    local pid_file="$PID_DIR/$name.pid"
    if [ -f "$pid_file" ]; then
        local pid
        pid="$(cat "$pid_file")"
        if kill -0 "$pid" 2>/dev/null; then
            log "Stopping existing $name (pid $pid)…"
            kill "$pid" 2>/dev/null || true
            sleep 1
        fi
        rm -f "$pid_file"
    fi
}

# Stop any services left over from a previous run
stop_if_running dex
stop_if_running oauth2-proxy

# nginx uses its own pid file
NGINX_PID_FILE="$TMP_DIR/nginx/nginx.pid"
if [ -f "$NGINX_PID_FILE" ]; then
    nginx -c "$DEV_DIR/nginx/nginx.conf" -s stop 2>/dev/null || true
    sleep 1
fi

# ── 1. Start Dex ──────────────────────────────────────────────────────────────

log "Starting Dex (OIDC IdP)…"
dex serve "$DEV_DIR/dex/config.yaml" \
    > "$LOG_DIR/dex.log" 2>&1 &
echo $! > "$PID_DIR/dex.pid"

if wait_for_http "http://localhost:5556/dex/.well-known/openid-configuration" 30; then
    log "✓ Dex is ready at http://localhost:5556/dex"
else
    log "✗ Dex failed to start within 30 s. Check $LOG_DIR/dex.log"
    cat "$LOG_DIR/dex.log" >&2
    exit 1
fi

# ── 2. Start oauth2-proxy ────────────────────────────────────────────────────
#
# oauth2-proxy sits between nginx's auth_request and Dex.  It:
#   • manages browser session cookies
#   • performs the OIDC code exchange with Dex
#   • returns X-Auth-Request-{Email,User,Groups} headers on successful auth
#
# --upstream=static://202  means oauth2-proxy itself does not proxy traffic;
#   nginx handles the actual request forwarding to port 3000.
#
# Cookie notes (dev-only):
#   --cookie-secure=false  required because we are on plain HTTP
#   --cookie-secret        must be exactly 16, 24, or 32 bytes
#   The values below are INSECURE and intended for local development only.

log "Starting oauth2-proxy…"
oauth2-proxy \
    --provider=oidc \
    --oidc-issuer-url=http://localhost:5556/dex \
    --client-id=questionnaire-dev \
    --client-secret=questionnaire-dev-secret \
    --redirect-url=http://localhost:8080/oauth2/callback \
    --upstream=static://202 \
    --email-domain='*' \
    --cookie-name=_questionnaire_dev \
    --cookie-secret=devlockcookiekey \
    --cookie-secure=false \
    --http-address=127.0.0.1:4180 \
    --set-xauthrequest=true \
    --pass-access-token=false \
    --scope='openid email profile' \
    --skip-provider-button=true \
    > "$LOG_DIR/oauth2-proxy.log" 2>&1 &
echo $! > "$PID_DIR/oauth2-proxy.pid"

if wait_for_http "http://127.0.0.1:4180/ping" 30; then
    log "✓ oauth2-proxy is ready at http://127.0.0.1:4180"
else
    log "✗ oauth2-proxy failed to start within 30 s. Check $LOG_DIR/oauth2-proxy.log"
    cat "$LOG_DIR/oauth2-proxy.log" >&2
    exit 1
fi

# ── 3. Start nginx ────────────────────────────────────────────────────────────

log "Starting nginx…"
nginx -c "$DEV_DIR/nginx/nginx.conf"

if wait_for_http "http://localhost:8080" 10; then
    log "✓ nginx is ready at http://localhost:8080"
else
    log "✗ nginx failed to start. Check $TMP_DIR/nginx/error.log"
    cat "$TMP_DIR/nginx/error.log" >&2
    exit 1
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "┌─ Auth stack running ─────────────────────────────────────────────────┐"
echo "│                                                                        │"
echo "│  Entry point:  http://localhost:8080                                  │"
echo "│  Dex UI:       http://localhost:5556/dex                              │"
echo "│                                                                        │"
echo "│  Test users (password: 'password'):                                   │"
echo "│    admin@example.com                                                  │"
echo "│    user@example.com                                                   │"
echo "│                                                                        │"
echo "│  Note: Dex static users have no group memberships.                   │"
echo "│  To test admin flows set ADMIN_GROUP to an empty string, or use      │"
echo "│  DEV_STUB_USER instead (see docs/auth.md).                           │"
echo "│                                                                        │"
echo "│  Logs:                                                                 │"
echo "│    Dex:          $LOG_DIR/dex.log"
echo "│    oauth2-proxy: $LOG_DIR/oauth2-proxy.log"
echo "│    nginx access: $TMP_DIR/nginx/access.log"
echo "│    nginx error:  $TMP_DIR/nginx/error.log"
echo "│                                                                        │"
echo "│  To stop:  ./dev/scripts/stop-auth.sh                                │"
echo "│                                                                        │"
echo "└────────────────────────────────────────────────────────────────────────┘"

#!/usr/bin/env bash
# stop-auth.sh — stop the local authentication stack
#
# Gracefully stops nginx, oauth2-proxy, and Dex.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEV_DIR="$PROJECT_DIR/dev"

TMP_DIR="/tmp/questionnaire-dev"
PID_DIR="$TMP_DIR/pids"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

stopped_any=false

# ── nginx ─────────────────────────────────────────────────────────────────────

NGINX_PID_FILE="$TMP_DIR/nginx/nginx.pid"
if [ -f "$NGINX_PID_FILE" ] && kill -0 "$(cat "$NGINX_PID_FILE")" 2>/dev/null; then
    log "Stopping nginx…"
    nginx -c "$DEV_DIR/nginx/nginx.conf" -s stop 2>/dev/null || true
    stopped_any=true
fi

# ── oauth2-proxy ──────────────────────────────────────────────────────────────

OAUTH2_PROXY_PID_FILE="$PID_DIR/oauth2-proxy.pid"
if [ -f "$OAUTH2_PROXY_PID_FILE" ]; then
    pid="$(cat "$OAUTH2_PROXY_PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
        log "Stopping oauth2-proxy (pid $pid)…"
        kill "$pid"
        stopped_any=true
    fi
    rm -f "$OAUTH2_PROXY_PID_FILE"
fi

# ── Dex ───────────────────────────────────────────────────────────────────────

DEX_PID_FILE="$PID_DIR/dex.pid"
if [ -f "$DEX_PID_FILE" ]; then
    pid="$(cat "$DEX_PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
        log "Stopping Dex (pid $pid)…"
        kill "$pid"
        stopped_any=true
    fi
    rm -f "$DEX_PID_FILE"
fi

# ── Result ────────────────────────────────────────────────────────────────────

if $stopped_any; then
    log "Auth stack stopped."
else
    log "No auth stack services were running."
fi

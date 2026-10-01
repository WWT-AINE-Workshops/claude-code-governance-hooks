#!/usr/bin/env bash
set -euo pipefail

repo_root() { git rev-parse --show-toplevel 2>/dev/null || pwd; }

# Settings generated from workshop.config.json by the build (see build/participant/workshop-env.mjs).
_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$_COMMON_DIR/../workshop.env" ] || { printf 'scripts/workshop.env is missing. Get a fresh copy of the workshop repository.\n' >&2; exit 1; }
source "$_COMMON_DIR/../workshop.env"
# WORKSHOP_UPSTREAM_OVERRIDE replaces the upstream URL (tests and the walkthrough point it at a local repo).
UPSTREAM="${WORKSHOP_UPSTREAM_OVERRIDE:-${WORKSHOP_UPSTREAM}}"
LAB_COUNT="${WORKSHOP_LAB_COUNT}"
PORTS="${WORKSHOP_PORTS}"
# "owner/repo" of the workshop repository itself, from its URL.
UPSTREAM_REPO="$(printf '%s\n' "$WORKSHOP_UPSTREAM" | sed -E 's#^https?://[^/]+/##; s#/+$##; s#\.git$##')"
FAILED=0

ok() { printf '✅ %s\n' "$1"; }
warn() { printf '⚠️  %s — %s\n' "$1" "$2"; }
fail_check() { printf '❌ %s — %s\n' "$1" "$2"; FAILED=1; }
die() { printf '%s\n' "$1" >&2; exit 1; }

version_ge() {
  [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

# node_supported VERSION: whether VERSION meets the engines floor in lib/versions.env (source it first). The defaults
# are the same floor, for a workshop whose versions.env predates these keys.
node_supported() {
  local major="${1%%.*}"
  { [ "$major" = 22 ] && version_ge "$1" "${NODE_MIN_22:-22.22.2}"; } ||
    { [ "$major" = 24 ] && version_ge "$1" "${NODE_MIN_24:-24.15.0}"; } ||
    [ "$major" -ge "${NODE_MIN_OPEN_MAJOR:-26}" ] 2>/dev/null
}

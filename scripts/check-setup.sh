#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/lib/common.sh"
set +e
source "$HERE/lib/versions.env"
cd "$HERE/.."

LIVE=0
[ "${1:-}" = "--live" ] && LIVE=1
OS="$(uname -s)"
hint() { if [ "$OS" = "Darwin" ]; then echo "$1"; else echo "$2"; fi; }

NODE_HINT="install Node 24 LTS (24.15 or later) from https://nodejs.org/en/download, then open a new terminal"
[ "$OS" = "Darwin" ] && NODE_HINT="$NODE_HINT (or: brew install node@24 && brew link --overwrite --force node@24)"

echo "Checking your computer for ${WORKSHOP_NAME}…"
echo

# A workshop with no app has nothing to run: skip Node, npm and Playwright. git, gh and the
# profile's checks (check-setup.d) still apply.
APP="${WORKSHOP_APP:-}"

if [ "$APP" = none ]; then
  :
elif command -v node >/dev/null 2>&1; then
  NODE_V="$(node -p process.versions.node 2>/dev/null)"
  if [ -z "$NODE_V" ]; then
    fail_check "Could not read the Node.js version" "$NODE_HINT"
  elif node_supported "$NODE_V"; then
    ok "Node.js $NODE_V"
  else
    fail_check "Node.js $NODE_V is not supported" "$NODE_HINT"
  fi
else
  fail_check "Node.js not found" "$NODE_HINT"
fi

if [ "$APP" = none ]; then
  :
elif command -v npm >/dev/null 2>&1; then
  NPM_V="$(npm --version 2>/dev/null)"
  if [ "${NPM_V%%.*}" -ge "${NPM_MIN_MAJOR:-11}" ] 2>/dev/null; then ok "npm ${NPM_V}"; else fail_check "npm ${NPM_V:-(unknown version)} is older than ${NPM_MIN_MAJOR:-11}" "run: npm install -g npm@${NPM_MIN_MAJOR:-11}"; fi
else fail_check "npm not found" "it comes with Node.js; reinstall Node 24 LTS"; fi

if command -v git >/dev/null 2>&1; then
  GIT_V="$(git --version | awk '{print $3}')"
  if version_ge "$GIT_V" "$GIT_MIN_VERSION"; then ok "git $GIT_V"; else fail_check "git $GIT_V is too old (need $GIT_MIN_VERSION+)" "$(hint 'brew install git' 'sudo apt-get install git')"; fi
else
  fail_check "git not found" "$(hint 'xcode-select --install' 'sudo apt-get install git')"
fi

# Topic checks (for example the Claude Code version) live in check-setup.d/*.sh and are sourced here.
for hook in "$HERE"/check-setup.d/*.sh; do
  [ -f "$hook" ] && source "$hook"
done

# Playwright's Chromium only for an app with browser tests (WORKSHOP_PLAYWRIGHT, from the starter's checkSetup).
if [ "$APP" = none ] || [ "${WORKSHOP_PLAYWRIGHT:-1}" = 0 ]; then
  :
elif [ -d node_modules ]; then
  if node scripts/lib/playwright-path.cjs >/dev/null 2>&1; then ok "Playwright Chromium"
  else fail_check "Playwright Chromium not installed" "run: $(hint 'npx playwright install chromium' 'npx playwright install --with-deps chromium')"; fi
else
  warn "Playwright Chromium not checked" "run npm install first, then run this again"
fi

if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then ok "GitHub CLI signed in"
  else fail_check "GitHub CLI (gh) not signed in" "run: gh auth login (needed to create your copy of the workshop repository)"; fi
else
  fail_check "GitHub CLI (gh) not found" "$(hint 'brew install gh' 'see https://cli.github.com'), then gh auth login (needed to create your copy of the workshop repository)"
fi

if command -v git >/dev/null 2>&1; then
  if [ -z "$(git config user.name 2>/dev/null)" ] || [ -z "$(git config user.email 2>/dev/null)" ]; then
    warn "git doesn't know who you are" 'run: git config --global user.name "Your Name" && git config --global user.email you@example.com'
  fi
fi

for port in $PORTS; do
  if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    warn "Port $port is in use" "stop whatever is using it before you start the app"
  fi
done

echo
if [ "$FAILED" = 0 ]; then echo "Ready for the workshop."; exit 0; fi
echo "Fix the ❌ items above, then run this again."
exit 1

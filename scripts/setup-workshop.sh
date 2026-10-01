#!/usr/bin/env bash
# Sets up your copy of the workshop repository. Run it from the repository folder right after
# `git clone <workshop url> <folder>` and `cd <folder>`. It asks before each step that changes anything.
# It never installs a tool, never uses sudo, never changes your global git config, never stops a process,
# and removes nothing but the clone's `origin` pointer to the workshop repository.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# workshop.env sets this only when a lab uses it; never take it from the caller's shell.
WORKSHOP_PR_BASE_LABS=''
source "$HERE/lib/common.sh"
source "$HERE/lib/versions.env"
cd "$HERE/.."

usage() {
  cat <<'EOF'
Usage: ./scripts/setup-workshop.sh [--yes] [--name <repo-name>] [--help]

Sets up your copy of the workshop repository, one step at a time. It explains each step and asks
before it changes anything. Tools are not installed for you: if one is missing, it says how to
install it and stops.

  --yes               answer yes to every question
  --name <repo-name>  the name of your private copy on GitHub (default: my-<workshop repository name>)
  --help              show this help
EOF
}

YES=0
NAME=''
while [ $# -gt 0 ]; do
  case "$1" in
    --yes | -y) YES=1 ;;
    --name)
      if [ $# -lt 2 ] || [ -z "$2" ]; then
        usage >&2
        exit 2
      fi
      NAME="$2"
      shift
      ;;
    --name=*) NAME="${1#--name=}" ;;
    --help | -h)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

valid_name() { [ -n "$1" ] && case "$1" in *[!A-Za-z0-9._-]* | .* | -*) false ;; *) true ;; esac; }
if [ -n "$NAME" ] && ! valid_name "$NAME"; then
  printf 'Not a valid repository name: %s (use letters, digits, ".", "-" and "_")\n' "$NAME" >&2
  exit 2
fi

# Answers come from the terminal. WORKSHOP_SETUP_STDIN=1 reads them from stdin instead (the tests use it).
if [ "$YES" = 0 ] && [ ! -t 0 ] && [ "${WORKSHOP_SETUP_STDIN:-0}" != 1 ]; then
  echo "This script asks before each step, and there is no terminal to ask in." >&2
  echo "Run it in a terminal window, or run ./scripts/setup-workshop.sh --yes to answer yes to every step." >&2
  exit 1
fi

git rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
  die "This folder is not a git repository. Clone the workshop repository first, then run this inside it."

OS="$(uname -s)"
case "$OS" in
  Darwin) OS=mac ;;
  MINGW* | MSYS* | CYGWIN*) OS=windows ;;
  *) OS=linux ;;
esac
# hint MAC LINUX [WINDOWS]: the text for this computer. The profile's check-setup.d hooks call it with two.
hint() {
  case "$OS" in
    mac) printf '%s\n' "$1" ;;
    windows) printf '%s\n' "${3:-$2}" ;;
    *) printf '%s\n' "$2" ;;
  esac
}

APP="${WORKSHOP_APP:-}"
STATE_DIR="$(git rev-parse --git-dir)/workshop-setup"
DEFAULT_NAME="my-${UPSTREAM_REPO##*/}"
STEP_TITLES=()
STEP_RESULTS=()
NPM_RAN=0
COPY_OK=0
# The next thing to do after setup. A profile's check-setup.d hook may set its own.
SETUP_NEXT_STEP=''

heading() { printf '\n== Step %s of 7: %s ==\n' "$1" "$2"; }
record() {
  STEP_TITLES+=("$1")
  STEP_RESULTS+=("$2")
}
mark_done() {
  mkdir -p "$STATE_DIR"
  printf '%s\n' "${2:-done}" >"$STATE_DIR/$1"
}

# ask: "Run it? [Y/n]". Yes with --yes; Enter means yes.
ask() {
  local answer
  if [ "$YES" = 1 ]; then
    echo "Run it? [Y/n] yes (--yes)"
    return 0
  fi
  while true; do
    printf 'Run it? [Y/n] '
    if ! IFS= read -r answer; then
      echo
      return 1
    fi
    case "$answer" in
      '' | y | Y | yes | Yes | YES) return 0 ;;
      n | N | no | No | NO) return 1 ;;
      *) echo 'Please answer y or n.' ;;
    esac
  done
}

# ask_name: the name of the private copy (the default unless the user types another).
ask_name() {
  local answer
  REPO_NAME="${NAME:-$DEFAULT_NAME}"
  if [ "$YES" = 1 ] || [ -n "$NAME" ]; then
    echo "Name of your private copy: ${REPO_NAME}"
    return 0
  fi
  while true; do
    printf 'Name of your private copy [%s]: ' "$REPO_NAME"
    IFS= read -r answer || answer=''
    [ -z "$answer" ] && return 0
    if valid_name "$answer"; then
      REPO_NAME="$answer"
      return 0
    fi
    echo 'Use letters, digits, ".", "-" and "_" only.'
  done
}

summary() {
  local i failed=0 skipped=''
  printf '\n== Summary ==\n'
  i=0
  while [ "$i" -lt "${#STEP_TITLES[@]}" ]; do
    printf '  %-34s %s\n' "${STEP_TITLES[$i]}" "${STEP_RESULTS[$i]}"
    case "${STEP_RESULTS[$i]}" in
      failed*) failed=1 ;;
      skipped*) skipped="${skipped}  ${STEP_TITLES[$i]}
" ;;
    esac
    i=$((i + 1))
  done
  echo
  if [ "$failed" = 1 ]; then
    echo "Fix the failed step, then run ./scripts/setup-workshop.sh again. Steps that are done are skipped."
    return 1
  fi
  if [ -n "$skipped" ]; then
    echo "Setup finished, with skipped steps:"
    printf '%s' "$skipped"
    echo "Do them by hand from workshop/pre-work.md, or run ./scripts/setup-workshop.sh again."
    return 0
  fi
  echo "Next: ${SETUP_NEXT_STEP:-you are ready for the session. The workshop guide is workshop/README.md.}"
  echo "Setup finished."
}

stop() {
  summary || true
  exit 1
}

# ---------- 1. tools ----------

GIT_HINT="$(hint 'run: xcode-select --install (or: brew install git)' 'run: sudo apt-get install git (or use your package manager)' 'run: winget install --id Git.Git -e (or download it from https://git-scm.com/download/win), then open a new Git Bash window')"
NODE_HINT="$(hint 'install Node 24 LTS: brew install node@24 && brew link --overwrite --force node@24 (or download it from https://nodejs.org/en/download), then open a new terminal' 'install Node 24 LTS with nvm, as https://nodejs.org/en/download shows, then run: nvm install 24' 'run: winget install --id OpenJS.NodeJS.LTS -e (or download Node 24 LTS from https://nodejs.org/en/download), then open a new Git Bash window')"
GH_HINT="$(hint 'run: brew install gh (or download it from https://cli.github.com), then gh auth login' 'see https://github.com/cli/cli/blob/trunk/docs/install_linux.md, then run: gh auth login' 'run: winget install --id GitHub.cli -e (or download it from https://cli.github.com), open a new Git Bash window, then run: gh auth login')"

check_tools() {
  local v
  if command -v git >/dev/null 2>&1; then
    v="$(git --version | awk '{print $3}')"
    if version_ge "$v" "$GIT_MIN_VERSION"; then ok "git ${v}"; else fail_check "git ${v} is too old (need ${GIT_MIN_VERSION} or later)" "$GIT_HINT"; fi
  else
    fail_check "git not found" "$GIT_HINT"
  fi
  if [ "$APP" != none ]; then
    if command -v node >/dev/null 2>&1; then
      v="$(node -p process.versions.node 2>/dev/null)"
      if [ -n "$v" ] && node_supported "$v"; then ok "Node.js ${v}"; else fail_check "Node.js ${v:-(unknown version)} is not supported (need ${NODE_MIN_22:-22.22.2}+, ${NODE_MIN_24:-24.15.0}+ or ${NODE_MIN_OPEN_MAJOR:-26}+)" "$NODE_HINT"; fi
    else
      fail_check "Node.js not found" "$NODE_HINT"
    fi
    if command -v npm >/dev/null 2>&1; then
      v="$(npm --version 2>/dev/null)"
      if [ "${v%%.*}" -ge "${NPM_MIN_MAJOR:-11}" ] 2>/dev/null; then ok "npm ${v}"; else fail_check "npm ${v:-(unknown version)} is older than ${NPM_MIN_MAJOR:-11}" "run: npm install -g npm@${NPM_MIN_MAJOR:-11}"; fi
    else
      fail_check "npm not found" "it comes with Node.js: $NODE_HINT"
    fi
  fi
  if command -v gh >/dev/null 2>&1; then
    if gh auth status >/dev/null 2>&1; then ok "GitHub CLI signed in"; else fail_check "GitHub CLI (gh) not signed in" "run: gh auth login"; fi
  else
    fail_check "GitHub CLI (gh) not found" "$GH_HINT"
  fi
  # The profile's checks (for example its main tool), as check-setup.sh runs them. --live is never used here.
  LIVE=0
  for hook in "$HERE"/check-setup.d/*.sh; do
    [ -f "$hook" ] && source "$hook"
  done
  return 0
}

step_tools() {
  heading 1 "Check your tools"
  echo "This only reads: it checks that the tools the workshop needs are installed and signed in."
  echo "It installs nothing. If something is missing, it shows how to install it and stops."
  set +e
  check_tools
  set -e
  if [ "$FAILED" != 0 ]; then
    echo
    echo "Install what is marked with a cross, open a new terminal window, then run ./scripts/setup-workshop.sh again."
    record "1. Check your tools" "failed: a tool is missing"
    stop
  fi
  record "1. Check your tools" "done"
}

# ---------- 2. the private copy ----------

# The owner/name in a GitHub URL (https, ssh or scp form), in lower case.
repo_of() { printf '%s\n' "$1" | sed -E 's#^(https?://([^/@]*@)?[^/]+/|ssh://([^/@]*@)?[^/]+/|[^/@]*@[^:/]+:)##; s#/+$##; s#\.git$##' | tr '[:upper:]' '[:lower:]'; }
trim_url() { printf '%s\n' "$1" | sed -E 's#/+$##; s#\.git$##'; }
is_upstream() {
  [ "$(trim_url "$1")" = "$(trim_url "$UPSTREAM")" ] || [ "$(trim_url "$1")" = "$(trim_url "$WORKSHOP_UPSTREAM")" ] ||
    [ "$(repo_of "$1")" = "$(printf '%s\n' "$UPSTREAM_REPO" | tr '[:upper:]' '[:lower:]')" ]
}

why_not_fork() {
  echo "Why a private copy and not a fork: a fork of a public repository is public, and GitHub does not let"
  echo "you make it private. In a fork, gh can pick the workshop repository instead of yours. Some companies"
  echo "do not allow forks at all. And nothing needs the link back to the workshop repository."
}

# Whether origin has remote-tracking refs, that is, something was pushed to it or fetched from it. Works offline.
has_tracking() { [ -n "$(git for-each-ref --format='%(refname)' refs/remotes/origin 2>/dev/null)" ]; }

# A plain warning when the copy is a public fork. Needs gh and the network; any failure skips it quietly.
warn_public_fork() {
  local info
  info="$(gh repo view "$1" --json isFork,visibility --jq '"\(.isFork) \(.visibility)"' 2>/dev/null)" || return 0
  if [ "$info" = "true PUBLIC" ]; then
    warn "Your copy ${1} is a public fork" "anyone can see your work there. Consider a private copy instead (see workshop/pre-work.md). This script changes nothing about it"
  fi
  return 0
}

# offer_push: origin is set and nothing has been pushed to it. Offer git push -u origin HEAD.
offer_push() {
  local origin="$1"
  echo "origin points at ${origin}, but nothing has been pushed to it yet: the repository was probably"
  echo "created and the push failed. This will push your current branch to it (git push -u origin HEAD)."
  echo "It changes no files. git may ask you to sign in."
  if ! ask; then
    record "2. Make your private copy" "skipped: not pushed"
    return 0
  fi
  if ! git push -u origin HEAD; then
    echo
    echo "The push failed: the message above says why (often a missing sign-in: run gh auth login, and answer"
    echo "yes to authenticating git). Nothing was retried. Fix it, then run: git push -u origin HEAD"
    record "2. Make your private copy" "failed: git push"
    stop
  fi
  COPY_OK=1
  ok "Your private copy: ${origin}"
  record "2. Make your private copy" "done"
}

# After gh repo create failed: say what state the clone is in, and the command that finishes the job.
explain_create_failure() {
  local out="$1" origin login
  origin="$(git config --get remote.origin.url 2>/dev/null || true)"
  echo
  if [ -n "$origin" ]; then
    echo "gh created your repository and set origin to it (${origin}), but the push failed: the message"
    echo "above says why. Nothing was retried. Fix it, then run: git push -u origin HEAD"
    echo "(or run ./scripts/setup-workshop.sh again: it offers the push)."
    return 0
  fi
  echo "Creating your private copy failed: the message above says why. Nothing was retried."
  echo "Fix it, then run the command yourself:"
  echo "  gh repo create ${REPO_NAME} --private --source . --remote origin --push"
  echo "or run ./scripts/setup-workshop.sh --name <another-name> again."
  if printf '%s\n' "$out" | grep -qi 'already exists'; then
    login="$(gh api user -q .login 2>/dev/null || true)"
    [ -n "$login" ] || login='<your user name>'
    echo "If that repository is the one an earlier run created (for example one you stopped), connect it instead:"
    echo "  git remote add origin https://github.com/${login}/${REPO_NAME}.git"
    echo "  git push -u origin HEAD"
  fi
}

step_copy() {
  local origin out
  heading 2 "Make your private copy on GitHub"
  origin="$(git config --get remote.origin.url 2>/dev/null || true)"
  if [ -n "$origin" ] && ! is_upstream "$origin"; then
    [ -n "$NAME" ] && echo "--name ${NAME} is ignored: origin is already set."
    if has_tracking; then
      echo "Already done: origin points at ${origin}, not at the workshop repository."
      COPY_OK=1
      warn_public_fork "$(repo_of "$origin")"
      record "2. Make your private copy" "already done"
      return 0
    fi
    offer_push "$origin"
    return 0
  fi
  if [ -n "$origin" ]; then
    echo "Your clone's origin points at the workshop repository (${origin})."
    echo "This will remove only that pointer (git remote remove origin): no commits, branches, tags or files are"
    echo "removed. Then it creates a private repository in your GitHub account, sets origin to it and pushes your"
    echo "current branch to it (gh repo create <name> --private --source . --remote origin --push)."
  else
    echo "Your clone has no origin remote."
    echo "This will create a private repository in your GitHub account, set origin to it and push your current"
    echo "branch to it (gh repo create <name> --private --source . --remote origin --push)."
  fi
  why_not_fork
  if ! ask; then
    record "2. Make your private copy" "skipped"
    return 0
  fi
  ask_name
  [ -n "$origin" ] && git remote remove origin
  if ! out="$(gh repo create "$REPO_NAME" --private --source . --remote origin --push 2>&1)"; then
    printf '%s\n' "$out" >&2
    explain_create_failure "$out"
    record "2. Make your private copy" "failed: gh repo create"
    stop
  fi
  printf '%s\n' "$out"
  origin="$(git config --get remote.origin.url 2>/dev/null || true)"
  if [ -z "$origin" ]; then
    echo "gh repo create finished, but origin is not set. Run: gh repo create ${REPO_NAME} --private --source . --remote origin --push"
    record "2. Make your private copy" "failed: origin not set"
    stop
  fi
  if ! has_tracking; then
    echo "gh repo create finished, but nothing was pushed to ${origin}. Run: git push -u origin HEAD"
    record "2. Make your private copy" "failed: not pushed"
    stop
  fi
  COPY_OK=1
  ok "Your private copy: ${origin}"
  record "2. Make your private copy" "done"
}

# ---------- 3 and 4. the app's packages and setup ----------

has_app() { [ "$APP" != none ] && [ -f package.json ]; }

step_npm_ci() {
  heading 3 "Install the project's packages"
  if ! has_app; then
    echo "Not needed: this workshop has no app to install."
    record "3. npm ci" "not needed"
    return 0
  fi
  if [ -f node_modules/.package-lock.json ] && [ ! package-lock.json -nt node_modules/.package-lock.json ]; then
    echo "Already done: node_modules matches package-lock.json."
    record "3. npm ci" "already done"
    return 0
  fi
  echo "This will run npm ci: it installs the exact package versions from package-lock.json into node_modules."
  echo "It does not change package-lock.json or any other file git tracks. It can take a few minutes."
  if ! ask; then
    record "3. npm ci" "skipped"
    return 0
  fi
  if ! npm ci; then
    echo "npm ci failed. Read the first error above, fix it, then run this script again."
    record "3. npm ci" "failed"
    stop
  fi
  NPM_RAN=1
  record "3. npm ci" "done"
}

has_setup_script() { grep -Eq '"setup"[[:space:]]*:' package.json 2>/dev/null; }

step_npm_setup() {
  heading 4 "Set up the app"
  if ! has_app || ! has_setup_script; then
    echo "Not needed: this workshop has no setup command."
    record "4. npm run setup" "not needed"
    return 0
  fi
  if [ ! -d node_modules ]; then
    echo "Skipped: it needs the packages from step 3 first."
    record "4. npm run setup" "skipped: needs npm ci"
    return 0
  fi
  # Done once it ran after the last npm ci: a newer node_modules/.package-lock.json means the packages changed since.
  if [ "$NPM_RAN" = 0 ] && [ -f "$STATE_DIR/npm-setup" ] && [ ! node_modules/.package-lock.json -nt "$STATE_DIR/npm-setup" ]; then
    echo "Already done. To run it again: npm run setup"
    record "4. npm run setup" "already done"
    return 0
  fi
  echo "This will run npm run setup, which prepares the app for the labs (for example its local data)."
  echo "It does not change the files git tracks."
  if ! ask; then
    record "4. npm run setup" "skipped"
    return 0
  fi
  if ! npm run setup; then
    echo "npm run setup failed. Read the first error above, fix it, then run this script again."
    record "4. npm run setup" "failed"
    stop
  fi
  mark_done npm-setup
  record "4. npm run setup" "done"
}

# ---------- 5. the test browser ----------

step_browser() {
  heading 5 "Install the test browser"
  if ! has_app || [ "${WORKSHOP_PLAYWRIGHT:-1}" = 0 ]; then
    echo "Not needed: this workshop's app has no browser tests."
    record "5. Test browser" "not needed"
    return 0
  fi
  if [ ! -d node_modules ]; then
    echo "Skipped: it needs the packages from step 3 first."
    record "5. Test browser" "skipped: needs npm ci"
    return 0
  fi
  if node scripts/lib/playwright-path.cjs >/dev/null 2>&1; then
    echo "Already done: Playwright's Chromium is installed."
    record "5. Test browser" "already done"
    return 0
  fi
  echo "This will run npx playwright install chromium: it downloads the browser the tests drive into"
  echo "Playwright's own folder, outside this repository. It changes no repository files."
  if ! ask; then
    record "5. Test browser" "skipped"
    return 0
  fi
  if ! npx playwright install chromium; then
    echo "The browser download failed. Check your network, then run this script again."
    record "5. Test browser" "failed"
    stop
  fi
  if [ "$OS" = linux ]; then
    echo "On Linux and WSL the browser also needs system libraries. This script never uses sudo: if the tests"
    echo "cannot start the browser, run this yourself (it asks for your password): npx playwright install --with-deps chromium"
  fi
  record "5. Test browser" "done"
}

# ---------- 6. the check ----------

step_check() {
  heading 6 "Check your setup"
  echo "This will run ./scripts/check-setup.sh. It only reads and reports: it changes nothing."
  if ! ask; then
    record "6. Check your setup" "skipped"
    return 0
  fi
  if bash "$HERE/check-setup.sh"; then
    record "6. Check your setup" "done"
  else
    record "6. Check your setup" "failed: see the crosses above"
  fi
}

# ---------- 7. GitHub issues ----------

has_seed() {
  local f
  [ -f "$HERE/seed-github.sh" ] || return 1
  # A pull request lab needs its lab-N-base branch even when there is no issue to add.
  [ -n "${WORKSHOP_PR_BASE_LABS:-}" ] && return 0
  for f in "$HERE"/seed/issues/*.md "$HERE"/seed/pr-*.md; do
    [ -f "$f" ] && return 0
  done
  return 1
}

step_seed() {
  local origin repo
  heading 7 "Add the workshop issues to your copy"
  if ! has_seed; then
    echo "Not needed: this workshop has no GitHub issues to add."
    record "7. Workshop issues" "not needed"
    return 0
  fi
  if [ "$COPY_OK" != 1 ]; then
    echo "Skipped: it needs your private copy from step 2 first."
    record "7. Workshop issues" "skipped: needs your private copy"
    return 0
  fi
  origin="$(git config --get remote.origin.url 2>/dev/null || true)"
  repo="$(repo_of "$origin")"
  echo "This will run ./scripts/seed-github.sh: it creates the workshop's labels and issues (and any draft pull"
  echo "requests) in YOUR copy (${repo}), and makes it the repository gh uses in this folder. It never touches the"
  echo "workshop repository. Running it again creates nothing new, so this step is offered on every run."
  if ! ask; then
    record "7. Workshop issues" "skipped"
    return 0
  fi
  if ! bash "$HERE/seed-github.sh"; then
    record "7. Workshop issues" "failed"
    stop
  fi
  record "7. Workshop issues" "done"
}

echo "Setting up your copy of ${WORKSHOP_NAME}."
[ "$YES" = 1 ] && echo "--yes: every question is answered yes."
step_tools
step_copy
step_npm_ci
step_npm_setup
step_browser
step_check
step_seed
summary || exit 1

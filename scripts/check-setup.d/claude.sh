#!/usr/bin/env bash
# Sourced by scripts/check-setup.sh, so it shares ok, warn, fail_check, hint, LIVE, CLAUDE_MIN_VERSION and
# WORKSHOP_CLAUDE_CLI (from scripts/workshop.env).
# It deliberately sets no shell options: strict mode would leak into the caller.
# scripts/setup-workshop.sh sources it too (with LIVE=0), and prints SETUP_NEXT_STEP as its last advice.
SETUP_NEXT_STEP="open this folder in Claude Code: run claude in it, or open it in the Claude desktop app."
if command -v claude >/dev/null 2>&1; then
  CLAUDE_V="$(claude --version 2>/dev/null | awk '{print $1}')"
  if [ -z "$CLAUDE_V" ]; then
    fail_check "Could not read the Claude Code version" "install it: curl -fsSL https://claude.ai/install.sh | bash"
  elif version_ge "$CLAUDE_V" "$CLAUDE_MIN_VERSION"; then
    ok "Claude Code $CLAUDE_V"
  else
    fail_check "Claude Code $CLAUDE_V is older than $CLAUDE_MIN_VERSION" "run: claude update"
  fi
  if [ "$LIVE" = 1 ]; then
    out="$(claude -p "Reply with exactly: OK" --max-turns 1 2>&1)"
    if printf '%s\n' "$out" | grep -qw OK; then ok "Claude Code is signed in"
    else fail_check "Claude Code is installed but not signed in" "run claude and sign in, then run this again"; fi
  fi
elif [ "${WORKSHOP_CLAUDE_CLI:-required}" = optional ]; then
  # checkSetup.claudeCli "optional": the Claude desktop app includes Claude Code, so an attendee who works in its Code
  # tab never has the claude command. A claude that is too old or not signed in still fails above.
  warn "Claude Code terminal command (claude) not found" "fine if you use the Claude desktop app, which includes Claude Code:
   check that /status in a Code tab session shows Claude Code $CLAUDE_MIN_VERSION or later. For a terminal: curl -fsSL https://claude.ai/install.sh | bash"
else
  fail_check "Claude Code not found" "install it: curl -fsSL https://claude.ai/install.sh | bash"
fi

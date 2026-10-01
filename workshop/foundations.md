# Foundations

This chapter holds the ideas behind the three labs. You can read it before the session, or after it, without anyone in the room. It takes about ten minutes.

The whole workshop rests on one idea. **Guidance makes good behavior likely. Control makes it enforceable.** A line in `CLAUDE.md`, a skill or a careful prompt is guidance: the model reads it and usually follows it. A hook, a permission rule or a managed setting is control: Claude Code applies it outside the model, with the same verdict every time. You want both. Use control for the things that must never happen.

## Five words

| Word             | What it means here                                                                     |
| ---------------- | -------------------------------------------------------------------------------------- |
| Agent            | An AI that repeats a cycle: plan, act, check what happened, go again                   |
| Tool call        | A single action the agent requests, such as Bash, Read, Edit, WebFetch or an MCP tool  |
| Hook             | Your code, which Claude Code runs on its own at a fixed point in that loop, every time |
| Permission rule  | An allow, ask or deny pattern, such as `Read(**/.env)`                                 |
| Managed settings | The settings file your IT team ships. Nothing below it can override it                 |

A useful picture: the model is the driver, and Claude Code is the car. The driver presses the pedals; the car is what moves. A hook is equipment you fit to the car, such as a speed governor. The driver never has to agree to it, and cannot take it off, because the car checks with it before it moves.

## Where hooks run

Claude Code runs hooks at set points in a session. The docs list more than 30 events. Six matter most for governance:

| Event              | When it runs                | What it can do                                |
| ------------------ | --------------------------- | --------------------------------------------- |
| SessionStart       | A session begins or resumes | Load context                                  |
| UserPromptSubmit   | Before Claude sees a prompt | Block the prompt                              |
| PreToolUse         | Before a tool runs          | Allow, deny or ask; rewrite the input         |
| PostToolUse        | After a tool succeeds       | Audit, redact what Claude sees, give feedback |
| PostToolUseFailure | After a tool fails          | Audit the failure                             |
| Stop               | Claude is about to finish   | Keep it working                               |

A hook is set up in a settings file with three parts, like a mailroom rule: when a package arrives (the **event**), if it is from this sender (the **matcher**), send it to security (the **handler**). A matcher of only letters, such as `Bash`, matches that tool exactly. `Bash|Read` is a pattern that matches both. No matcher at all matches everything.

There are five handler types: command, http, mcp_tool, prompt and agent. Prompt and agent handlers ask a model to judge. For a hard control, use a command hook: your own script, run the same way every time. This workshop's hooks are Node scripts, set up in exec form, which starts the script directly with no shell:

```json
{
  "type": "command",
  "command": "node",
  "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.mjs"],
  "timeout": 10,
  "onFailure": "block"
}
```

A handler can also have an `if` filter, such as `Bash(rm *)`, so the script only starts for matching calls. The docs describe it as best effort, so it isn't a guarantee. When you need a firm allow or deny on a plain pattern, write a permission rule instead.

## How a hook talks back

A command hook gets the event as JSON on standard input: `session_id`, `prompt_id`, `hook_event_name`, and on tool events `tool_name`, `tool_input` and `tool_use_id`. It answers with its exit code, and optionally JSON on standard output.

| What your hook does                            | What happens                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Exit 0, no output                              | No opinion. The normal permission flow carries on. Silence never approves                 |
| Valid decision JSON on stdout                  | A structured decision, whatever the exit code                                             |
| Exit 2                                         | Blocks. Your stderr is the reason                                                         |
| Exit 1, a crash, or a script that cannot start | A non-blocking error. The action goes ahead, and the transcript shows a hook error notice |
| A timeout                                      | No decision. A PreToolUse call is not blocked                                             |
| `"continue": false`                            | Stops Claude entirely, with your `stopReason`, over any other decision                    |

The trap in that table is the one Lab 1 is built on. Most of us learned that any non-zero exit means "stop". In a hook, only exit 2 blocks on its own. A guard that crashes, times out, or has a mistyped path in `settings.json` lets everything through, like a smoke detector with a dead battery. Two things fix it:

- **In the script:** catch every error, and deny.
- **In the config:** set `"onFailure": "block"` on the handler (Claude Code 2.1.295 and later). Then a hook that fails or times out blocks the action instead of letting it through.

A PreToolUse hook answers with `hookSpecificOutput.permissionDecision`: allow, deny, ask or defer. For deny, Claude sees your `permissionDecisionReason` and can adjust. `defer` only works in non-interactive runs with `-p`. When several hooks disagree, deny wins. And a hook's allow never overrides a deny or ask rule. So a central security hook stays in charge, whatever a team's own hook says.

A PreToolUse hook can also rewrite the call with `updatedInput`, for example to add `--dry-run`. It replaces the whole input, so pass every field through.

## Before and after

PreToolUse is the bouncer at the door: it checks you before you get in, and can say no. PostToolUse is the receipt check at the exit: it can log the purchase and black out the card number, but it cannot un-buy what you bought.

|                             | PreToolUse                | PostToolUse                              |
| --------------------------- | ------------------------- | ---------------------------------------- |
| Runs                        | Before the tool           | After the tool succeeds                  |
| Can stop the action         | Yes                       | No, it already happened                  |
| Can change the action       | Yes, `updatedInput`       | No                                       |
| Can change what Claude sees | `additionalContext`       | `updatedToolOutput`, `additionalContext` |
| Best for                    | Policy, safety, approvals | Audit, redaction, lint and test feedback |

PostToolUse only fires on success. A failed call fires PostToolUseFailure instead, so an audit hook needs both, or it misses every failed attempt (Lab 2).

`prompt_id` in a hook's input matches the `prompt.id` attribute on Claude Code's OpenTelemetry events. If your team already sends that telemetry, your audit records and your telemetry join on one key. Ship the records off the laptop: a log a user can delete does not hold up as evidence.

## Rule or hook

If a pattern can say it, use a permission rule. Rules are evaluated deny first, then ask, then allow. `Read(./.env)` denies reading `.env` with the Read tool, natively, with no script to maintain. Mind the anchor: `Read(./.env)` covers only the project root, and `Read(**/.env)` covers a `.env` at any depth below it.

If it needs logic or outside state, use a hook. A rule matches the command text Claude writes, not every way to run the same program: the docs note that `Bash(git push *)` does not match `git -C . push origin main`. Piping a downloaded script into a shell can be written many ways, and a kill switch needs to ask a service. Those are hook jobs.

## Managed settings

Managed settings are the building code. Tenants can paint the walls and move the furniture. They cannot rip out the fire sprinklers.

Settings precedence, highest first: managed settings, command-line flags, local project, shared project, user. Hooks merge across the levels, so a project can add its own hooks but cannot remove a managed one. `disableAllHooks` in a user or project file cannot turn managed hooks off.

Three keys lock the policy in:

| Key                                                | What it does                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| `allowManagedHooksOnly`                            | Only managed hooks run. User, project and other plugin hooks don't run         |
| `allowManagedPermissionRulesOnly`                  | Only allow, ask and deny rules from managed settings count                     |
| `disableBypassPermissionsMode`, set to `"disable"` | Nobody can enter bypass mode, and `--dangerously-skip-permissions` is rejected |

The file lives at `/Library/Application Support/ClaudeCode/managed-settings.json` on macOS and `/etc/claude-code/managed-settings.json` on Linux and WSL. It can also come from MDM, or as server-managed settings. `/status` shows which managed source Claude Code picked.

Design with the end state in mind. Decide what must never happen, what needs a human and what must be logged. Pick a rule or a hook for each. Lock the managed tier, deliver it, then verify it fires. Start strict on what cannot be undone (deletes, pushes, secrets, production) and loose on the rest. Tightening later breaks workflows people already depend on.

## Positive control

Positive control is the ability to halt agent work whenever governance requires it, and to prove that you can. In Lab 3 the chain is: governance decides, a control plane flips, a hook on UserPromptSubmit and PreToolUse checks it, and returns `"continue": false`, and the agent halts on its next prompt or tool call.

The design question is what happens when the control plane itself is down. An http hook that cannot connect, or gets a non-2xx status, is a non-blocking error by default, so the kill switch stops working exactly when you might need it.

Decide the fail mode on purpose: a command hook with its own short timeout, "unreachable means halt", `onFailure` set to block, and the whole thing in managed settings. Then drill it on a schedule, like a factory's emergency stop, and time how long a halt takes to land.

## Where you practise each idea

- Lab 1: A guardrail that fails closed (40 minutes). Exit codes, failing closed, a deny rule, `onFailure`.
- Lab 2: Receipts you can trust (40 minutes). PostToolUse and PostToolUseFailure, redaction, a hash chain, `prompt_id`.
- Lab 3: The big red button (40 minutes). `continue: false`, fail modes, managed settings.

The desktop app and the CLI read the same settings files, so everything here works in the Code tab and in a terminal. Use a local session: cloud sessions do not read your local settings files.

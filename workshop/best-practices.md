# Best practices

A take-home reference. Each practice says what to do, why it works, and where you tried it.

## Use guidance and control together

Write the habits you want in `CLAUDE.md` and skills, and enforce the things that must never happen with hooks, rules and managed settings. Guidance shapes behavior most of the time. Control is the guarantee for the rest, because it runs outside the model. Practised in the opening poll.

## Block with exit 2 or a deny decision

A policy hook blocks with exit 2 and a reason on stderr, or with a deny decision in JSON. Never with a bare exit 1: Claude Code treats that as an error and lets the call through. Practised in Lab 1, Step 4.

## Fail closed, in the script and in the config

Wrap a policy hook so any error, including input it cannot parse, is denied. Then set `"onFailure": "block"` on its handler, so a missing script or a timeout blocks too. Practised in Lab 1, Steps 4 and 6.

## Test every policy hook by breaking it

Keep saved inputs for each hook, with the verdict you expect, and run them in CI before every policy change. Include a broken input and a harmless call. Then break the hook on purpose, with a wrong path or a crash, and check it still fails safe. Watch for the hook error notice the first time a new hook runs. Practised in Lab 1, Steps 1 and 6.

## Use a rule when a pattern can say it

A permission rule such as `Read(**/.env)` is native and needs no code. Use a hook only for what needs logic or outside state. Remember that a rule matches the command text, not every way to run the same program. Practised in Lab 1, Step 5, and Lab 3, Step 1.

## Keep evidence in PostToolUse, and audit failures too

Prevention lives in PreToolUse. Evidence lives in PostToolUse. Register your audit hook on PostToolUseFailure as well, or the log misses every failed attempt. Practised in Lab 2, Step 5.

## Redact before you write, and chain the records

Strip secrets before a record reaches the disk. Chain each record to the one before it with a hash, so an edit shows. Key each record by `prompt_id`, so it joins to telemetry. Then ship the records somewhere a user cannot delete them. Practised in Lab 2, Steps 4 and 6.

## Make the kill switch fail closed on purpose

Check a control plane on every prompt and tool call, with a short timeout. Treat unreachable, an error status or an unknown answer as halt, unless someone has decided otherwise and written it down. Return `"continue": false` with a clear reason. Practised in Lab 3, Step 5.

## Drill the halt, and time it

Run a halt drill on a schedule, like a fire drill, and record how long a halt takes to land. That number is a governance metric you can report. Practised in Lab 3, Step 3.

## Lock the policy in managed settings

Ship the guard, the audit hook and the kill switch in managed settings, with `allowManagedHooksOnly`, `allowManagedPermissionRulesOnly` and `disableBypassPermissionsMode`. A control that lives in a project file can be edited or deleted. Verify with `/status` which managed source is active. Practised in Lab 3, Step 6.

## Start strict where you cannot undo

Begin with deletes, pushes to shared branches, secrets and production, and keep the rest loose. Tightening a policy later breaks workflows people depend on. Practised in Lab 3, Step 7.

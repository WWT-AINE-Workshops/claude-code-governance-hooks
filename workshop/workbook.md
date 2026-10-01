# Workbook

Use this workbook as you go. Each lab has a page: the exercises from the session, then your notes. If you are working on your own, the answers to each page's exercises are on the page after it.

---

## Warm-up

**Has an AI agent ever done something you didn't expect?** Write it down in one line. Then ask yourself: was the gap between what you told it and what you enforced?

**Which one can block a tool call before it runs?**

- A. A rule written in `CLAUDE.md`
- B. A skill that spells out what to do
- C. A PreToolUse hook
- D. A polite request in the prompt

My answer:

---

## Warm-up answers

**C, a PreToolUse hook.** It runs before the tool, outside the model, and can deny the call. A, B and D are guidance: they shape what the model wants to do, and it can still decide otherwise.

---

## Lab 1: A guardrail that fails closed

**Your guard script dies with exit 1. Was the `rm -rf` stopped?**

- A. Yes, a crash stops the call
- B. No, the call goes through
- C. Only if the error message says so

My answer:

**What I did.**

**What surprised me.**

**What I will try in my own work.**

---

## Lab 1 answers

**B, the call goes through.** Exit 2 is the one exit code that blocks by itself. Exit 1, a crash, a timeout or a mistyped script path is a non-blocking error, unless the handler sets `"onFailure": "block"`. Valid deny JSON on stdout also blocks, whatever the exit code.

---

## Lab 2: Receipts you can trust

**Pre or post?** For each need, write PRE or POST.

1. Stop `rm -rf` from wiping a home directory
2. Keep an AWS key out of what Claude sees from a file it read
3. Require human sign-off before any `git push`
4. Lint each file once it has been edited
5. Put a dry-run flag on every deploy command
6. Log every tool call to an audit trail

My answers:

**What I did.**

**What surprised me.**

**What I will try in my own work.**

---

## Lab 2 answers

1. PRE: prevention has to happen before it runs.
2. POST: `updatedToolOutput` changes what Claude sees next.
3. PRE: an ask decision, or an ask rule such as `Bash(git push *)`.
4. POST: the edit has to exist first.
5. PRE: `updatedInput` rewrites the arguments before the tool runs. Changing things is not always post.
6. POST: it sees the result. Add PostToolUseFailure, or failed calls are missing.

---

## Lab 3: The big red button

**Pick the control** for each need (Lab 3, Step 1): permission deny rule, permission ask rule, PreToolUse command hook, `disableBypassPermissionsMode`, `allowManagedHooksOnly`.

1. Claude is never allowed to read `.env` files:
2. Stop scripts fetched from the internet being piped into a shell:
3. Every `git push` needs a person to approve it:
4. Bypass mode cannot be turned on by anyone:
5. Only hooks that security has approved are allowed to run:

**The kill switch service is down at 2 a.m. What do agents do?** Fail open, fail closed, or it depends. Write your choice, why, and who owns the decision.

**Which file wins** (Lab 3, Step 7)? Name two ways a kill switch in `.claude/settings.json` could stop protecting you.

**My halt time:** ____ seconds.

**What I did.**

**What surprised me.**

**What I will try in my own work.**

---

## Lab 3 answers

1. A permission deny rule: a simple pattern, enforced natively.
2. A PreToolUse command hook: the pipe can be written many ways, so it needs logic.
3. A permission ask rule, or a hook that answers ask.
4. `disableBypassPermissionsMode`: it removes the escape hatch.
5. `allowManagedHooksOnly`: it stops hooks nobody approved.

The 2 a.m. question has no single right answer. Fail closed is safer; fail open keeps people working during an outage. The wrong answer is not deciding, because then the default decides for you, and the default is to carry on.

A kill switch in a project file can be edited or deleted by anyone with the repo, and a project that never had the file has none. In managed settings, with `allowManagedHooksOnly`, neither can happen.

---

## Governance checklist before you scale

Tick what your team has. Circle the number you are furthest from: that is your homework.

| #   | Before you scale                                                     | Owner                 |
| --- | -------------------------------------------------------------------- | --------------------- |
| 1   | Write the end-state policy: never, ask, log                          | Security and platform |
| 2   | Block irreversible actions with a rule or a PreToolUse hook          | Platform              |
| 3   | Send audit records off the laptop, keyed to telemetry by `prompt_id` | Platform              |
| 4   | Lock the managed tier: only managed hooks and rules, bypass off      | IT and endpoint       |
| 5   | Make the kill switch fail closed, and drill it on a schedule         | Security operations   |
| 6   | Run hook tests in CI ahead of each policy change                     | Platform              |

---

## Glossary

| Term             | Meaning                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Hook             | Your code that Claude Code runs at a set point in a session, every time                        |
| Event            | The point a hook runs at, such as PreToolUse or PostToolUse                                    |
| Matcher          | Which tools an event's hooks apply to, such as `Bash`, or a pattern that matches several tools |
| Handler          | What runs: here, a command that starts a Node script                                           |
| Permission rule  | An allow, ask or deny pattern, such as `Read(**/.env)`                                         |
| Fail closed      | When a control cannot decide, it blocks                                                        |
| Fail open        | When a control cannot decide, it lets the action through                                       |
| Managed settings | The settings file IT ships. Nothing below it can override it                                   |
| Control plane    | The service that holds the run, halt or suspend status the kill switch asks for                |
| Positive control | The proven ability to halt agent work whenever governance requires it                          |

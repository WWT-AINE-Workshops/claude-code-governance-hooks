# Workshop materials

Welcome to _Governance and Control with Hooks_, a 150-minute workshop from World Wide Technology. You will work through three short labs on a working app. Everything in this folder is course material. It is not part of the app.

## Agenda

| Time | Segment                                                  | Minutes |
| ---- | -------------------------------------------------------- | ------- |
| 0:00 | Welcome, and AI-Native Engineering at WWT                | 6       |
| 0:06 | Same page: five words, and why a request isn't a control | 9       |
| 0:15 | Lab 1: A guardrail that fails closed                     | 40      |
| 0:55 | Lab 2: Receipts you can trust                            | 40      |
| 1:35 | Break                                                    | 5       |
| 1:40 | Lab 3: The big red button                                | 40      |
| 2:20 | Wrap-up: the governance checklist, questions and close   | 10      |

## Your materials

- [Pre-work](pre-work.md) ([Word version](pre-work.docx)): set up your computer before the session.
- [Foundations](foundations.md): the ideas behind the labs. Read it before or after the session.
- [Lab 1: A guardrail that fails closed](labs/01-lab-1.md) (40 minutes)
- [Lab 2: Receipts you can trust](labs/02-lab-2.md) (40 minutes)
- [Lab 3: The big red button](labs/03-lab-3.md) (40 minutes)
- [Best practices](best-practices.md): a take-home reference for working with Claude Code.
- [Workbook](workbook.md) ([Word version](workbook.docx)): notes and exercises to fill in as you go.
- [Slides](slides.pptx): the deck from the session.

## Scripts

| Script                      | What it does                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `scripts/setup-workshop.sh` | Sets up your copy after the clone, one step at a time, asking before each step (`--yes` answers yes to all) |
| `scripts/check-setup.sh`    | Checks your computer has everything the workshop needs and tells you how to fix anything missing            |
| `scripts/reset-lab.sh <n>`  | Moves you to the start of lab `n` on a fresh branch                                                         |

Fell behind? `./scripts/reset-lab.sh <lab number>` puts you at the start of any lab.

## Next steps

Anthropic Academy has follow-on courses at https://anthropic.skilljar.com:

- Claude Code 101
- Claude Code in Action
- Introduction to agent skills
- Introduction to subagents

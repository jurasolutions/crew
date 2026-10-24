---
name: protocol
description: Crew hand-off protocol: where a feature's artifacts live, how personas pass context pointers, the report every persona returns, and the hard boundaries. Preloaded by crew agents; read it before briefing one.
user-invocable: false
---

# Crew protocol

## Before acting

1. Read the repo's `CLAUDE.md` / `AGENTS.md`, then its **operating card** `docs/agents/crew.md`. Repo rules outrank everything in crew. When the card is missing and your job changes the repo, report `blocked: run /crew:setup` and stop. Read-only jobs (a scout vetting run, a review outside a feature) carry on without it.
2. Read every **context pointer** in your brief: the spec, your ticket, the reviews and `crew-log.md` entries it names. Work from those files, not from memory of the conversation.

## Where a feature's work lives

The **feature folder** is `.scratch/<feature>/` (or wherever `docs/agents/issue-tracker.md` puts issues):

| Path | Holds |
|---|---|
| `spec.md` | the spec, or a one-line pointer to the repo's PRD |
| `issues/NN-<slug>.md` | tickets, numbered blockers-first |
| `reviews/<kind>.md` | functional, technical, test-strategy, code-review-NN, qa-NN, quality-gate, infra, release |
| `scout/` | the skill scout's risk cards for this feature |
| `crew-log.md` | one report block per persona run, newest last |

Pass **context pointers** (paths, ticket numbers, commit SHAs), never pasted content. A brief that repeats a spec instead of pointing at it is a brief to rewrite.

## Boundaries

These are hard. Each comes with the move to make instead.

- Work inside the current repo, or your own worktree. Material outside it reaches you through the brief.
- Blocked paths on the operating card (`inputs/`, `design-system/`, generated bundles, CI workflows) are read-only. A change that needs one becomes a `needs-human` question.
- Commit only to your own branch. Pushing, merging into protected branches and tagging belong to the release gate, which the user opens.
- Secrets stay where they are. Credentials, tokens and keys never enter files, logs, reports or commit messages; human-only credential steps go through mattpocock `wizard`.
- Decisions that belong to the user come back as questions with status `needs-human`, each with your recommended answer.

## Done means verified

Before reporting `done`, invoke superpowers `verification-before-completion` and run the commands that prove the claim (tests, typecheck, build, the app itself). Report what they printed. A claim with no evidence line is not done.

## The report

Return exactly this block, at most 200 words. Outside a worktree, also append it to `crew-log.md` under a `## <ISO timestamp> <persona>` heading. Inside a worktree, only return it: the conductor appends it, so parallel branches never collide on the log.

```
status:    done | blocked | needs-human
persona:   <your persona>
ticket:    <NN or ->
artifacts: <paths written or changed>
decisions: <one line each: what, and why>
questions: <for the user, each with a recommended answer, or ->
evidence:  <one line each: command -> result>
```

## Human-facing writing

Specs, tickets, commit messages, PR bodies and release notes are read by people. Write them in plain, complete sentences, in the repo's own voice and conventions (a repo with brand rules, such as a design system README, sets that voice). Terse styles belong only in the report block above.

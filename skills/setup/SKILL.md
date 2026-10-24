---
name: setup
description: Set a repo up for the crew. Runs mattpocock's repo setup if needed and writes the operating card docs/agents/crew.md (commands, branches, PRD rule, blocked paths, design system, release). Use on the first /crew:deliver in a repo, or when asked to set the crew up.
---

# Set up a repo for the crew

The **operating card** at `docs/agents/crew.md` is what every persona reads before acting. It is a **cache** of what the repo can't tell an agent at a glance: which commands prove the work, which branches are off limits, which rules gate a build.

## Steps

1. **Explore.** Read `CLAUDE.md` / `AGENTS.md` (and any parent-folder instructions the session shows), `package.json` scripts or the stack's equivalent (`pyproject.toml`, `Makefile`, `justfile`), CI config, `git branch -a` and the default branch, `CHANGELOG.md`, and any `prd/`, `inputs/`, `design-system/` or `docs/agents/` folders.
2. **mattpocock setup.** If `docs/agents/issue-tracker.md` is missing, invoke `crew:setup-matt-pocock-skills`. Recommend the local-markdown tracker (`.scratch/`) unless the repo already tracks work in GitHub Issues.
3. **Draft the card** from [CARD-TEMPLATE.md](CARD-TEMPLATE.md). Fill in every line from what you found. A rule stated in `CLAUDE.md` goes in word for word with its source, not as a paraphrase.
4. **Confirm with the user.** Show the draft and ask only about lines you couldn't settle from the repo, each with your recommended answer.
5. **Verify the commands.** Run test, typecheck, lint and build once each. Mark each verified, or unverified with the reason.
   - Developer agents work in git worktrees under `.claude/worktrees/` inside the repo, so ensure `.gitignore` lists `.claude/worktrees/`.
   - Ensure the recorded test, lint and typecheck commands don't sweep that folder up. A test runner that globs the whole tree (`node --test`, `pytest` with no paths, `vitest` with no `exclude`) gets a scoped command or an exclude.
6. **Write** `docs/agents/crew.md`, and add one pointer line to the existing `CLAUDE.md` (or `AGENTS.md`), under its `## Agent skills` section if there is one: `Crew operating card: docs/agents/crew.md`.

**Done when** the card exists, every command is marked verified or unverified with a reason, and the pointer line is in place.

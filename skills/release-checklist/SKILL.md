---
name: release-checklist
description: Release readiness checklist for a finished branch: gate and review status, branch hygiene, version and changelog, migrations, configuration, rollback and the merge options.
user-invocable: false
---

# Release checklist

Write `reviews/release.md`, with each item marked ✅, ❌ or n/a and a one-line note.

## Readiness

- [ ] `reviews/quality-gate.md` says GO, at the branch's current SHA
- [ ] every `reviews/code-review-*.md` approves, `final` included
- [ ] the branch is rebased or merged up to date with its base; the suite is green after that
- [ ] no commit touches a blocked path from the operating card
- [ ] no secrets, `.env` files or credentials in the diff (`git diff <base>... | grep -iE "secret|token|password|api[_-]?key"` reviewed)

## Package

- [ ] version bumped per the repo's convention (semver: breaking → major, feature → minor, fix → patch)
- [ ] `CHANGELOG.md` entry under the new version: what changed, for whom, in plain sentences
- [ ] release notes for users, if the repo publishes them
- [ ] PR body in `reviews/pr-body.md` (via `crew:pr`)

## Runtime

- [ ] migrations: forward tested; down path or a written reason there is none
- [ ] new configuration or environment variables documented, with where they're set per environment
- [ ] feature flags and their default state
- [ ] what to watch after release (logs, errors, metrics) and for how long

## Rollback

- [ ] revert range (first..last SHA) or the PR to revert
- [ ] data or side effects that a revert does not undo, and how to handle them

## Options for G4

Merge locally / open a PR / keep the branch / discard, each with what happens next and your recommendation. In repos where shipping goes through another path (e.g. a `dev` branch, or an automated deployer), name that path instead.

**Done when** every item is marked, and every ❌ either blocks the release or is listed as a waiver for the user.

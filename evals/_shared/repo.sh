#!/usr/bin/env bash
# Scaffold: the split-bill fixture repo, committed, with a crew operating card so intake skips setup.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -R "$here/../../fixtures/e2e-repo/." .
mkdir -p docs/agents
cat > docs/agents/issue-tracker.md <<'CARD'
# Issue tracker
Local markdown: one folder per feature under `.scratch/<feature>/`, tickets in `issues/NN-<slug>.md`.
CARD
cat > docs/agents/crew.md <<'CARD'
# Crew operating card
| Purpose | Command | Verified |
|---|---|---|
| Test, all | npm test | yes |
| Syntax check | npm run check | yes |
| Run the app | node bin/split.js 100.00 3 | yes |
- Base branch for crew work: main
- Protected: main
- PRD rule: none
- Blocked paths: none
- Rules: money is integer cents; shares add up to the exact total.
CARD
git init -q -b main
git add -A
git -c user.name=eval -c user.email=eval@example.invalid commit -qm initial

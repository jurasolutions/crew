# Crew operating card

_Read by every crew persona before acting. Repo rules outrank crew defaults. Last verified: YYYY-MM-DD._

## Commands

| Purpose | Command | Verified |
|---|---|---|
| Install dependencies | | |
| Test, all | | |
| Test, one file | | |
| Typecheck | | |
| Lint | | |
| Build | | |
| Run the app | | |

## Branches

- **Base branch for crew work:**
- **Protected (crew never pushes or merges into these):**
- **Ship path:** (e.g. PR into `main`; push to `dev`; deploy on merge)

## Rules that gate the crew

- **PRD rule:** none / required. Format, folder and how sign-off is recorded (quote the source line).
- **Blocked paths (read-only):** (e.g. `inputs/`, `design-system/`, generated bundles, `.github/workflows/`)
- **Design system:** path, and what it governs (tokens, components, voice)
- **Voice for human-facing text:** (commits, PRs, release notes; brand rules if any)
- **Other repo rules:** anything else in `CLAUDE.md` a persona could break (connectors, data, email)

## Release

- **Versioning:**
- **Changelog:**
- **Deploy target and how:**
- **Rollback:**

## Tracker

Issues and feature folders: see `docs/agents/issue-tracker.md`. Domain glossary: `GLOSSARY.md`. ADRs: `docs/adr/`.

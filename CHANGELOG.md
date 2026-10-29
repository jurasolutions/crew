# Changelog

## 1.0.1 — 2026-10-24

- The glossary is `GLOSSARY.md` everywhere, as in the vendored mattpocock skills (1.3.1). The business analyst, functional lead, conductor, G1 gate, setup card template and e2e script still said `CONTEXT.md`, its name before mattpocock-skills 1.3.0, so a repo's setup docs and the crew could point at different files.
- A repo that already has a `CONTEXT.md` keeps its terms: the business analyst renames it to `GLOSSARY.md` rather than starting a second glossary.
- `npm test` fails if crew's own files name the glossary differently from the vendored setup skill, so an upstream rename can't drift in unnoticed on the next sync.
- The `update` test reads the previous pin from the package version instead of hard-coding `v1.0.0`.

## 1.0.0 — 2026-10-24

First release.

- Eleven persona agents: business analyst, functional lead, project manager, tech lead, developer, reviewer, QA engineer, QA lead, release manager, infra engineer and skill scout.
- `/crew:deliver` conductor with S, M, L, XL, bug and infra routes and five human gates (G0–G4).
- `/crew:setup` writes each repo's operating card; `/crew:scout` finds and vets skills and watches for upgrades.
- Role skills: protocol, test-strategy, quality-gate, release-checklist, infra-review, status-report, web-design-review, vet-skill (with a static red-flag scanner).
- Vendored at pinned commits: twelve mattpocock skills (made agent-callable), Vercel's React best practices and Web Interface Guidelines, Supabase's Postgres best practices, and Addy Osmani's API and interface design.
- `crew` installer: `install`, `update`, `doctor`, `outdated`, `uninstall`.

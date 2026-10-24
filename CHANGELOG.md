# Changelog

## 1.0.0 — 2026-10-24

First release.

- Eleven persona agents: business analyst, functional lead, project manager, tech lead, developer, reviewer, QA engineer, QA lead, release manager, infra engineer and skill scout.
- `/crew:deliver` conductor with S, M, L, XL, bug and infra routes and five human gates (G0–G4).
- `/crew:setup` writes each repo's operating card; `/crew:scout` finds and vets skills and watches for upgrades.
- Role skills: protocol, test-strategy, quality-gate, release-checklist, infra-review, status-report, web-design-review, vet-skill (with a static red-flag scanner).
- Vendored at pinned commits: twelve mattpocock skills (made agent-callable), Vercel's React best practices and Web Interface Guidelines, Supabase's Postgres best practices, and Addy Osmani's API and interface design.
- `crew` installer: `install`, `update`, `doctor`, `outdated`, `uninstall`.

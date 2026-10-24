# Crew

A delivery team of Claude Code agents. You describe the work; the crew interviews you, writes the spec, splits it into tickets, builds each ticket test-first in its own worktree, reviews, tests, and prepares the release. It stops for your decision at five gates. A skill scout watches for better tools and for upgrades to the ones crew already uses.

## Install

You need Claude Code 2.1 or later, Node 20 or later, git, and read access to this repo.

```sh
gh auth login && gh auth setup-git        # once per machine (or an SSH key on GitHub)
npx --allow-git=root -y github:jurasolutions/crew#v1.0.0 install
```

Restart Claude Code afterwards. The installer adds the crew plugin and then checks for each dependency. superpowers, mattpocock-skills and frontend-design are installed from `claude-plugins-official`; the extras are the TypeScript and Python language servers and Playwright, pinned. Anything already present (as a plugin, as loose skills, or synced from claude.ai) is left alone and reported. Nothing it didn't install is ever removed.

| Command | Does |
|---|---|
| `install` | crew + missing dependencies + extras (`--no-extras` to skip, `--dry-run` to preview) |
| `update` | re-pins crew to the tag you ran it from, updates what crew installed |
| `doctor` | what's present and how, duplicates, version drift, missing language-server binaries |
| `outdated` | vendored skills and pinned dependencies that are behind upstream |
| `uninstall` | removes crew; `--with-deps` also removes what crew installed |

Run any of them as `npx --allow-git=root -y github:jurasolutions/crew#<tag> <command>`.

- **`--allow-git=root`** is required on npm 12 and harmless on older npm.
- **On Windows,** use HTTPS with `gh auth setup-git`. npm forces plain `ssh`, which often can't see keys held by Pageant or the Git Bash agent.

## Use

| You type | What happens |
|---|---|
| `/crew:setup` | Once per repo. Writes `docs/agents/crew.md`, the operating card every persona reads: commands, protected branches, PRD rule, blocked paths, design system, release rules |
| `/crew:deliver <task>` | Sizes the task, proposes a route, and runs it |
| `/crew:scout <need>` | Finds and vets skills or tools for a need; returns risk cards |
| `/crew:scout upgrades` | Reviews what's behind upstream, diff by diff |
| `/crew:status-report <feature>` | Frontier, in flight, blocked, risks |

### Routes and gates

| Size | Route |
|---|---|
| **S** | ticket → developer → reviewer → (QA) → release |
| **M** | interview → spec → functional, technical and test-strategy reviews → slices → build → review → QA → (infra) → quality gate → release |
| **L** | as M, plus tickets via `to-tickets` and a parallel build via `implement-spec` |
| **XL** | `wayfinder` map first, then L |
| **bug**, **infra** | on-ramps |

The gates: **G0** size and route · **G1** requirements ready · **G2** spec sign-off (your PRD sign-off, in repos that require one) · **G3** tickets · **G4** merge / PR / keep / discard. Nothing is built before G2, and nothing merges into a protected branch before G4.

### The team

| Persona | Runs | Owns |
|---|---|---|
| Conductor (`/crew:deliver`) | your session | sizing, routing, gates, dispatch |
| business-analyst | your session for the interview | requirements, glossary, spec draft |
| functional-lead | subagent | process fit, testable acceptance criteria, UAT script |
| project-manager | your session for tickets | tickets, frontier, status, risks |
| tech-lead | subagent | seams, blast radius, ADRs, ticket review |
| developer | subagent in its own worktree | one ticket, red → green → committed |
| reviewer | subagent | standards + spec + security review, verdict |
| qa-engineer | subagent | test cases, running the app, defects with failing tests |
| qa-lead | subagent | test strategy, go / no-go |
| release-manager | subagent | changelog, version, PR body, rollback, merge options |
| infra-engineer | subagent | CI/CD, environments, secrets handling, deploy plan |
| skill-scout | subagent | discovery, vetting, upgrade watch |

Which skill each persona uses for what, and why one pack wins where two overlap: [`skills/deliver/SKILL-MAP.md`](skills/deliver/SKILL-MAP.md).

## Vendored skills and upgrades

The mattpocock flow skills (`to-spec`, `to-tickets`, `wayfinder`, `implement-spec` and others) are user-only upstream, which means no agent can run them. Crew vendors them so the conductor can, along with four instruction-only extras from Vercel, Supabase and Addy Osmani.

- Each is pinned to a commit in `vendor/UPSTREAM.json`.
- Bodies are byte-identical to upstream; only frontmatter is patched. `npm test` checks this.
- Licences: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

To upgrade a source:

```sh
node scripts/sync-upstream.mjs latest            # what's behind
node scripts/sync-upstream.mjs diff <source> <ref>
# the scout reviews the diff (/crew:scout upgrades); if you approve:
#   set the new commit in vendor/UPSTREAM.json, then
node scripts/sync-upstream.mjs sync && npm test
```

## Develop

```sh
npm test                                   # unit, vendor integrity, hygiene and wiring
claude plugin validate --strict .
claude --plugin-dir . plugin details crew  # always-on token cost (budget: 4,000)
claude plugin eval .                       # behaviour evals in evals/
```

Releasing: bump `package.json`, `.claude-plugin/plugin.json` and `CHANGELOG.md` together, commit, tag `vX.Y.Z`, push the tag, then run `update` from the new tag on each machine.

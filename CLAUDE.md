# CLAUDE.md — crew

Crew is a Claude Code plugin (agents + skills) and its own marketplace, plus a zero-dependency installer CLI. It serves several separate businesses' repos and holds no context from any of them.

## Rules for changing crew

- **`vendor/` is generated.** Change `vendor/UPSTREAM.json`, then run `node scripts/sync-upstream.mjs sync`. Never hand-edit a vendored file: `npm test` compares every byte with upstream at the pinned commit.
- **Upgrades go through the scout.** `node scripts/sync-upstream.mjs diff <source> <ref>`, then a risk card, then the user's yes, then sync.
- **Generic only.** No company, client or repo names; no secrets; no `memory: user` in any agent. `test/repo.test.mjs` enforces it. The GitHub owner appears only as the repository location.
- **Agents in a plugin ignore `hooks`, `mcpServers` and `permissionMode`.** Guard with `tools` / `disallowedTools` and instructions.
- **Keep the always-on cost under 4,000 tokens** (`claude --plugin-dir . plugin details crew`). Descriptions front-load their trigger words; reference material lives in sibling files behind a pointer.
- **The installer has no dependencies and no build step.** Node ≥ 20 ESM, LF line endings, and Windows `.cmd` shims handled.
- **Git:** work on a branch; `main` is released from. Version bumps touch `package.json`, `.claude-plugin/plugin.json` and `CHANGELOG.md` together, then tag `vX.Y.Z`.

## Checks before calling a change done

```sh
npm test
claude plugin validate --strict .
claude --plugin-dir . plugin details crew
```

Behaviour evals: `claude plugin eval .` (see `evals/`). Run them after changing an agent, the conductor or a description.

The PRD and build reports live outside this repo, in the owner's `agent-crew/` folder.

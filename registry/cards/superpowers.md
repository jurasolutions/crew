# Risk card: superpowers

| | |
|---|---|
| **Verdict** | Don't recommend under the rubric (High follows the scanner floor). Keep as a required pack only if the user accepts the conditions below. See "Decision for the user". |
| **Risk** | High (scanner floor: High). A reading-based judgement would be Medium; the rubric does not let a judgement lower the floor. |
| **Source** | obra/superpowers @ bb92a77741419a4ab5f06e711a283343f1ada0c3 (v7.0.0, tag v7.0.0), plugin root `./`, as pinned by the `claude-plugins-official` catalog entry (catalog commit 58267944f9) |
| **Maintainer** | Jesse Vincent (obra), who wrote 526 of 684 commits. User-owned repo, created 2025-10-09, about 304k stars, last push 2026-10-23, not archived. Company behind it: Prime Radiant (primeradiant.com). Listed in Anthropic's official catalog with a SHA pin. |
| **Licence** | MIT; vendorable: yes (not vendored today; installed as a plugin) |
| **Kind** | Plugin: 15 skills, 0 agents, 1 hook (SessionStart), 0 MCP servers, 0 LSP servers |
| **Always-on cost** | About 850 tokens per `plugin details`, plus the SessionStart hook injects the full `using-superpowers` text (3,192 bytes, roughly 0.8k to 1.1k tokens) at startup, clear and compact. `plugin details` labels the hook "no model context cost", which is wrong for this hook: its output goes into context. Realistic total about 1.7k to 2.0k. |
| **Vetted** | 2026-10-24, by crew:skill-scout |

## What it does

Teaches the agent a process layer: brainstorm before building, write plans, test first, debug by root cause, request and receive review, verify before claiming done, finish a branch. A SessionStart hook pushes the `using-superpowers` skill into every session as an `<EXTREMELY_IMPORTANT>` block telling the agent to check for a matching skill before anything else, including clarifying questions.

## Gain for this task

Crew uses it for four things the SKILL-MAP names: `verification-before-completion` (every persona), `systematic-debugging` (in-loop failures), `finishing-a-development-branch` (release gate) and `using-git-worktrees`. The review pair (`requesting-code-review`, `receiving-code-review`) shapes reviewer briefs. No other installed pack covers verification-before-completion or branch finishing. Its `test-driven-development`, `writing-plans`, `brainstorming` and `subagent-driven-development` overlap with mattpocock and crew skills and are not primary (see Wiring).

## Files reviewed

Pin cloned to scratch and checked out; nothing run. 238 files in the clone. Coverage, stated plainly:

Read in full, line by line:
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`, `LICENSE`
- `hooks/hooks.json`, `hooks/run-hook.cmd`, `hooks/session-start`. The hook is `SessionStart` on `startup|clear|compact`, runs `run-hook.cmd session-start` through bash, synchronously. It reads `skills/using-superpowers/SKILL.md`, JSON-escapes it and prints it as `additionalContext`. No network, no file writes, no environment reads beyond platform detection. On Windows the `.cmd` half searches fixed Git-for-Windows paths for `bash.exe` and exits silently if none is found.
- `skills/using-superpowers/SKILL.md` and all seven `references/*-tools.md`
- `skills/brainstorming/` entire: `SKILL.md`, `visual-companion.md`, `builder-check-prompt.md`, `scripts/server.cjs` (723 lines), `helper.js`, `start-server.sh`, `stop-server.sh`; `frame-template.html` was grepped for external loads (none)
- `skills/finishing-a-development-branch`, `using-git-worktrees`, `verification-before-completion`, `requesting-code-review` (+ `code-reviewer.md`), `receiving-code-review`, `dispatching-parallel-agents`, `writing-plans`, `test-driven-development/SKILL.md` (all but its last few lines)
- `skills/diagnosing-superpowers/SKILL.md`, `references/*` (4 files), `prompts/analyst-common.md`, `prompts/scrub.md`
- every executable under `skills/`: `executing-plans/scripts/task-start`, `task-done`, `subagent-driven-development/scripts/sdd-workspace`, `task-brief`, `review-package`, `systematic-debugging/find-polluter.sh`

Not read line by line (pattern-checked only: scanner, targeted greps for URLs, `~/`, `git push`, `gh`, `curl`, `rm`, `.env`, `settings.json`, and a hidden-Unicode, base64 and HTML-comment sweep that found nothing):
- `skills/subagent-driven-development/SKILL.md` and its prompts, `executing-plans/SKILL.md`, `systematic-debugging/SKILL.md` and sibling notes, `writing-skills/` (including the 46 KB copy of Anthropic's best-practices page), `test-driven-development/writing-good-tests.md`, the rest of `diagnosing-superpowers/prompts` and `templates`
- Not loaded by Claude Code, so only scanned: `docs/`, `tests/`, `scripts/` (maintainer tooling; `sync-to-codex-plugin.sh` runs `git push` and `gh pr create`), and the adapters for other harnesses (`.opencode/`, `.pi/`, `.hermes-plugin/`, `index.js`; grepped for exec, fetch and env use, nothing beyond bootstrap logic)
- Binary: two PNGs under `assets/` (logos); no archives, no other opaque files

## Red flags

Scanner, whole clone: 55 high, 98 medium, 58 info, floor High. Where the 55 high findings sit:
- injection-phrase (5): `AGENTS.md:3`, `RELEASE-NOTES.md:357`, three in `docs/superpowers/plans/2026-06-09-sdd-task-scoped-review-dispatch.md`. Read: `AGENTS.md` is a contributor guide addressed to agents that want to open PRs on the repo ("If You Are an AI Agent"). It does not address a reviewer and asks for no rating. The other four are ordinary prose ("the spec reviewer should pass it", "without consent").
- config-tamper (26): seven in `docs/`, the rest in `tests/`. Read: test scripts run `claude` headless with `--dangerously-skip-permissions` or `--permission-mode bypassPermissions` inside a test project (14 such lines under `tests/`). Never run these from the installed plugin directory.
- secret-path-read (22): one in `docs/`, 21 in `tests/brainstorm-server/*.test.js`. Read: the strings are the session key `?key=${TOKEN}` in server tests.
- prerequisite-download (2): `tests/codex/test-package-codex-plugin.sh:112,115`, `unzip -p` on a test archive.

None of the 55 is in `skills/`, `hooks/` or `.claude-plugin/`. Scanner run on those paths alone: `skills/` 0 high, 8 medium (floor Medium); `hooks/` Low; `.claude-plugin/` Low. All 8 medium are in the brainstorming companion (see next list).

Found by reading:
1. **Telemetry beacon in the visual companion.** `skills/brainstorming/scripts/server.cjs:106,244-251`: the companion page loads a logo from `https://primeradiant.com/brand/superpowers-visual-brainstorming-logo.png?v=<superpowers version>` in the user's browser. This tells Prime Radiant that a given IP is running a given version. The README discloses it ("Visual companion telemetry"). It is off when `SUPERPOWERS_DISABLE_TELEMETRY`, `DISABLE_TELEMETRY` or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is truthy. It is on by default and only when the companion runs. Nothing about the project, prompts or clicks is sent.
2. **Local web server.** The companion starts `node server.cjs` bound to `127.0.0.1` on a random high port, with a 32-byte session key (query then HttpOnly SameSite=Strict cookie), constant-time comparison, WebSocket Origin check, symlink and hardlink rejection for served files, 4-hour idle shutdown and owner-PID watchdog. Options widen it: `--host 0.0.0.0` exposes it to the network, and `BRAINSTORM_OPEN_CMD` runs an operator-supplied command through a shell (trusted input). `--open` launches the browser.
3. **Context injection on every session.** The hook's imperative text ("ABSOLUTELY MUST", "not negotiable") is injected as `<EXTREMELY_IMPORTANT>`. Upstream issues show the friction: #2509 (closed: injection overrides users' own instructions), #2377 (open: pressure language degrades behaviour on current Claude models), #1480 (open: the phrase "You have superpowers." trips extended-thinking injection detection). The skill itself says user instructions (CLAUDE.md, AGENTS.md, direct requests) take precedence.
4. **Writes outside `docs/`.** Skills write `docs/superpowers/specs|plans/` (committed), `.superpowers/sdd/` (self-ignoring) and `.superpowers/brainstorm/`, and `diagnosing-superpowers` writes `~/.superpowers/diagnosing-superpowers/<session-id>/`.
5. **`diagnosing-superpowers` reads session transcripts** from disk (the harness session store) and can export a scrubbed bundle or file a GitHub issue on `obra/superpowers` with `gh issue create`, both only after a stated approval step. Transcripts can mix several businesses' work.
6. **Environment mutations.** `using-git-worktrees` runs `npm install`, `pip install -r`, `poetry install`, `cargo build` and `go mod download` in a new worktree, and commits a `.gitignore` edit if the worktree directory is not ignored. `finishing-a-development-branch` can `git push` and open a PR, but only after the user picks that option from a fixed menu; it never force-pushes on its own and discards only on a typed `discard`.
7. **Remote-instruction pattern, not applicable here.** `README.md:232` (OpenCode install) tells an agent to fetch and follow instructions from `raw.githubusercontent.com/.../main/.opencode/INSTALL.md`. Unpinned, but it is the OpenCode route and is never reached on Claude Code.
8. **Non-Claude config edits.** `references/codex-tools.md` tells the Codex user to add TOML to `~/.codex/config.toml`. Only read on Codex.

No injection aimed at a reviewer or scanner, no secret access, no obfuscation, no remote code execution from a Claude Code install, and no instruction to change Claude Code settings, permissions or CLAUDE.md.

## skills.sh audits: why brainstorming and using-superpowers show Medium

Source: `GET https://skills.sh/api/v1/skills/audit/obra/superpowers/<skill>` and the per-provider pages, fetched 2026-10-24. The page text came through a model-summarised fetch, so treat the quotes as paraphrase; my own readings below are the check.

**brainstorming**

| Provider | Result | Date |
|---|---|---|
| Snyk | warn, MEDIUM, 1 issue: code W012, "Unverifiable external dependency detected (runtime URL that controls agent)", score 0.70. It says the skill "fetches a branding logo from primeradiant.com at runtime". | 2026-10-22 |
| Gen Agent Trust Hub | pass, SAFE; notes it ingests click data from the companion browser session (indirect prompt injection surface) | 2026-10-22 |
| Socket | pass, no alerts | 2026-10-22 |
| Runlayer | fail, HIGH, "3/8 files flagged", no detail published | 2026-03-13 |
| ZeroLeaks | pass, 93/100 | 2026-04-16 |

The Medium is the Snyk W012 finding and it is real but small: it is the logo beacon in item 1 above (confirmed at `server.cjs:106`). The title overstates it: the URL is an `<img>` loaded by the user's browser, so it cannot instruct the agent. It is a telemetry dependency, disclosed, with an opt-out. The Runlayer HIGH is seven months old, predates the v7.0.0 rebuild of brainstorming (2026-10-09), and names no files, so I cannot map it to anything in this pin. The Trust Hub note is accurate and bounded: the events file holds `data-choice` and button text that the agent itself wrote into the mockup, and writing to the server needs the session key.

**using-superpowers**

| Provider | Result | Date |
|---|---|---|
| Gen Agent Trust Hub | warn, MEDIUM, categories PROMPT_INJECTION, PERSISTENCE, INDIRECT_PROMPT_INJECTION | 2026-09-19 |
| Snyk | pass, LOW | 2026-09-19 |
| Socket | pass | 2026-09-19 |
| Runlayer | pass, 2 files | 2026-03-11 |
| ZeroLeaks | pass, 93/100 | 2026-04-16 |

The Medium is one provider's three findings, all from the Trust Hub:
1. PROMPT_INJECTION: the `<EXTREMELY-IMPORTANT>` block ("YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.") and the "Red Flags" table that labels hesitation as rationalisation. Confirmed in `SKILL.md`. It is behaviour-shaping pressure language, not an attack on a reviewer, and the skill ends by deferring to CLAUDE.md, AGENTS.md and direct requests. It still matters: the hook injects it every session, and upstream issues #2377 and #2509 show it can crowd out a repo's own rules.
2. PERSISTENCE: `references/codex-tools.md` shows TOML for `~/.codex/config.toml`. Confirmed. It applies to Codex only and is not read on Claude Code.
3. INDIRECT_PROMPT_INJECTION: the skill points at CLAUDE.md, AGENTS.md, GEMINI.md, SOUL.md and config files as instruction sources. True of any skill that honours project instructions; the Trust Hub itself says the only boundary is human control.

My conclusion: neither Medium is evidence of malice. One is a disclosed logo beacon, the other is forceful wording plus a Codex-only config note. Both are the right kind of thing to condition rather than reject.

## Wiring and overlap with crew

- `skills/deliver/SKILL-MAP.md` makes `crew:grill-with-docs` the primary requirements step and superpowers `brainstorming` secondary. `using-superpowers` says to invoke brainstorming before plan mode and to check skills before clarifying questions. The operating card or persona instructions must say the SKILL-MAP wins, which `using-superpowers` allows (instruction files outrank skills).
- `test-driven-development` is not used by crew (mattpocock `tdd` is primary). Both carry an "iron law" and would double context if both fire.
- `finishing-a-development-branch` offers merge, push and PR. The crew protocol keeps pushing and merging at the release gate, which the user opens. Use the skill only there.
- `writing-plans` and `brainstorming` default to `docs/superpowers/...`, not `.scratch/<feature>/`. On a repo whose operating card says otherwise, the card wins; in a repo with blocked paths under `docs/`, they must be redirected.
- `subagent-driven-development` and `executing-plans` write `.superpowers/sdd/` in the working tree, self-ignored.
- The version is one release behind: `v7.0.1` exists upstream (commit 2ce8aa1, 2026-10-21, "brainstorming retune, skills that better survive compaction, contribution templates"; 64 files changed). The catalog still pins `bb92a77`, so this card is correct for what installs today. Treat 7.0.1 as an upgrade-watch item.

## Conditions of use

1. User-level acceptance of the High rating (see the decision below), recorded in `registry/dependencies.json` or the CHANGELOG.
2. Install only through the catalog entry, which pins `bb92a77`. Do not follow the README's "fetch and follow" install routes for other harnesses.
3. Run with `SUPERPOWERS_DISABLE_TELEMETRY=1` in the environment that launches Claude Code, so the companion's logo is not fetched. (`DISABLE_TELEMETRY=1` also works.)
4. Do not offer the visual companion in crew runs unless the user asks. Never pass `--host 0.0.0.0` or set `BRAINSTORM_OPEN_CMD`.
5. `diagnosing-superpowers` is user-invoked only. No persona calls it, because it reads the session store and the store can hold other businesses' conversations.
6. `finishing-a-development-branch` only at the release gate, with the user choosing from its menu.
7. Persona instructions state that the SKILL-MAP, the operating card and repo rules outrank `using-superpowers`.
8. Do not run anything under the installed plugin's `tests/` or `scripts/`.
9. Pin stays at `bb92a77` until an upgrade card for 7.0.1 is approved.

## Decision for the user

The scanner floor is High because the scanner reads the whole clone, and the plugin cache copies the whole clone. Every High finding is in files Claude Code never loads (tests, plans, release notes, a contributor guide). Scoped to the loaded surface (`skills/`, `hooks/`, `.claude-plugin/`) the floor is Medium. By the rubric that means: don't recommend. By reading, I would recommend with the conditions above. This card follows the rubric and leaves the call to you:
- Keep superpowers as a required pack, accepting High with the nine conditions; or
- Drop it from `required` and move the four used skills into a vendored copy (MIT permits it); or
- Ask for the scanner to report a second, runtime-scoped floor so a card can show both numbers.

## Install / uninstall

```
claude plugin install superpowers@claude-plugins-official
claude plugin uninstall superpowers@claude-plugins-official
```

The catalog entry is a url source pinned to `bb92a77741419a4ab5f06e711a283343f1ada0c3`. If the catalog moves that SHA, `crew outdated` will report it and this card no longer applies.

For crew: keep as a required plugin dependency, subject to the decision above; do not vendor yet.

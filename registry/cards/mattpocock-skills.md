# Risk card: mattpocock-skills

| | |
|---|---|
| **Verdict** | Don't recommend under the rubric (High follows the scanner floor). Keep as a required pack only if the user accepts the conditions below. See "Decision for the user". |
| **Risk** | High (scanner floor: High). A reading-based judgement would be Medium; the rubric does not let a judgement lower the floor. |
| **Source** | mattpocock/skills @ 49dd158d1076134a641b33efb035946536778336 (plugin version 1.3.1), plugin root `./`, as pinned by the `claude-plugins-official` catalog entry (catalog commit 58267944f9) |
| **Maintainer** | Matt Pocock (author of Total TypeScript, publishes at aihero.dev, which the plugin manifest names as author URL and homepage). User-owned repo, created 2026-02-03, about 302k stars, last push 2026-10-22, 499 of about 520 commits by him, not archived. Listed in Anthropic's official catalog with a SHA pin. |
| **Licence** | MIT; vendorable: yes (crew already vendors the user-only skills under `vendor/mattpocock`) |
| **Kind** | Plugin: 27 skills, 0 agents, 0 hooks, 0 MCP servers, 0 LSP servers |
| **Always-on cost** | About 1,650 tokens per `plugin details` (11 model-invocable skills plus 16 user-only ones that cost descriptions only) |
| **Vetted** | 2026-10-24, by crew:skill-scout |

## What it does

An engineering workflow as skills: interview a plan (`grilling`), keep a glossary and ADRs (`domain-modeling`), turn a conversation into a spec and tickets, implement test-first, review on two axes, diagnose hard bugs with a feedback loop, prototype, research, and generate an interactive bash wizard for steps only a human can do. Sixteen of the 27 are `disable-model-invocation: true`, so an agent cannot call them through the Skill tool; crew vendors those as `crew:*` so personas can.

Model-invocable at this pin: `code-review`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `grilling`, `pr`, `prototype`, `research`, `tdd`, `wizard`, `writing-for-agents`. User-only: `ask-matt`, `grill-me`, `grill-with-docs`, `handoff`, `implement`, `implement-spec`, `improve-codebase-architecture`, `retro`, `setup-matt-pocock-skills`, `teach`, `to-questionnaire`, `to-spec`, `to-tickets`, `triage`, `wait-what`, `wayfinder`.

## Gain for this task

It is crew's primary source for requirements (`grilling`, `domain-modeling`), tickets, test-first (`tdd`), review (`code-review`), hard bugs (`diagnosing-bugs`), module design (`codebase-design`) and human-only steps (`wizard`), per `skills/deliver/SKILL-MAP.md`. Nothing else installed covers the grill-to-tickets chain. The superpowers plugin overlaps on TDD, debugging and review, with the primaries named in the SKILL-MAP.

## Files reviewed

Pin cloned to scratch and checked out; nothing run. 190 files. The plugin manifest registers 27 skills by path; everything else in `skills/` (`misc/`, `in-progress/`, `deprecated/`) is on disk but not loaded. Coverage, stated plainly:

Read in full, line by line:
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`, `.github/workflows/release.yml` (changesets release job, `contents: write` for its own repo only)
- `skills/engineering/`: `wizard/SKILL.md` and `template.sh`, `diagnosing-bugs/SKILL.md` and `scripts/hitl-loop.template.sh`, `setup-matt-pocock-skills/SKILL.md`, `research`, `pr`, `retro`, `ask-matt/SKILL.md`, `triage/SKILL.md`, `AGENT-BRIEF.md`, `OUT-OF-SCOPE.md`, `to-spec`, `to-tickets`, `implement`, `implement-spec`, `code-review`, `improve-codebase-architecture/SKILL.md` and `HTML-REPORT.md`, `prototype/SKILL.md` and `UI.md`
- `skills/productivity/`: `handoff`, `grilling`, `grill-me`, `grill-with-docs` (in `engineering/`), `wait-what`, `to-questionnaire`, and the first 40 lines of `teach` and `writing-for-agents`
- `skills/misc/git-guardrails-claude-code/scripts/block-dangerous-git.sh` (not loaded; a PreToolUse hook script that blocks `git push` and `reset --hard`)

Read in part (opening sections, plus targeted greps for `gh`, `glab`, `curl`, `http`, `rm`, `.env`, `~/`, `/tmp`, `npm`, `install`, `push`):
- `wayfinder/SKILL.md` (first 60 lines, lines 100 to 140, and greps), `tdd/` (`SKILL.md`, `tests.md`, `mocking.md`), `domain-modeling/` (`SKILL.md` and formats), `codebase-design/` (`SKILL.md` head, `DEEPENING.md`, `DESIGN-IT-TWICE.md`), `prototype/LOGIC.md`, `setup-matt-pocock-skills/issue-tracker-*.md`, `domain.md`, `triage-labels.md`, `teach/` formats, `writing-for-agents/SKILL-MECHANICS.md`, `ask-matt/PHASE-BOUNDARIES.md`

Scanned only: `docs/` (published pages), `.agents/`, `.out-of-scope/`, `.changeset/`, `CHANGELOG.md`, `README.md`, `scripts/link-skills.sh` (symlinks skills into `~/.claude/skills`; maintainer script), `skills/in-progress/`, `skills/misc/` other than the guardrail script. A hidden-Unicode, base64 and HTML-comment sweep over the whole clone found nothing (three benign HTML comments in `wayfinder`). No binaries, no archives. The per-skill `agents/openai.yaml` files are Codex metadata, not loaded by Claude Code.

## Red flags

Scanner, whole clone: 9 high, 32 medium, 56 info, floor High. The 9 high findings:
- config-tamper (2): `README.md:62` and `.agents/install-block.md:60`, "add to `~/.copilot/settings.json`". Install instructions for Copilot; not read at runtime.
- injection-phrase (1): `CHANGELOG.md:55`, a changelog entry about rewording instructions "for the agent to tell the human to run" a user-only skill. A mention, not an instruction aimed at a reviewer.
- secret-path-read (5): `CHANGELOG.md:108`, `docs/engineering/wizard.md:3,30,67` and `skills/engineering/wizard/template.sh:106`. The first four are prose that says the wizard reads `.env*` and `secrets.*` references. The last is a code comment on `ask()`.
- prerequisite-download (1): `docs/engineering/diagnosing-bugs.md:75`, an FAQ answering why Snyk flags the shell script in `diagnosing-bugs`.

Only one high is in a loaded skill, and it is the `template.sh` comment. Scanner on `skills/engineering` alone: 1 high, 5 medium, floor High; on `skills/productivity` alone: 0 high, 3 medium, floor Medium. Medium findings: `setup-matt-pocock-skills` (edits CLAUDE.md or AGENTS.md), `writing-for-agents` and `ask-matt` (mention those files), `wizard/template.sh:210` (an example URL, `dashboard.stripe.com`).

Found by reading:
1. **`improve-codebase-architecture` loads unpinned remote scripts in a local report.** `HTML-REPORT.md` has the agent write a self-contained HTML file to the OS temp directory, open it, and load `https://cdn.tailwindcss.com` (no version) and `https://cdn.jsdelivr.net/npm/mermaid@11/...` (major version only) with `securityLevel: "loose"`. The page content is repo-derived text the agent writes, shown in the user's browser, with no local secrets in the browser. skills.sh also rates this skill Medium (Trust Hub warn MEDIUM; Snyk warn MEDIUM, 1 issue). User-only, so no persona runs it unprompted.
2. **`wizard` has the agent read `.env*`.** Step 1 says to read `.env`, `.env.example`, `.env.*`, `docker-compose*` and CI `secrets.*` references. The generated script is for a human to run: it opens URLs with `open`/`xdg-open`/`wslview`, reads secrets with hidden input, writes `.env` at mode 0600 and calls `gh secret set`. It makes no network calls of its own. The risk is the agent reading a real `.env` into context.
3. **`implement-spec` writes outside the repo.** Its optional exploration subagent saves notes "in a directory outside the repo". That conflicts with the crew protocol (work inside the repo or your own worktree).
4. **`wayfinder` pushes.** Charting tells research subagents to "push the branch" `research/<name>` without opening a PR. It also uses `gh issue create`, `gh issue edit --add-assignee @me`, `gh api` for native dependencies, and closes issues. Pushing is a release-gate action under the crew protocol.
5. **`triage`, `to-spec`, `to-tickets`, `wayfinder` write to the live issue tracker** when the tracker is GitHub or GitLab (`gh issue create/comment/close`, labels, sub-issues). With the local-markdown tracker (`.scratch/<feature>/`) they write files only.
6. **`retro` reads session logs** "on this machine", the same cross-business exposure as `diagnosing-superpowers`. User-only.
7. **`diagnosing-bugs` does not sanitise artefacts well enough alone.** It does open with a Redact section, but the docs page admits upstream issue #674 (redaction guardrail) is open. The ask for HAR files and core dumps is the exposure.
8. **Dangling reference.** `registry/dependencies.json` (`why`) and `agents/developer.md:27` name `resolving-merge-conflicts`. It was removed from the plugin in v1.3.0 (`docs/engineering/resolving-merge-conflicts.md` says so) and is not in the 27 registered skills at this pin. See Wiring.

No injection aimed at a reviewer or scanner, no obfuscation, no hooks, no MCP or LSP servers, no remote code execution outside the report scripts in item 1, and no instruction to change Claude Code settings or permissions. `setup-matt-pocock-skills` edits the repo's CLAUDE.md or AGENTS.md, in the open, after showing the user a draft.

## Second opinions

skills.sh audits (`GET /api/v1/skills/audit/mattpocock/skills/<skill>`, 2026-10-24): `wizard` Trust Hub pass SAFE, Socket pass, Snyk pass LOW; `diagnosing-bugs` Trust Hub pass SAFE, Socket pass, Snyk pass LOW (the upstream FAQ calls an earlier Snyk High on it a false positive); `improve-codebase-architecture` Trust Hub warn MEDIUM, Snyk warn MEDIUM, Socket pass, Runlayer pass, ZeroLeaks 93/100. The only Medium I could confirm corresponds to item 1. I did not query the other 24 skills.

## Wiring and overlap with crew

- `resolving-merge-conflicts` is gone at this pin, so `agents/developer.md:27` and the `why` line in `registry/dependencies.json` point at nothing. The installed plugin in this session still lists the skill, which means it is older than the pin. Either change the developer instruction (the upstream page says the agent handles conflicts without a dedicated skill) or note that the dependency text is out of date. I made no edit.
- Superpowers `test-driven-development` and mattpocock `tdd` overlap; SKILL-MAP makes `tdd` primary.
- The user-only skills (`to-spec`, `to-tickets`, `implement`, `triage`, `wayfinder`, `grill-with-docs`, `improve-codebase-architecture`, `handoff`, `to-questionnaire`) are reachable by personas only through crew's vendored copies, which must be re-synced after any bump. Anything that edits `vendor/` goes through `sync-upstream.mjs`.
- Upstream is two commits ahead of the pin (`5beb35b` 2026-10-19, `chief-of-staff` in `in-progress/`, not loaded). No upgrade risk from it; the catalog still pins `49dd158`.

## Conditions of use

1. User-level acceptance of the High rating (see the decision below).
2. Install only through the catalog entry, which pins `49dd158`. Install the plugin or skills.sh, never both (upstream warns of duplicates).
3. `wizard`: the agent reads `.env.example` and CI `secrets.*` names, never a real `.env`, and never runs the generated script. This matches the protocol line that human-only credential steps go through `wizard`.
4. `wayfinder`: tell its research subagents not to push; crew's release gate owns pushes. Use the local-markdown tracker unless the user has chosen GitHub.
5. `implement-spec`: exploration notes go under the feature's `.scratch/` folder, not outside the repo.
6. `improve-codebase-architecture` runs only when the user asks. Open the report knowing it loads two CDN scripts; no secrets may appear in it.
7. `retro` and `handoff` are user-invoked only. `retro` reads session logs; `handoff` writes to the OS temp directory and redacts secrets by instruction.
8. `diagnosing-bugs` output stays redacted; a persona must not paste raw HAR or core-dump contents into tickets or reviews.
9. Never run `scripts/link-skills.sh`, and never enable anything under `skills/misc/` or `skills/in-progress/`.

## Decision for the user

Same shape as the superpowers card. The scanner floor is High because it reads the whole clone; the High findings are prose, a changelog entry, install notes for other agents and one code comment. On the loaded surface the genuine exposure is Medium (item 1, plus item 2 through 5 as conditioned behaviour). By the rubric: don't recommend. By reading: recommend with the nine conditions. Options:
- Keep as a required pack, accepting High with the conditions; or
- Narrow the dependency to vendored copies of the skills crew actually calls, for which MIT permits it; or
- Ask for a runtime-scoped second floor in the scanner.

## Install / uninstall

```
claude plugin install mattpocock-skills@claude-plugins-official
claude plugin uninstall mattpocock-skills@claude-plugins-official
```

The catalog entry is a url source pinned to `49dd158d1076134a641b33efb035946536778336`.

For crew: keep as a required plugin dependency (user-only skills stay vendored under `vendor/mattpocock`), subject to the decision above.

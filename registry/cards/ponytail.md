# Risk card: ponytail

| | |
|---|---|
| **Verdict** | don't recommend (full plugin); don't recommend for now (skill only). The developer persona is the only fit, and only after a crew-run eval shows a gain. |
| **Risk** | High for the full plugin (scanner floor: High). Low for `skills/ponytail/` on its own (scanner floor: Low). The whole `skills/` folder has a scanner floor of Medium, because its help skill tells users to enable auto-update. |
| **Source** | DietrichGebert/ponytail @ 16352ac229eb08a9598dcae48fe9f2b342567d86 (v5.3.2, GitHub's "latest" release). Plugin path `./` (the whole repository is the plugin root). Skill-only path `skills/ponytail/SKILL.md`. |
| **Maintainer** | DietrichGebert: GitHub account since June 2023, three public repositories, about 2,600 followers, no profile details. The repository dates from June 2026 and has about 175,000 stars and 355 commits from 131 authors; the owner wrote most of them. It ships frequent releases. The publish workflow pins its Actions to commit SHAs and publishes to npm through OIDC with provenance, a good supply-chain signal. The plugin is not in Anthropic's official catalog; the community catalog lists an older commit. The README warns that impostor copies exist ("it never ships .exe or .dll files"). skills.sh lists four look-alike `ponytail` skills from other owners. Match candidates by owner and repo. |
| **Licence** | MIT. Vendorable: yes. |
| **Kind** | Plugin: 6 skills and 3 command hooks, plus a "band" module of function hooks with user settings that include a webhook. No agents, MCP or LSP servers. The skill-only route is a single instruction file. |
| **Always-on cost** | Full plugin: about 641 tokens of descriptions. On top of that, the hooks inject the ruleset (about 1,000 tokens) plus a codebase map (up to 2,000 characters) into every session. They inject the ruleset again into every subagent. `plugin details` labels the hooks "no model context cost", which is wrong for these hooks. Skill only: about 140 tokens, plus about 1,100 each time it is invoked. |
| **Vetted** | 2026-10-24, by crew:skill-scout |

## What it does

The skill tells the agent to make the smallest complete change. It works down a ladder before writing anything new:

1. Does it need to exist?
2. Does it already exist in this codebase?
3. Can the standard library or the platform do it?
4. Can an installed dependency do it? (Never add a dependency for a few lines.)
5. Can it be one line?
6. Otherwise, write the minimum code that works.

It never cuts validation, data-loss handling, security or accessibility. Other rules:

- Non-trivial logic leaves "one small test or an assert-based self-check".
- A known limit gets a `shortcut:` comment.
- Every reply ends with one or two lines on what was skipped or not checked.

The plugin adds more on top:

- Hooks keep the ruleset on in every session and subagent.
- A codebase map is injected at session start.
- A status band above the prompt records each task's cost, tokens and reuse to a local ledger after every turn, with an optional webhook.
- Five more skills: review, audit, debt ledger, gain scoreboard and help.

## Gain for this task

Small, and mostly already covered by crew.

**What the upstream benchmark measured.** The author's own benchmark (`benchmarks/results/2026-10-07-agentic.md`; not independent) used Opus 5.5 under `claude -p`: 39 tasks, 5 runs each. Bash was disabled, no `CLAUDE.md` was loaded, and there was no spec. Against the same agent without the skill, the geometric means were:

- lines of code −53% [−63, −41]
- output tokens −45%
- cost −26% [−36, −16]
- time −41%

Those gains come mostly from open-scope tasks where the agent picks the size. Examples: a date picker went from 335 lines to 10, a wizard from 311 to 90, a small LangGraph app from 148 to 29.

The 18 fixed-scope tasks have hidden checks. On those, line counts are mostly level (18/16, 11/11, 12/14, 9/9, 20/21, 3/3, 9/9) and correctness is level (95.6% against 96.7%).

On tests, "a test where the logic needs one" rose from 68% to 98%. But where a test existed, the agent's own tests caught 77% of injected bugs without the skill and 69% with it.

A blind judge preferred the no-skill replies, 106 to 82 (p = 0.09).

**How that maps onto crew.** Crew removes the conditions under which those gains appeared:

- **Fixed scope.** Every size, including a one-line fix, gets a ticket with acceptance criteria.
- **Tests always exist.** `crew:developer` works test-first per acceptance criterion with mattpocock `tdd`. At crew's pinned 1.3.1 that skill says "only enough code to pass it. Don't anticipate future tests or add speculative features."
- **Over-building is already reviewed.** `crew:reviewer` runs mattpocock `code-review`. Its Standards axis carries the Speculative Generality smell ("abstraction, parameters, or hooks added for needs the spec doesn't have → delete it"). Its Spec axis flags "behaviour in the diff that wasn't asked for (scope creep)".

So the over-building ponytail prevents is already caught twice. Its test-rate gain is already guaranteed by TDD. In crew's regime, where a test always exists, the benchmark's own numbers suggest ponytail's tests are weaker.

**The 200-word report rule.** Crew's protocol caps the report at 200 words in fixed fields. Ponytail's "end your reply with one or two lines" would compete with "return exactly this block". Its useful core, naming what was not checked, could fit inside crew's existing `questions` and `evidence` fields.

**What crew does not already cover.** No crew file and no mattpocock skill tells the developer to look for an existing helper, a platform feature or an installed dependency before writing new code. Code-review's Duplicated Code smell only compares hunks within the change, so re-implementing a helper that already lives elsewhere in the repository can pass review. Ladder rungs 2 to 4 fill exactly that gap. It is real but narrow. One sentence in the developer's build step and in the reviewer's brief would capture it, without importing a second ruleset whose test rule and reply rule conflict with crew. Vendored text cannot be edited to remove those conflicts.

**Persona fit.** Only the developer, and not until a crew-run eval shows a gain.

- The reviewer already has a primary review skill, and ponytail-review would be a competing second process.
- The business analyst and tech lead would inherit `ultra`'s "push back on the request". After a G2 sign-off, that belongs in a `needs-human` question, not a unilateral cut.
- No other persona writes code.

## Files reviewed

Pinned clone at `$TMPDIR/crew-scout/DietrichGebert__ponytail@16352ac229eb08a9598dcae48fe9f2b342567d86`, 213 files. Nothing in it was run.

Skill-only route, read line by line (this is every file in it):

- `skills/ponytail/SKILL.md`: the ruleset described above. No tools, network or persistence. "Active for the whole session until the user says stop ponytail".

Plugin runtime, read line by line:

- `.claude-plugin/plugin.json`: hooks `./hooks/claude-codex-hooks.json` and `./hooks/claude-band.json`. The `userConfig` defaults are `ledger: true`, `webhookUrl: ""`, `webhookToken` (kept in the keychain) and `sendNames: true`.
- `.claude-plugin/marketplace.json`: `source: "./"`.
- `hooks/claude-codex-hooks.json`: SessionStart (startup, resume, clear, compact), SubagentStart and UserPromptSubmit. Each runs `node -e "require(…/hooks/ponytail-*.js)"`.
- `hooks/ponytail-activate.js`: mode flag in `~/.claude/.ponytail-active` and `~/.claude/ponytail-modes/`. Injects the ruleset and the codebase map. Copies `ponytail-statusline.sh` into `~/.claude/` and emits "Proactively offer to set this up for the user on first interaction" with a `settings.json` snippet.
- `hooks/ponytail-subagent.js`: injects the ruleset into every subagent unless `PONYTAIL_SUBAGENT_MATCHER` is set.
- `hooks/ponytail-mode-tracker.js`: `/ponytail` level switches. `/ponytail band import` spawns the import script detached.
- `hooks/ponytail-config.js`, `ponytail-runtime.js`, `ponytail-instructions.js`: config resolution (default `full`), per-host output shapes, and ruleset loading. Local only.
- `hooks/ponytail-map.js`: runs `git ls-files` and regex-lists exported names, capped at `PONYTAIL_MAP_CHARS` (2,000 by default). Keeps unsafe path names out.
- `hooks/claude-band.json`, `hooks/band/register.tsx`: wraps every Bash, Edit and Write tool call, passing each through unchanged and recording the result. Runs `git grep` at session start and after each turn, and greps the session transcript for its title and model. Writes `~/.config/ponytail/band/<project>.csv` and `board.html` after every turn. POSTs the row to the webhook when one is set. Opens the board with `open`, `xdg-open` or `start` on a button press.
- `hooks/band/metrics.ts`: pure helpers, CSV row building, and the webhook request (https only, or http to localhost).
- `hooks/band/board.ts`: a self-contained HTML page with no network calls. Names are inserted as text, not HTML. Theme stored in `localStorage`.
- `hooks/band/logo.ts`: two string constants of SVG path data (the scanner's "obfuscation" hit).
- `hooks/band/types.d.ts`.
- `hooks/ponytail-band-import.js`: reads every `~/.claude/projects/*/*.jsonl` transcript, including subagent transcripts, and appends each session's name (60 characters), cost, tokens and model to the ledger.
- `hooks/ponytail-statusline.sh`, `.ps1`, `hooks/copilot-hooks.json`, `cursor-hooks.json`, `qoder-hooks.json`.
- `skills/ponytail-review`, `-audit`, `-debt`, `-gain` and `-help` (each `SKILL.md`), plus `skills/plugin.json`.
- `scripts/uninstall.js`, `cursor-hooks.js`, `check-rule-copies.js`, `check-versions.js`, `build-openclaw-skills.js`, `publish-openclaw-skills.js`.
- `.opencode/plugins/index.js`, `ponytail-frontmatter.cjs`; `package.json`, `plugin.yaml`, `plugin.json`, `opencode.json`, `gemini-extension.json`, `after-install.md`.
- The host manifests under `.codex-plugin/`, `.devin-plugin/`, `.kimi-plugin/`, `.qoder-plugin/`, `.grok-plugin/`, `.github/plugin/` and `.agents/plugins/`.
- `.github/workflows/publish.yml`, `test.yml`, `FUNDING.yml`, `.gitignore`, `LICENSE`, `README.md`, `AGENTS.md`.
- `benchmarks/results/2026-10-07-agentic.md`, `benchmarks/arms/*.js`, `benchmarks/.env.example`.

Verified identical to their canonical source by comparison rather than re-reading:

- The seven rule copies (`.agents/rules/`, `.clinerules/`, `.github/copilot-instructions.md`, `.qoder/rules/`, `.windsurf/rules/`, `.cursor/rules/`, `.kiro/steering/`) all match `AGENTS.md`.
- The six `.openclaw/skills/*/SKILL.md` files match `skills/*` in body.
- `commands/*.toml` and `.opencode/command/*.md` are condensed copies of the skills (read).

Covered by targeted grep and the scanner's findings rather than a full read: `.opencode/plugins/ponytail.mjs`, `pi-extension/` and `__init__.py` (the OpenCode, pi and Hermes adapters: mode flag and ruleset injection, no network); `tests/*`; the rest of `benchmarks/`; `docs/`, `examples/`, `i18n/` and `INSTALL.md`. Image assets were checked by the scanner as valid media.

## Red flags

**Scanner, whole repository:** floor High; 19 high, 22 medium and 83 info findings.

High findings, all false positives on reading:

- `injection-phrase`: `INSTALL.md:206` (describes a CLI flag to a person: "take all six without asking with `--skill '*'`"); `benchmarks/agentic/tasks.py:16` (a docstring); `tests/map.test.js:12,20` (a fixture proving injected names are kept out of the map). None addresses an agent or a reviewer.
- `secret-path-read`: `benchmarks/.env.example:1`, `benchmarks/README.md:29,34`, `benchmarks/agentic/judge.py:48`, `benchmarks/results/2026-06-16-robustness-audit.md:135`. The user-run benchmark reads `ANTHROPIC_API_KEY` from the environment.
- `config-tamper`: `benchmarks/agentic/run.py:321` and `README.md:152` (the benchmark runs `claude -p --permission-mode bypassPermissions` with Bash disallowed, in temporary copies); `scripts/uninstall.js:87` (removes its own statusLine entry); `scripts/check-rule-copies.js:70`; `tests/hooks.test.js:330-374` (fixtures in a temporary directory).
- `obfuscation`: `hooks/band/logo.ts:3` (SVG path data).

Medium findings:

- `hooks` at `hooks/claude-codex-hooks.json:9,21,33`.
- `auto-update` at `skills/ponytail-help/SKILL.md:70` and its `.openclaw` copy.
- `network-call` at `hooks/band/register.tsx:161` (the webhook) and `benchmarks/agentic/judge.py:83` (the Anthropic API, benchmark only).
- `telemetry` (benchmark wording only).

**Found by reading, full plugin:**

1. **Every crew persona would be affected.** The SubagentStart hook injects the ruleset into every subagent by default. Crew's own agents ignore hooks, but a user-level plugin's hooks still fire on them. All eleven personas would get "End your reply with one or two lines…", which contradicts the protocol's "Return exactly this block". The reviewer and QA personas would also get a build-time rule set.
2. **Edits to the user's configuration.** The SessionStart hook copies a script into `~/.claude/` and asks the agent to offer an edit to `~/.claude/settings.json`. Crew forbids its agents to touch `~/.claude/`.
3. **On by default everywhere**, in every session and repository, not only in crew runs.
4. **Local ledger of every task, on by default.** The band writes a per-project CSV row after every turn: the task name taken from the first prompt or sidebar title, plus cost, tokens and model. It keeps doing so until `ledger` is turned off.
5. **Cross-business mixing.** `/ponytail band import` copies every past session's name into one ledger, across every repository on the machine. For a crew that serves several separate businesses, that is one local file mixing all of them. It stays local unless a webhook is set.
6. **Optional webhook.** It sends the same rows, task names included by default, to any https endpoint.
7. **Unpinned updates.** The help skill tells users to turn on marketplace auto-update, which pulls new versions at startup.
8. **Competing review skills.** `ponytail-review` and `ponytail-audit` trigger on "review this", "code review" and "review my PR". They compete with crew's primary review skill, against the one-primary-per-concern rule in `skills/deliver/SKILL-MAP.md`.
9. **Test rule conflict.** "One small test or an assert-based self-check", including inline asserts in production code, conflicts with crew's test-first rule. Open upstream issue #1213 asks for exactly this rule to defer to a project's own test policy.

**Found by reading, skill only:**

- the test-rule conflict above
- the reply-ending rule against the protocol block
- session-long persistence
- an aggressive trigger ("Use on any coding task")
- `ultra`'s push-back on signed-off scope

Corroboration from the skills.sh audit for `dietrichgebert/ponytail/ponytail`: Agent Trust Hub "SAFE", Socket "no alerts", Snyk "LOW".

## Conditions of use

**Full plugin:** none recommended. If you install it anyway, all of these are required:

- `PONYTAIL_SUBAGENT_MATCHER='^crew:developer$'`, so only the developer receives the ruleset.
- `PONYTAIL_DEFAULT_MODE=off` in repositories outside crew.
- `--config ledger=false` and an empty `webhookUrl`.
- Never run `/ponytail band import`.
- Decline the statusline offer.
- Leave marketplace auto-update off.

Even then, the hooks run with your full user permissions in every session.

**Skill only, if you want to test it:**

- Use the developer persona only.
- Vendor it through `vendor/UPSTREAM.json`, pinned to this commit, with a description override that limits it to the developer. Do not install it loose in `~/.claude/skills/`, where "Use on any coding task" would make it fire for every persona.
- Add a line to `agents/developer.md` stating that mattpocock `tdd` and the protocol report take precedence over ponytail where they differ.
- Never use `ultra`.
- Write `shortcut:` comments only where the repository's conventions allow them.
- Keep it out of human-facing text.
- Adopt it only if `claude plugin eval .` shows developer runs with it beating runs without it on cost and on reviewer findings.
- It fits the always-on budget: crew is at about 2,758 tokens against a ceiling of 4,000, and the skill adds about 140.

**Cheaper alternative, worth a decision:** add one sentence to the developer's build step and to the reviewer's brief: "before writing a helper or adding a dependency, check whether the repository, the standard library, the platform or an installed dependency already does it." That closes the one gap the evidence supports, with no third-party text.

## Install / uninstall

Full plugin: no command is given, because it is not recommended. Upstream's route (`claude plugin marketplace add DietrichGebert/ponytail`, then `claude plugin install ponytail@ponytail`) follows the default branch and is not pinned.

Skill only, pinned to the vetted commit, for your own manual use (not recommended inside crew):

```
mkdir -p ~/.claude/skills/ponytail && curl -fsSL https://raw.githubusercontent.com/DietrichGebert/ponytail/16352ac229eb08a9598dcae48fe9f2b342567d86/skills/ponytail/SKILL.md -o ~/.claude/skills/ponytail/SKILL.md
rm -rf ~/.claude/skills/ponytail
```

For crew: leave it out for now. If a crew eval later shows a gain, vendor `skills/ponytail` (MIT) through `vendor/UPSTREAM.json` at commit 16352ac229eb08a9598dcae48fe9f2b342567d86, then run `node scripts/sync-upstream.mjs sync`. Do not add it to `registry/extras.json`.

# Risk card: caveman

| | |
|---|---|
| **Verdict** | reject (full plugin); don't recommend (skill only) |
| **Risk** | Reject for the full plugin (scanner floor: High). Low for `skills/caveman/` on its own (scanner floor: Low). |
| **Source** | JuliusBrussee/caveman @ d262ab3882952a59312ff3537cd86d894523c5ab (v4.0.1, GitHub's "latest" release). Plugin path `./` (the whole repository is the plugin root). Skill-only path `skills/caveman/SKILL.md`. The later `bin-v4.0.2` tag is a binary-only release line and does not change the skill. |
| **Maintainer** | Julius Brussee: GitHub account since April 2022, about 2,900 followers, company field "Caveman". The repository dates from April 2026 and has about 114,000 stars and 1,762 commits, 1,387 of them by the owner. It is actively maintained, with a release every few days. The repository also sells a hosted service, Caveman Cloud, which several of the bundled skills set up. The plugin is not in Anthropic's official catalog. The community catalog lists it pinned to an August commit from before v2. A look-alike exists: `mattpocock/skills/caveman`, which its author has since withdrawn, still shows about 214,000 installs on skills.sh. Match candidates by owner and repo. |
| **Licence** | Apache-2.0 (contributions made before 3.0.0 also remain under MIT, kept in `LICENSE-MIT`). Vendorable: yes, if `LICENSE` and `NOTICE` travel with the file. "Caveman" is a trademark, and only nominative use is allowed. |
| **Kind** | Plugin: 23 skills and commands, 3 agents and 4 hooks, with no MCP or LSP servers. The skill-only route is a single instruction file. |
| **Always-on cost** | Full plugin: about 1,991 tokens of descriptions. On top of that, the hooks inject the whole skill body into every session and every subagent: about 1,160 tokens by the README's count, or about 1,700 by `plugin details`. A reminder is added to every prompt as well. `plugin details` labels the hooks "no model context cost", which is wrong for these hooks. Skill only: about 80 tokens, plus about 1,700 each time it is invoked. |
| **Vetted** | 2026-10-24, by crew:skill-scout |

## What it does

The skill puts the agent in a terse register. It answers first and drops greetings, hedging and recaps. Code, commands, paths, numbers and error strings stay verbatim. It switches back to plain prose for security warnings, irreversible actions, questions to the user and anything persisted outside the chat: code, comments, commits, docs, issues, PRs and tickets.

The plugin goes much further. Its hooks force that register on every session and every subagent, by default, in every repository. It also ships a wider product:

- a skill that routes a repository's LLM traffic through the Caveman Cloud gateway
- a memory-file compressor that sends files such as `CLAUDE.md` to a model provider and overwrites them
- a token-sink analyser that drives a separate `caveman` CLI
- three "cavecrew" subagents
- six general workflow skills: lean-build, surgical-patch, verify-and-stop, investigate-first, safe-refactor and migration

## Gain for this task

None beyond what crew already does. This holds for both routes.

**The upstream evidence, read honestly.** The skill's own README reports a single eval run on the v3.1.0 text: ten prompts, output length only. Caveman produced 3% fewer output tokens at the median than a plain "Answer concisely." control, which the README itself calls "inside the noise". Ultracave produced 35% fewer. No quality-equivalence claim is published, and the run has not been repeated on v4.0.1. The rules cost about 1,160 input tokens per request. The plugin's own stats hook now prints "Savings: unknown" and calls its earlier fixed-ratio estimates unsupported. The external study the README cites, from JetBrains (86 coding tasks, not verified here), reports 8.5% fewer output tokens and no measurable quality loss. The README draws the same conclusion: agent sessions are mostly code and tool calls, which the voice leaves alone. The repository's "65% fewer tokens" headline covers the proxy and other components, not the skill.

**Where crew's tokens actually go.** A crew persona's output is either files or the protocol report. The files are specs, tickets, reviews, code and commits, and caveman's own rule 5 exempts all of them. The report is already capped at 200 words in a fixed field format, and the protocol already says "terse styles belong only in the report block." What is left for caveman to compress is the narration between tool calls, a small share of a subagent's spend. In exchange it adds about 1,160 to 1,700 input tokens to every persona that loads it. The expected net effect for crew is zero or negative.

**What crew already has for chat brevity.** The required mattpocock pack (pinned 1.3.1) includes `wait-what`. That skill argues that "be brief" style fixes produce a "caveman register" that is shorter but no clearer, and it repairs a confusing message by naming the listener's state instead. It is user-invoked and costs nothing until used.

**Persona fit.** None. The developer, reviewer, QA and release personas write files and reports, where caveman is either exempt or redundant. The main session runs gates G0 to G4 for a person, who should get complete sentences.

## Files reviewed

Pinned clone at `$TMPDIR/crew-scout/JuliusBrussee__caveman@d262ab3882952a59312ff3537cd86d894523c5ab`, 1,785 files. Nothing in it was run.

Skill-only route, read line by line (this is every file in it):

- `skills/caveman/SKILL.md`: the ruleset, nine rules plus a "when to break the rules" list. No network, no tools, no persistence beyond "stays on until stop caveman".
- `skills/caveman/README.md`: documentation, including the 3%-versus-"Answer concisely" figure.

Plugin surface, read line by line:

- `.claude-plugin/plugin.json`: four hooks. SessionStart and SubagentStart run `node src/hooks/caveman-activate.js`, UserPromptSubmit runs `node src/hooks/caveman-mode-tracker.js`, and SessionEnd runs `node src/hooks/caveman-stats.js --record`.
- `.claude-plugin/marketplace.json`: `source: "./"`, so the whole repository is installed.
- `src/hooks/caveman-activate.js`: injects the skill body every session; the `--subagent` flag injects it into every subagent except cavecrew agents and repos that opt out with `.caveman.json`. Copies the statusline script into `~/.claude/hooks/`. Emits "Proactively offer to set this up for the user on first interaction" with a `settings.json` snippet.
- `src/hooks/caveman-config.js`: mode resolution (environment variable, then repo `.caveman.json`, then user config, then `caveman` as the default, so it is on everywhere). Symlink-safe, size-capped, whitelisted flag input and output under `~/.claude/`. No network.
- `src/hooks/caveman-parse.js`: natural-language triggers. "be brief", "less tokens" and "shorter answers" switch the mode on for the whole session.
- `src/hooks/caveman-mode-tracker.js`: injects a reinforcement line on every prompt and runs the stats script for `/caveman-stats`.
- `src/hooks/caveman-stats.js`: reads the session transcript and appends to `~/.claude/.caveman-history.jsonl`. Local only.
- `src/hooks/cavecrew-model-overrides.js`: rewrites `model:` in the plugin's own agent files from `CAVECREW_*_MODEL` environment variables.
- `src/hooks/caveman-host-session-start.js`, `src/hooks/caveman-statusline.sh`: hooks for other hosts and the statusline badge. Local, defensive.
- `src/hooks/checksums.sha256`, `src/rules/caveman-activate.md`, `hooks/hooks-cursor.json`, `package.json`, `skills/registry.json`.
- `commands/caveman-init.md`, `commands/caveman-init.toml`: tell the agent to run `curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/src/tools/caveman-init.js | node - $ARGUMENTS` unless the current repository is a caveman checkout.
- `agents/cavecrew-builder.md`, `agents/cavecrew-investigator.md`, `agents/cavecrew-reviewer.md`, `skills/cavecrew/SKILL.md`: an ultracave builder, investigator and reviewer; the reviewer uses emoji severity markers.
- `skills/caveman-setup/SKILL.md`: wires LLM callsites to `gateway.caveman.so`, adds a `CAVE_API_KEY` to the repo's env file, and tells the agent to fetch integration docs from the remote docs site "and follow it".
- `skills/caveman-learn/SKILL.md`: drives the external `caveman` CLI and edits `CLAUDE.md` after per-edit consent.
- `skills/caveman-compress/SKILL.md`: sends a file's full text to the configured provider and overwrites the original.
- `skills/lean-build`, `surgical-patch`, `verify-and-stop`, `investigate-first`, `safe-refactor` and `migration` (each `SKILL.md`): short workflow rules with broad triggers.
- `skills/caveman-review/SKILL.md`, `skills/caveman-commit/SKILL.md`: terse review comments with emoji, and commit messages that omit AI attribution unless a user rule requires it.
- `LICENSING.md`, `NOTICE`, `TRADEMARKS.md`, `README.md` (evidence sections), `evals/README.md`, `evals/snapshots/results.json` (metadata).

Plugin surface, covered by grep and scanner output rather than a full read:

- The `SKILL.md` files of caveman-discover, -evidence-review, -explore, -manage, -optimize, -help, -stats, ultracave and megacave. These cover gateway labelling, evidence review, help text and the two sibling voices.
- `src/hooks/install.sh`, `install.ps1`, `uninstall.sh` and `uninstall.ps1` (the standalone installer, which edits `settings.json`).
- `src/tools/caveman-init.js`
- `skills/caveman-compress/scripts/*.py` (calls the provider over HTTP)

The rest of the repository was not read line by line: about 1,600 files under `proxy/`, `engine/`, `packages/`, `extension/`, `mcp/`, `browse/`, `mem/`, `shrink/`, `supabase/`, `tests/`, `docs/` and `.github/`. The plugin hooks do not load them. Their coverage is the scanner run, in which every injection-phrase and opaque-file finding was opened and checked. The full plugin's verdict does not depend on them.

## Red flags

**Scanner, whole repository:** floor High; 505 high, 1,226 medium and 1,351 info findings. In the parts a plugin install loads:

- `opaque-file`, `dist/caveman.skill:0`. A 4,410-byte binary archive in the plugin root, also listed in the npm `files`. Not opened.
- `remote-code-exec`, `commands/caveman-init.md:11` and `commands/caveman-init.toml:2`. The agent is told to run `curl … /main/… | node`.
- `remote-code-exec` and `prerequisite-download`: `CLAUDE.md:324`; `src/hooks/install.sh:5`, `install.ps1:6`, `uninstall.sh:5`, `uninstall.ps1:4`; `src/tools/caveman-init.js:7,94,219,311`; `agents/agents.json:156` and `agents/profiles/hermes.json:9` (a `curl | bash` installer for another agent).
- `config-tamper`: `src/hooks/install.sh:30`, `install.ps1:17`, `uninstall.sh:40,52,156`, `uninstall.ps1:43,54,172,184` (the installer edits `~/.claude/settings.json`); `agents/profiles/schema.json:133,146`; `skills/caveman-compress/README.md:163`.
- `secret-path-read`: `skills/caveman-setup/SKILL.md:160,166` (`$CAVE_API_KEY` in a curl command). The hits in `skills/caveman-compress/scripts/compress.py:69-86`, `src/hooks/caveman-config.js:402`, `caveman-mode-tracker.js:342` and `caveman-statusline.sh:48` are defensive deny-lists and comments.
- `runtime-instructions-fetch`: `commands/caveman-init.md:11`, `src/hooks/install.sh:5`, `src/tools/caveman-init.js:7`.
- `hooks`: `.claude-plugin/plugin.json:15,27,39,51`.

Elsewhere in the repository:

- All 16 high `injection-phrase` findings sit in test fixtures or in the proxy engine's prompt-relocation code: `engine/pixel/transform_anthropic.go:439`, `proxy/internal/cloudlink/link_test.go`, `packages/sdk/*/tests`, `tests/test_detect.py:45`. None addresses an agent or a reviewer.
- The other 11 `opaque-file` findings are eight gzip glyph atlases under `engine/pixel/assets/`, plus three JavaScript files whose NUL bytes are deliberate string sentinels. I read those three; they are benign.

**Found by reading, full plugin:**

1. **Unpinned remote code execution.** `/caveman-init` pipes a script from the `main` branch into `node` in every repository that is not a caveman checkout, which is every normal install. A copy of the same script already sits in the plugin cache. (Reject criterion.)
2. **Opaque file in the install.** `dist/caveman.skill` is copied with the plugin and was not reviewed. (Reject criterion.)
3. **Third-party data path.** `caveman-setup` is triggered by phrases such as "adding LLM spend observability". It points a repository's LLM calls at a hosted gateway and has the agent fetch remote instructions and follow them. It also says "Send it now — do not pause to ask permission" before a billable request. For a crew that works across several separate businesses, each with its own connector rules, this is a path for client data to leave the machine.
4. **Every crew persona would be affected.** Crew's own agents ignore hooks, but a user-level plugin's SubagentStart hook still fires on them. All eleven personas, including the reviewer and this scout, would receive about 1,160 to 1,700 extra tokens and a style rule that crew's protocol already covers.
5. **Edits to the user's configuration.** The SessionStart hook writes into `~/.claude/hooks/` and asks the agent to offer an edit to `~/.claude/settings.json`. Crew forbids its agents to touch `~/.claude/`.
6. **On by default everywhere**, in every session and repository, not only in crew runs.
7. **Data leaves through `caveman-compress`.** It sends memory files to a provider and overwrites them. Open issue #1354 reports that credential dotfiles (`.npmrc`, `.pypirc`, `.pgpass`) pass its sensitive-name check.
8. **Competing skills.** The six workflow skills and `caveman-review` trigger on the same tasks as crew's primaries in `skills/deliver/SKILL-MAP.md`: test-first, debugging, verification and review. The cavecrew agents duplicate crew's developer and reviewer. Two of these skills emit emoji.
9. **Overstated claim.** The repository's headline claim of 65% far exceeds the skill's own measured 3% against a terse control.

**Found by reading, skill only:** none. Corroboration from the skills.sh audit for `juliusbrussee/caveman/caveman`: Agent Trust Hub "SAFE", Socket "no alerts", Snyk "LOW", ZeroLeaks 93/100.

## Conditions of use

- **Full plugin:** none. Do not install it.
- **Skill only, if you decide to try it against this card's advice:**
  - Install it at user level and use it only in the main session, for your own chat, by typing `/caveman`.
  - Do not vendor it into crew, do not preload it in any persona, and do not add it to `registry/extras.json`.
  - Turn it off ("stop caveman") before running gates, since G0 to G4 are read by a person.
  - Remember that "be brief" in a prompt switches it on for the rest of the session.
- **What would change this card:** a crew-run eval comparing persona runs with and without the skill, scored on total tokens and report quality. The upstream evals cannot answer this, because they measure answers to standalone questions.

## Install / uninstall

Full plugin: no install command is given, because it is rejected. Upstream's own route (`claude plugin marketplace add JuliusBrussee/caveman`, then `claude plugin install caveman@caveman`) follows the default branch and is not pinned.

Skill only, pinned to the vetted commit (not recommended):

```
mkdir -p ~/.claude/skills/caveman && curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/d262ab3882952a59312ff3537cd86d894523c5ab/skills/caveman/SKILL.md -o ~/.claude/skills/caveman/SKILL.md
rm -rf ~/.claude/skills/caveman
```

For crew: leave it out. Do not vendor it and do not add it to `registry/extras.json`.

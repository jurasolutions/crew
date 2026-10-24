# Risk card: frontend-design

| | |
|---|---|
| **Verdict** | Recommend with conditions |
| **Risk** | Low (scanner floor: Low) |
| **Source** | anthropics/claude-plugins-official @ 58267944f9 (catalog commit, 2026-10-23), path `./plugins/frontend-design`. Plugin tree hash `47041d13c22c96f6e0f3dbf3c28d7f415c4c60db`; last commit touching the path `44490cccaf6d9f82fdeec9416fbf7c9bd72575dc` (2026-09-01, "Update /frontend-design SKILL.md"). No plugin version declared. |
| **Maintainer** | Anthropic (author in the plugin and catalog entry; README names two Anthropic engineers). The official catalog repo is an Anthropic organisation repo, about 44k stars, pushed 2026-10-23. |
| **Licence** | Apache-2.0; vendorable: yes. The plugin-level `LICENSE` (202 lines) carries the appendix; `skills/frontend-design/LICENSE.txt` (177 lines) stops before it. Same licence text; keep both files if vendored. |
| **Kind** | Plugin: 1 skill, 0 agents, 0 hooks, 0 MCP servers, 0 LSP servers |
| **Always-on cost** | About 80 tokens; about 2.7k when the skill fires |
| **Vetted** | 2026-10-24, by crew:skill-scout |

## What it does

Gives the agent a design brief to follow when building or reshaping UI: pick an aesthetic direction, plan tokens (palette, type, layout) first, review the plan against the brief, then build and self-critique. It lists default "AI-generated" looks to avoid (cream and terracotta, near-black with acid accent, broadsheet columns, identical rounded cards, template chrome such as tracked ALL-CAPS eyebrows) and has a short section on interface copy. It is text only.

## Gain for this task

Better first drafts on UI tickets where the repo has no design system, and a planning step that avoids templated output. Nothing else installed covers visual direction; `crew:web-design-review` checks accessibility and interaction after the fact, and `crew:vercel-react-best-practices` covers React performance.

## Files reviewed

Pin cloned to scratch; nothing run. Five files, all read in full:
- `.claude-plugin/plugin.json` (name, description, author; no hooks or servers)
- `skills/frontend-design/SKILL.md` (about 7 KB; no commands, no URLs, no file or network access, no instruction aimed at a reviewer)
- `README.md` (one link, to Anthropic's frontend-aesthetics cookbook on GitHub)
- `LICENSE`, `skills/frontend-design/LICENSE.txt` (Apache-2.0; the only difference is the appendix)

Hidden-Unicode, base64 and HTML-comment sweep: nothing. No binaries.

## Red flags

Scanner: 0 high, 0 medium, 3 info (the Apache licence URL twice and the cookbook link), floor Low. By reading: none for security. Two behavioural points:
1. The skill tells the agent to "take aesthetic risk" and "make deliberate, opinionated choices". Left unconstrained, that works against a repo whose design system is authoritative. The skill itself says the brief's own words win, so a repo-level instruction outranks it.
2. It says to use "any information in your memory about the client's preferences" as a hint. In a multi-business setup that is a way for one business's preferences to shape another's work, if memory is shared. Crew agents carry no `memory: user`, which closes this.

skills.sh has an audit for a `frontend-design` skill under `anthropics/claude-code`, Trust Hub pass. That is a different source from this plugin, so I did not rely on it.

## Wiring and overlap with crew

- SKILL-MAP already ranks it behind the repo's design system: "the repo's design system, then `frontend-design`".
- A repo's own design system (tokens, components, voice) is the authority for anything it governs. This skill must not choose palette, type or components there; at most it helps with layout and copy inside the system, and its "avoid default looks" advice yields to the system wherever they differ.
- The pin is weak: `registry/dependencies.json` records `"catalogSource": "./plugins/frontend-design"` with no SHA, so an install follows whatever the catalog serves. This card covers the content at tree hash `47041d13...`. The skill text changed twice in the last five months (2026-06-14, 2026-09-01), so drift is real. Recording the commit `44490ccc...` or the tree hash in `vetted` would let `crew outdated` detect a change.

## Conditions of use

1. Developer persona only, on UI tickets, and only after reading the repo's design system and operating card.
2. In a repo with its own design system, it plans layout and structure inside that system and never overrides tokens, fonts, components or copy rules.
3. No palette, brand or voice decisions for a business that has a brand guide.
4. Pin by recording `44490cccaf6d9f82fdeec9416fbf7c9bd72575dc` (or the tree hash) in `vetted`; re-vet on any change to that path.

## Install / uninstall

```
claude plugin install frontend-design@claude-plugins-official
claude plugin uninstall frontend-design@claude-plugins-official
```

The marketplace entry has no commit pin of its own; it resolves to the catalog's current state.

For crew: keep as a required plugin dependency, add the commit or tree hash to `vetted`. Vendoring is possible (Apache-2.0, one instruction-only skill) if a hard pin is wanted; that is a separate decision.

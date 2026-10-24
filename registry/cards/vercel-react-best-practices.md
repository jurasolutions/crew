# Risk card: vercel-react-best-practices

| | |
|---|---|
| **Verdict** | recommend with conditions |
| **Risk** | Medium (scanner floor: Medium) |
| **Source** | vercel-labs/agent-skills @ 063bee94c3f4df8453406c830b0a7df0f2860278, path `skills/react-best-practices` (head of the default branch on 2026-10-24) |
| **Maintainer** | Vercel Engineering, the maintainers of Next.js; credible |
| **Licence** | MIT, declared in the skill's frontmatter only (the repo has no LICENSE file); vendorable: yes, with the MIT text reproduced in THIRD_PARTY_NOTICES.md |
| **Kind** | instruction-only skill (SKILL.md, a 108 KB compiled AGENTS.md, ~70 rule files) |
| **Always-on cost** | ~130 tokens |
| **Vetted** | 2026-10-24, by crew:skill-scout |

## What it does

React and Next.js performance rules (waterfalls, bundle size, rendering, data fetching), each with incorrect and correct examples, prioritised by impact.

## Gain for this task

UI tickets in React repos get concrete, reviewable performance rules that nothing else installed provides.

## Files reviewed

All files under the vendored folder; no scripts, hooks or servers.

## Red flags

The scanner's two `telemetry` hits (`AGENTS.md:3265`, `rules/js-request-idle-callback.md:95`) are rule text advising to defer analytics work; nothing collects or sends data. They set the Medium floor, which the rubric keeps.

## Notes

No zero-width or bidirectional characters. skills.sh audit: pass.

## Conditions of use

React and Next.js repos only. Read single rule files rather than the whole `AGENTS.md`.

## Install / uninstall

Vendored in crew at the commit above: installed and removed with crew itself.

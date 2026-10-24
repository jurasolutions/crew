# Third-party notices

Crew vendors skills and reference files from the projects below, each at a pinned commit (see `vendor/UPSTREAM.json`). File bodies are unchanged. The only changes are in `SKILL.md` frontmatter: `disable-model-invocation` removed, the description scoped or shortened, and `license` added where it was missing. Each source's licence text sits beside its files in `vendor/<source>/LICENSE`, or is reproduced below when the source ships none.

| Source | Commit | Licence | Copyright | Vendored |
|---|---|---|---|---|
| [mattpocock/skills](https://github.com/mattpocock/skills) | `49dd158d1076134a641b33efb035946536778336` (1.3.1) | MIT | Copyright (c) 2026 Matt Pocock | grill-with-docs, to-spec, to-tickets, wayfinder, implement, implement-spec, triage, handoff, to-questionnaire, improve-codebase-architecture, setup-matt-pocock-skills, pr, ask-matt's PHASE-BOUNDARIES.md |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | `063bee94c3f4df8453406c830b0a7df0f2860278` | MIT (declared in the skill's frontmatter; the repository has no LICENSE file) | Vercel | react-best-practices (`vercel-react-best-practices`) |
| [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) | `434b7f91364665f2f733b310ec54809bf8f37937` | MIT | Copyright (c) 2025 Vercel Labs | command.md (the guidelines; wrapped by `crew:web-design-review`) |
| [supabase/agent-skills](https://github.com/supabase/agent-skills) | `c9be0e931b7930f7d02126d04774d904c381e7d7` (0.1.9) | MIT | Copyright (c) 2026 Supabase | supabase-postgres-best-practices |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | `aeac41d4d005999432bb7312f7ff06383a91d59d` (0.6.13) | MIT | Copyright (c) 2025 Addy Osmani | api-and-interface-design |

`mattpocock/skills` `pr` credits its template to Dex Horthy's `show-me` skill (HumanLayer); see `vendor/mattpocock/pr/CREDITS.md`.

## MIT licence text for vercel-labs/agent-skills

The skill declares `license: MIT` and the repository carries no licence file, so the standard text is reproduced here:

```
MIT License

Copyright (c) Vercel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Dependencies installed, not vendored

superpowers (obra/superpowers, MIT), mattpocock-skills (MIT), frontend-design (Anthropic, Apache-2.0), typescript-lsp and pyright-lsp (Anthropic), and @playwright/mcp (Microsoft, Apache-2.0) are installed from their own sources by `crew install`. Their licences travel with them.

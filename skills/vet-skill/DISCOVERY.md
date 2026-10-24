# Where to look

Check what's installed first (`claude plugin list --json`, `~/.claude/skills/`, the crew plugin's `vendor/`). Then search outward, curated sources first. Match candidates by **owner/repo**, never by skill name alone: popular look-alikes outrank the real thing on name searches.

| Source | How | Notes |
|---|---|---|
| Anthropic official catalog | `https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json` | ~300 plugins; third-party entries pinned to a commit SHA; "Anthropic verified" marks on claude.com/marketplace/plugins |
| Anthropic community catalog | `https://github.com/anthropics/claude-plugins-community` | SHA-pinned mirror of submitted plugins; less vetted |
| Anthropic skills | `https://github.com/anthropics/skills` | marketplace `anthropic-agent-skills` |
| skills.sh search | `GET https://skills.sh/api/search?q=<query>&limit=10` | install counts are inflated by whole-pack installs; use them for discovery, not as a quality signal |
| skills.sh audits | `GET https://skills.sh/api/v1/skills/audit/<owner>/<repo>/<skill>` | corroboration only |
| Vendor repos | the vendor's own GitHub org (e.g. vercel-labs, supabase, cloudflare, microsoft) | a vendor maintaining its own stack's skill is the strongest signal |
| Curated lists | `hesreallyhim/awesome-claude-code`, `VoltAgent/awesome-agent-skills` | leads, not endorsements |

Prefer, in order: the stack's own vendor; Anthropic; a recognised engineer or firm with a public track record; everything else.

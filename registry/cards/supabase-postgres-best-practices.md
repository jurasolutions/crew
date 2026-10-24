# Risk card: supabase-postgres-best-practices

| | |
|---|---|
| **Verdict** | recommend |
| **Risk** | Low (scanner floor: Low) |
| **Source** | supabase/agent-skills @ c9be0e931b7930f7d02126d04774d904c381e7d7 (after release v0.1.9), path `skills/supabase-postgres-best-practices` |
| **Maintainer** | Supabase; credible |
| **Licence** | MIT; vendorable: yes |
| **Kind** | instruction-only skill (SKILL.md plus reference files) |
| **Always-on cost** | ~100 tokens (description shortened in crew's frontmatter patch) |
| **Vetted** | 2026-10-24, by crew:skill-scout |

## What it does

Postgres rules for schema design, column types, migrations, indexes, RLS, locking, connection pooling and query plans, for Postgres anywhere.

## Gain for this task

Schema and migration tickets get vendor-maintained guidance; nothing else installed covers Postgres.

## Files reviewed

All files under the vendored folder; no scripts, hooks or servers.

## Red flags

None.

## Notes

The SQL examples are teaching material; never run them against a real database. Its three version numbers disagree (release 0.1.9, SKILL.md 1.1.1, changelog 1.6.0), so the commit pin is what counts. skills.sh audit: pass.

## Conditions of use

None beyond the note above.

## Install / uninstall

Vendored in crew at the commit above: installed and removed with crew itself.

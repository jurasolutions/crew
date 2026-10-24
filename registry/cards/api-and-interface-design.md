# Risk card: api-and-interface-design

| | |
|---|---|
| **Verdict** | recommend |
| **Risk** | Low (scanner floor: Low) |
| **Source** | addyosmani/agent-skills @ aeac41d4d005999432bb7312f7ff06383a91d59d (tag 0.6.13), path `skills/api-and-interface-design` |
| **Maintainer** | Addy Osmani (Google Chrome engineering lead; long public track record); credible |
| **Licence** | MIT; vendorable: yes |
| **Kind** | instruction-only skill |
| **Always-on cost** | ~100 tokens |
| **Vetted** | 2026-10-24, by crew:skill-scout |

## What it does

Guidance for stable, hard-to-misuse interfaces: REST and GraphQL contracts, errors, versioning, pagination, module boundaries.

## Gain for this task

Complements mattpocock `codebase-design` (module depth) with public-contract rules.

## Files reviewed

SKILL.md (the only file in the folder).

## Red flags

None.

## Notes

The commit is unsigned. The skill points to a sibling, `deprecation-and-migration`, that crew doesn't vendor. One Runlayer audit on skills.sh shows a Medium from February 2026 that predates this version and couldn't be reproduced by reading the file; the other audits pass.

## Conditions of use

None.

## Install / uninstall

Vendored in crew at the commit above: installed and removed with crew itself.

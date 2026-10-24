# Risk card: <name>

| | |
|---|---|
| **Verdict** | recommend / recommend with conditions / don't recommend / reject (upgrade cards: take / wait / skip) |
| **Risk** | Low / Medium / High / Reject (scanner floor: <floor>) |
| **Source** | <owner>/<repo> @ <full sha> (<tag or version>), path <path> |
| **Maintainer** | <who, and why they're credible or not> |
| **Licence** | <SPDX>; vendorable: yes / no |
| **Kind** | instruction-only skill / plugin (skills, agents, hooks, MCP, LSP) / MCP server / CLI tool |
| **Always-on cost** | ~<n> tokens |
| **Vetted** | <date>, by crew:skill-scout |

## What it does

Two or three sentences: what changes in the agent's behaviour, or what the tool can reach.

## Gain for this task

The concrete improvement over what is already installed. "None beyond X" is a valid answer and ends the card at *don't recommend*.

## Files reviewed

Every file, one per line, with anything notable (hook command, server command, network host, script purpose).

## Red flags

High and medium findings only: scanner findings (rule, file:line), then anything found by reading. Write "None" when there are none.

## Notes

Info-level findings, limitations and usability caveats (dead links, missing licence, narrow applicability). These are not red flags; keep them out of the section above.

## Conditions of use

For example: skill only, without hooks; pinned to this commit; developer persona only; kept out of human-facing text.

## Install / uninstall

Exactly what a human would run, pinned:

```
<install command>
<uninstall command>
```

For crew: vendor it (instruction-only, permissive licence) / add it to `registry/extras.json` / leave it out.

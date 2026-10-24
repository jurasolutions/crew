---
name: scout
description: Ask the crew's skill scout to find and vet skills, plugins or tools for a need, or to review upgrades to the ones crew already uses. Returns risk cards with exact install commands; never installs.
argument-hint: <need> | upgrades
context: fork
agent: crew:skill-scout
---

Brief from the user: $ARGUMENTS

- If the brief is `upgrades`, run the **upgrade watch**.
- Otherwise run **discover** for that need. If the current repo has an active crew feature folder under `.scratch/`, write cards to its `scout/`; else to `.scratch/scout/`. Inside the crew repo itself, write to `registry/cards/`.

Finish with the protocol report block and, for each card, one line: name, verdict, risk, and the command a human would run to install it.

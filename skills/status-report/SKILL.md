---
name: status-report
description: Status of a crew feature from its tickets, crew-log and git. The frontier, what's in flight, what's blocked and on what, risks, and the next decision the user owes.
argument-hint: <feature slug>
---

# Status report

Read `.scratch/<feature>/issues/`, `crew-log.md`, `reviews/`, and git (`crew/<feature>` and its ticket branches: last commit, ahead/behind the base). Write `reviews/status.md`:

```
Feature: <slug>   Route: <S|M|L|XL>   Phase: <current phase>   As of: <date>
Next decision for the user: <gate or question, or none>

Frontier (ready to start): <NN title> …
In flight: <NN title — persona — branch — last activity>
Blocked: <NN title — blocked by — what would clear it>
Done: <NN title — merged at sha>

Risks:
  - <risk> — likelihood / impact — owner — mitigation
Open questions: <from crew-log needs-human entries not yet answered>
```

A ticket is on the **frontier** when it's open, unclaimed, and every ticket blocking it is done.

**Done when** every ticket appears in exactly one list, and every blocked ticket names what would clear it.

---
name: quality-gate
description: Make the go / no-go release call for a feature against its test strategy's exit criteria, open defects, code-review verdicts and freshly run evidence.
user-invocable: false
---

# Quality gate

Write `reviews/quality-gate.md`.

## Steps

1. **Collect** the exit criteria from `reviews/test-strategy.md`, every `reviews/qa-*.md`, every `reviews/code-review-*.md`, and the defect tickets under `issues/`.
2. **Run fresh evidence** on the release branch: the full suite, typecheck and build, as the operating card gives them. Earlier reports are claims; your run is the evidence.
3. **Trace.** For each acceptance criterion, name the case that passed and where it's recorded. A criterion without one is a failed exit criterion.
4. **Defects.** Count open defects by severity. Each open one is listed with severity, owner and whether it blocks.
5. **Decide.** Go when every exit criterion holds. No-go otherwise.

## The file

```
Decision: GO | NO-GO
Branch: <branch> @ <sha>
Exit criteria:
  - <criterion> — met | not met — <evidence>
Fresh run:
  - <command> -> <result>
Open defects: <n critical, n major, n minor> (list)
To turn a NO-GO into a GO: <exact list>
Waivers the user may grant at G4: <list, or none>
```

**Done when** every exit criterion is marked met or not met with evidence, and the decision follows from them alone.

---
name: test-strategy
description: Write a feature's test strategy from its spec. Which acceptance criterion is tested at which level, the test data, what is left untested and why, and the exit criteria the quality gate will apply.
user-invocable: false
---

# Test strategy

Write `reviews/test-strategy.md` with these sections.

## Coverage map

One row per acceptance criterion:

| Criterion (spec ref) | Level | Seam / location | Data needed | Automated? |
|---|---|---|---|---|

- **Level** is one of: unit, integration (at a named seam), end to end, manual UAT.
- Push each criterion to the **highest seam that can fail for the right reason**. Use the seams the tech lead named in `reviews/technical.md`; propose a new seam only when none fits.
- Business rules with many cases (pricing, dates, permissions, state machines) get table-driven tests at one seam.

## Risk-based depth

List the riskiest behaviours first (money, data loss, security, irreversible actions, external integrations). Each gets negative cases and at least one end-to-end path.

## Non-functional

Only the ones the spec implies: performance budget, accessibility (WCAG AA for UI), security checks, browser and device matrix, migration and rollback.

## Not tested, and why

Each deliberate gap, with the reason and who accepts the risk.

## Exit criteria

The gate's rules, written so a reviewer can check them mechanically, for example:

- every criterion has at least one passing automated or recorded manual case
- zero open defects of severity *critical* or *major*; *minor* ones listed with an owner
- the full suite, typecheck and build pass on the release branch
- UAT script run by the user, or explicitly waived at G4

**Done when** every acceptance criterion has a row, and the exit criteria are checkable without judgement.

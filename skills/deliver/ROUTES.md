# Routes

Each phase names who runs it, what it produces, and its done-check. "Main" means you run it here, wearing the persona: read that persona's file under `<crew>/agents/` and follow its "In the main session" section. Everything else is a dispatch.

**Branches.** Before the first developer dispatch, create the feature branch `crew/<feature>` from the operating card's base branch and check it out; developer worktrees start from it. Ticket branches are `crew/<feature>-<NN>-<slug>`. You merge each approved ticket branch into `crew/<feature>` (on a conflict, resolve it by intent: read both sides' commits and tickets, keep what each side meant, then re-run the full suite). Then remove that developer's worktree (`git worktree remove <path>`) and delete its merged `worktree-agent-*` branch. Worktrees live under `.claude/worktrees/` inside the repo, and a stale one leaks into test runs and searches.

**Review loop.** After each developer run, dispatch `crew:reviewer` on that ticket branch. On *changes-requested*, dispatch the developer again with the review path. After two rounds that still don't converge, the finding becomes a `needs-human` question.

## S — one clear fix

1. **Ticket (main).** Write `issues/01-<slug>.md`: what to change, acceptance criteria. Show it at G0.
2. **Build.** `crew:developer` on ticket 01, then the review loop.
3. **Check.** If the change is user-visible, `crew:qa-engineer` on the ticket branch.
4. **Release.** Merge into `crew/<feature>`, then `crew:release-manager`, then **G4**.

## M — one-session feature

1. **Interview (main, business analyst).** → **G1**.
2. **Spec (main).** Invoke `crew:to-spec`, confirming seams with the user as it asks. In a repo with a PRD rule, write the PRD in the repo's format and folder, and put a pointer in `spec.md`.
3. **Spec reviews, in parallel.** `crew:functional-lead` (functional review + UAT script), `crew:tech-lead` (technical review), `crew:qa-lead` (test strategy).
4. **Slices (main).** Cut the spec into one to three tracer-bullet tickets under `issues/`, each with acceptance criteria and blocking edges. → **G2**, presenting spec, reviews and slices together.
5. **Build.** Per ticket, frontier first: `crew:developer`, then the review loop, then merge. Independent tickets run in parallel.
6. **Final review.** `crew:reviewer` on `crew/<feature>` against the base branch (`code-review-final`).
7. **QA.** `crew:qa-engineer` on `crew/<feature>`. Defect tickets go back through phase 5.
8. **Infra,** when the change touches build, deploy, config or infrastructure: `crew:infra-engineer`.
9. **Gate and release.** `crew:qa-lead` (quality gate), then `crew:release-manager`, then **G4**.

## L — multi-session

1–3. As M.
4. **G2** on the spec and its reviews.
5. **Tickets (main, project manager).** Invoke `crew:to-tickets`; its quiz runs with the user.
6. **Ticket review.** `crew:tech-lead` reviews the tickets. → **G3**.
7. **Phase boundary.** The build only needs pointers to the spec and tickets. Decide continue or clear per §5 of the skill.
8. **Build.** Invoke `crew:implement-spec`, mapping its roles onto the crew:
   - **implementer subagents** = `crew:developer`, dispatched in the background across the frontier
   - after each one finishes: the review loop on its ticket branch, then you merge it (implement-spec's **merger** step)
   - **exploration subagent** = `Explore`, saving notes under the feature folder
   - its closing **code-review** = `crew:reviewer` on `crew/<feature>` (`code-review-final`)
   - with a local tracker there is no draft PR: the feature branch takes its place
9. QA, infra, gate and release as M phases 7–9.

## XL — foggy

1. **Chart (main, project manager).** Invoke `crew:wayfinder` to chart the map. Charting is one session's work.
2. **Work the map** one decision ticket per session (research tickets may run in parallel), until the way is clear.
3. **Hand off** to `crew:to-spec`, then continue as L from phase 3.

## bug — a defect

1. Raw report from outside the crew → `crew:triage` (main) first.
2. **Repro.** `crew:qa-engineer`: a failing regression test plus a defect ticket.
3. **Fix.** `crew:developer` on the defect ticket; mattpocock `diagnosing-bugs` for hard, intermittent or performance bugs. Then the review loop.
4. **Release** as S phase 4.

## infra — build, deploy, config

1. `crew:infra-engineer` with the change.
2. `crew:reviewer` on its branch.
3. **Release** as S phase 4. Production actions are always the user's.

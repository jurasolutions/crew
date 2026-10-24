# Dispatching a persona

Dispatch with the Agent tool, `subagent_type: crew:<persona>`. The agent sees only your brief and its own definition, so the brief is everything. Keep it short and made of **context pointers**:

```
Feature: <slug>          Feature folder: .scratch/<slug>/
Base branch: <from operating card>    Feature branch: crew/<slug>
Your job: <one sentence>
Context pointers:
  - <spec / PRD path>
  - <ticket path, review paths, crew-log entries that matter>
Done when: <the persona's done-check, made specific to this job>
Specifics: <only what the pointers can't carry: a branch name, a seam, a decision taken at a gate>
Return the protocol report block.
```

Per persona, add:

| Persona | Add to the brief |
|---|---|
| `developer` | the ticket number and its ticket branch name `crew/<slug>-<NN>-<slug>`; the seams from `reviews/technical.md`; for a fix round, the review file path |
| `reviewer` | the branch and the fixed point (merge-base with the base branch, or `crew/<slug>` for a ticket); the ticket or spec path for the Spec axis; `NN` or `final` for the file name |
| `functional-lead`, `tech-lead`, `qa-lead` | spec path; for the tech lead's ticket review, the `issues/` folder |
| `qa-engineer` | the branch to test; the ticket(s) or the whole spec; how to start the app if the card doesn't say |
| `qa-lead` | "strategy" or "gate"; for the gate, the list of `reviews/qa-*.md` and `code-review-*.md` |
| `release-manager` | the feature branch, the base branch, the version convention if the card is silent |
| `infra-engineer` | what changes (pipeline, env, IaC, deploy); which environments are in play |
| `skill-scout` | "discover: <task shape>" or "upgrades"; the feature folder for cards |

Background dispatches (`run_in_background: true`) are for work you don't wait on: the scout at intake, and parallel developers on frontier tickets. Everything that feeds the next phase runs in the foreground.

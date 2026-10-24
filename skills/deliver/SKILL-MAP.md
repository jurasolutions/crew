# Skill map

Where two packs cover the same concern, one is **primary**, so no phase runs two competing processes. Persona files call these skills by name; this table is the single place the choices are explained.

| Concern | Primary | Secondary, and when |
|---|---|---|
| Requirements | `crew:grill-with-docs` (mattpocock `grilling` + `domain-modeling`) | superpowers `brainstorming` only for a blank-page idea; its output folds into the crew spec |
| Spec | `crew:to-spec`, or the repo's PRD format when it has one | — |
| Plan | `crew:to-tickets` (L), conductor slices (M) | superpowers `writing-plans` only inside an oversized ticket |
| Foggy efforts | `crew:wayfinder` | — |
| Test-first | mattpocock `tdd` | superpowers `test-driven-development` is not used: same discipline, double the context |
| Debugging | superpowers `systematic-debugging` (in-loop failures) | mattpocock `diagnosing-bugs` for hard, intermittent or performance bugs |
| Done means done | superpowers `verification-before-completion`, every persona | — |
| Review | mattpocock `code-review` + `security-review` | superpowers `requesting-code-review` (shape of the reviewer brief), `receiving-code-review` (developer answering findings) |
| Build orchestration | M: conductor dispatching per ticket; L: `crew:implement-spec` with crew personas | superpowers `subagent-driven-development` / `dispatching-parallel-agents` patterns for independent side tasks |
| Isolation | the developer agent's `isolation: worktree` | superpowers `using-git-worktrees` for a worktree made by hand |
| Finish | superpowers `finishing-a-development-branch` | `crew:pr` writes the PR body |
| UI | the repo's design system, then `frontend-design` | `crew:vercel-react-best-practices` (React), `crew:web-design-review` (review) |
| Postgres | `crew:supabase-postgres-best-practices` | — |
| Interfaces | mattpocock `codebase-design` (module depth) | `crew:api-and-interface-design` (public API contracts) |
| Human-only steps | mattpocock `wizard` | — |
| Phase boundaries | `<crew>/vendor/mattpocock/reference/PHASE-BOUNDARIES.md` | `crew:handoff` when work moves harness, directory or person |

Superpowers skills appear as `superpowers:<name>` when installed as a plugin, or as `<name>` when installed as loose skills. Use whichever the Skill tool lists.

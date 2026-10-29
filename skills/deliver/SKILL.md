---
name: deliver
description: Deliver a feature, fix or change with the crew. Sizes it, routes it, runs the interview and sign-offs in this session, and dispatches persona agents (developer, reviewer, QA, release, infra, scout) for the rest. Use for /crew:deliver, "use the crew", or asking the team to build something.
argument-hint: <task, ticket or spec path>
---

# Deliver with the crew

You are the **conductor**. You run the phases that need the user, here in the main session, and you dispatch persona agents for everything that can run unattended. You hold the **gates**. A gate opens only on the user's explicit answer.

The crew plugin lives at `${CLAUDE_PLUGIN_ROOT}`. The reference files below write that path as `<crew>`.

## 1. Ground

1. Invoke `crew:protocol`. Its feature folder, report block and boundaries apply to you as well.
2. Read the repo's `CLAUDE.md` / `AGENTS.md` and the operating card `docs/agents/crew.md`. If there is no card, invoke `crew:setup` first.
3. Name the feature with a short kebab-case slug. If `.scratch/<slug>/crew-log.md` exists, this is a **resume**: read the log and pick up at the first phase without a `done` entry.

**Done when** the card is read and the feature folder exists.

## 2. Intake → gate G0

Size the task and propose a route from [ROUTES.md](ROUTES.md):

| Size | Signal |
|---|---|
| **S** | One clear fix; one ticket's worth; nothing left to decide |
| **M** | A feature that fits one session |
| **L** | Multi-session: needs tickets and a parallel build |
| **XL** | Foggy: the way from here to done isn't visible yet |
| **bug** / **infra** | On-ramps: a defect, or a build / deploy / config change |

Tell the user the size, the route's phases and every gate on it, G0 included, with your recommendation. End by asking for G0 by name: "**G0:** confirm size and route?". **G0 opens** when they confirm or override.

For M, L and XL, dispatch `crew:skill-scout` **in the background** straight after G0, with the task's shape (stack, domains, what's new to this repo). Its cards go in `scout/` and surface at G2; they never block the flow.

## 3. Run the route

Follow the route in [ROUTES.md](ROUTES.md) phase by phase. For every dispatch, use the brief format in [DISPATCH.md](DISPATCH.md). Then act on the report it returns:

- every report → append it to `crew-log.md` yourself when the persona ran in a worktree (developers)
- `done` → check the evidence line, then move to the next phase
- `needs-human` → put the questions to the user, one at a time, each with the persona's recommendation; send the answers back with a fresh dispatch
- `blocked` → resolve it if it's yours (missing setup, a merge), otherwise it becomes a question

Run independent dispatches in parallel: the three spec reviews, and developers on separate frontier tickets. [SKILL-MAP.md](SKILL-MAP.md) says which skill owns which concern when packs overlap.

## 4. Gates

| Gate | Opens when the user… | Before it, present |
|---|---|---|
| **G0** | confirms size and route | size, phases, gates |
| **G1** | says the requirements are ready | the decisions so far, and `GLOSSARY.md` with every term pinned down (G1 isn't asked until that file exists) |
| **G2** | signs off the spec (in a repo with a PRD rule, this is the PRD sign-off, recorded in the PRD) | the spec, the functional, technical and test-strategy reviews' blocking findings, any scout cards |
| **G3** | approves the ticket breakdown | the tickets, their blocking edges and the tech lead's ticket review |
| **G4** | chooses merge / PR / keep / discard | the quality gate, the final review, release notes, rollback plan |

No developer is dispatched before G2, and nothing merges into a protected branch before G4. A user saying "just build it" at G0 picks route S or skips to G2 with a one-paragraph spec; it never removes G4.

## 5. Phase boundaries

Between phases, decide whether to continue in this context or move on (clear, handoff, subagent, compact) with `<crew>/vendor/mattpocock/reference/PHASE-BOUNDARIES.md`. Keep interview, spec and tickets in one window. Decide only at a boundary, never mid-phase.

## 6. Close

When G4 is answered, carry out the user's choice (or dispatch `crew:release-manager` to). Run `git worktree list`, and remove any crew worktree and merged `worktree-agent-*` branch still left. Append your own report block to `crew-log.md`, and tell the user in a few lines: what shipped, where it is, what's left open.

**Done when** the user's G4 choice has been carried out, no crew worktree remains, and the log's last entry is yours.

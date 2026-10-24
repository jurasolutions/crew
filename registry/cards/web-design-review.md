# Risk card: web-design-review (Vercel Web Interface Guidelines)

| | |
|---|---|
| **Verdict** | recommend with conditions |
| **Risk** | Low (scanner floor: Low) |
| **Source** | vercel-labs/web-interface-guidelines @ 434b7f91364665f2f733b310ec54809bf8f37937, file `command.md`; wrapped by crew's `skills/web-design-review` |
| **Maintainer** | Vercel Labs; credible |
| **Licence** | MIT; vendorable: yes |
| **Kind** | rules file read by a crew wrapper skill |
| **Always-on cost** | ~90 tokens (the wrapper's description) |
| **Vetted** | 2026-10-24, by crew:skill-scout |

## What it does

Accessibility, focus, forms, motion, typography, performance, dark mode and i18n rules for UI code, reported as `file:line` findings.

## Gain for this task

A concrete UI checklist for the reviewer and QA personas. Vendoring the rules file removes the upstream skill's fetch-from-`main` on every run.

## Files reviewed

`command.md` and the crew wrapper.

## Red flags

None.

## Notes

Some rules are stylistic (Title Case, "`&` over 'and'") and can contradict a repo's own voice; the wrapper's design-system-first step reports those as notes rather than findings. skills.sh has no audit for this repo.

## Conditions of use

Reviewer and QA personas; keep the design-system-first step in the wrapper.

## Install / uninstall

Vendored in crew at the commit above: installed and removed with crew itself.

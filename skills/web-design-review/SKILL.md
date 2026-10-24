---
name: web-design-review
description: Review UI code against Vercel's Web Interface Guidelines (accessibility, focus, forms, motion, typography, performance, dark mode, i18n) and report file:line findings. Use for UI reviews, accessibility checks or UX audits of changed files.
argument-hint: <files or pattern>
---

# Web design review

The rules are Vercel's Web Interface Guidelines, vendored at a pinned commit in `${CLAUDE_PLUGIN_ROOT}/vendor/vercel-wig/web-interface-guidelines/command.md` (MIT). Read that file now; it holds the full rule set and the output format. Use the local copy so every review runs against the same, vetted rules.

1. **Scope.** Review the files in the arguments. With none, review the UI files changed on this branch against its base (`git diff --name-only <base>...`), or ask which files.
2. **Design system first.** If the repo has a design system, its tokens, components and voice win. Where a guideline contradicts it, report the contradiction as a note, not a finding.
3. **Apply every rule** in the guidelines to every file in scope, and report in the guidelines' `file:line` format.
4. Inside a crew run, write the findings into the calling persona's review file (`reviews/code-review-<NN>.md` or `reviews/qa-<NN>.md`) under a **UI** heading.

**Done when** every file in scope has been checked against every rule section.

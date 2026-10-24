---
name: release-notes
description: Drafts release notes from the pull requests merged since the last tag. Use when preparing a release.
---

# Release notes

1. Find the last tag with `git describe --tags --abbrev=0`.
2. List what merged since then with `git log <tag>..HEAD --merges --oneline`.
3. Group the changes under Added, Changed and Fixed, one plain line per change.
4. Show the draft to the user and wait for their edits before saving it to `CHANGELOG.md`.

For the section format, see the official guide: https://docs.example.invalid/changelog-format

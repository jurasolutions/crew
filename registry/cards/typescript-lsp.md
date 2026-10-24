# Risk card: typescript-lsp

| | |
|---|---|
| **Verdict** | recommend with conditions |
| **Risk** | Medium (scanner floor: Low; raised because the language server runs outside the sandbox) |
| **Source** | anthropics/claude-plugins-official, `./plugins/typescript-lsp` v1.0.0 (catalog snapshot 58267944f92187b7d6a1c822165c96c81c864806) |
| **Maintainer** | Anthropic |
| **Licence** | Apache-2.0 |
| **Kind** | plugin: one LSP server entry, no skills, hooks or MCP |
| **Always-on cost** | none (LSP, no descriptions) |
| **Vetted** | 2026-10-24, by crew:skill-scout |

## What it does

Starts `typescript-language-server --stdio` so Claude Code gets type errors and go-to-definition after each edit.

## Gain for this task

Developers and reviewers see real type errors instead of guessing.

## Files reviewed

README, LICENSE and the marketplace entry (the plugin folder holds nothing else).

## Red flags

None.

## Notes

The server is a bare command resolved from PATH, so it runs whatever `typescript-language-server` is installed. Install it from npm.

## Conditions of use

Use in repos you already trust to run code from.

## Install / uninstall

```
npm install -g typescript-language-server typescript
claude plugin install typescript-lsp@claude-plugins-official
claude plugin uninstall typescript-lsp@claude-plugins-official
```

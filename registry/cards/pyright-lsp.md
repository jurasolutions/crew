# Risk card: pyright-lsp

| | |
|---|---|
| **Verdict** | recommend with conditions |
| **Risk** | Medium (scanner floor: Low; raised because the language server runs outside the sandbox) |
| **Source** | anthropics/claude-plugins-official, `./plugins/pyright-lsp` v1.0.0 (catalog snapshot 58267944f92187b7d6a1c822165c96c81c864806) |
| **Maintainer** | Anthropic (plugin); Microsoft (Pyright) |
| **Licence** | Apache-2.0 (plugin); MIT (Pyright) |
| **Kind** | plugin: one LSP server entry |
| **Always-on cost** | none |
| **Vetted** | 2026-10-24, by crew:skill-scout |

## What it does

Starts `pyright-langserver --stdio` for Python type checking and go-to-definition.

## Gain for this task

Type errors in Python repos surface after each edit.

## Files reviewed

README, LICENSE and the marketplace entry.

## Red flags

None.

## Notes

Install Pyright from npm; it has no install scripts. The PyPI wrapper is believed to download Pyright from npm on first run (not verified), so crew's hint uses npm only.

## Conditions of use

Use in repos you already trust to run code from.

## Install / uninstall

```
npm install -g pyright
claude plugin install pyright-lsp@claude-plugins-official
claude plugin uninstall pyright-lsp@claude-plugins-official
```

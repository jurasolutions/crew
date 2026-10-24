# Risk card: playwright (@playwright/mcp 0.0.83)

| | |
|---|---|
| **Verdict** | recommend with conditions |
| **Risk** | High (scanner floor: High) |
| **Source** | npm `@playwright/mcp@0.0.83`, tarball shasum 30bf9c6c0d80835517fd2e9b022559ea05cb1428 (matches the registry) |
| **Maintainer** | Microsoft (Playwright team) |
| **Licence** | Apache-2.0 |
| **Kind** | MCP server (stdio), registered at user scope |
| **Always-on cost** | MCP tool definitions, deferred until searched |
| **Vetted** | 2026-10-24, by crew:skill-scout |

## What it does

Drives a real browser for the QA engineer: navigate, click, fill forms, take screenshots, read the page.

## Gain for this task

QA can exercise the running app end to end and keep screenshots as evidence.

## Files reviewed

All seven files in the tarball. No install scripts. It depends on exactly pinned alpha builds of `playwright` and `playwright-core` (1.64.0-alpha-1790635538000), whose code was not read.

## Red flags

The scanner's High comes from the README's `settings.json` mention; in substance it's documentation, but the rubric keeps the floor. A browser-driving server can reach anything the browser can.

## Notes

Crew registers it directly, pinned. The official `playwright` plugin runs `@playwright/mcp@latest`, i.e. whatever was published last, on every start.

## Conditions of use

Run headless and isolated (`--headless --isolated`), pointed only at the app under test. Never use `--extension`, `--cdp-endpoint`, `--allow-unrestricted-file-access` or `--no-sandbox`.

## Install / uninstall

```
claude mcp add --scope user playwright -- npx -y @playwright/mcp@0.0.83 --headless --isolated
claude mcp remove --scope user playwright
```

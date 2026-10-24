#!/usr/bin/env node
// A fake `claude` for the installer tests. It implements just the subcommands crew uses, with
// the real CLI's output shapes and exit codes (checked against Claude Code 2.1.286).
//
//   FAKE_CLAUDE_STATE  JSON file: { version, plugins[], marketplaces[], mcpServers{}, catalog{}, failures[] }
//                      It is read on every call and rewritten on every mutation.
//   FAKE_CLAUDE_LOG    every call's argv is appended here as one JSON line (default: <state>.log)
//
// catalog: { "<marketplace>": { "<plugin>": "<version>" } }. A plugin missing from the catalog
// falls back to the marketplace's own plugin.json (directory source) or its `vX.Y.Z` ref.
// failures: [{ "match": "plugin install superpowers", "message": "...", "code": 1 }] makes any
// call whose argv (joined by spaces) starts with `match` fail.

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, resolve, win32 } from 'node:path';

const argv = process.argv.slice(2);
// Run bare (e.g. picked up by a directory-wide `node --test`): not a test, nothing to do.
if (argv.length === 0) process.exit(0);
const statePath = process.env.FAKE_CLAUDE_STATE;
const logPath = process.env.FAKE_CLAUDE_LOG || (statePath ? `${statePath}.log` : null);
if (logPath) appendFileSync(logPath, `${JSON.stringify(argv)}\n`);

const state = statePath && existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
state.plugins ??= [];
state.marketplaces ??= [];
state.mcpServers ??= {};
state.catalog ??= {};
const save = () => statePath && writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
const say = (s) => process.stdout.write(`${s}\n`);
const die = (s, code = 1) => {
  process.stderr.write(`${s}\n`);
  process.exit(code);
};

for (const f of state.failures ?? []) {
  if (argv.join(' ').startsWith(f.match)) die(f.message ?? 'injected failure', f.code ?? 1);
}

// Positional args, skipping flags and the values of flags that take one.
const VALUED = new Set(['--scope', '-s', '-e', '--env', '-t', '--transport', '-H', '--header']);
function positionals(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    if (VALUED.has(list[i])) { i++; continue; }
    if (list[i].startsWith('-')) continue;
    out.push(list[i]);
  }
  return out;
}
const flagValue = (list, ...names) => {
  const i = list.findIndex((a) => names.includes(a));
  return i === -1 ? undefined : list[i + 1];
};

function parseSource(raw) {
  if (isAbsolute(raw) || win32.isAbsolute(raw)) {
    const path = resolve(raw);
    let name = basename(path);
    const mf = join(path, '.claude-plugin', 'marketplace.json');
    if (existsSync(mf)) name = JSON.parse(readFileSync(mf, 'utf8')).name ?? name;
    return { name, entry: { source: 'directory', path } };
  }
  const m = /^([\w.-]+)\/([\w.-]+)(?:#(.+))?$/.exec(raw);
  if (!m) die(`✘ Failed to add marketplace: unsupported source ${raw}`);
  const repo = `${m[1]}/${m[2]}`;
  return { name: m[2], entry: { source: 'github', repo, ...(m[3] ? { ref: m[3] } : {}) } };
}

function availableVersion(marketplace, plugin) {
  const fromCatalog = state.catalog[marketplace]?.[plugin];
  if (fromCatalog) return fromCatalog;
  const mk = state.marketplaces.find((m) => m.name === marketplace);
  if (!mk) return undefined;
  if (mk.source === 'directory') {
    const pj = join(mk.path, '.claude-plugin', 'plugin.json');
    if (existsSync(pj)) {
      const j = JSON.parse(readFileSync(pj, 'utf8'));
      if (j.name === plugin) return j.version;
    }
    return undefined;
  }
  const v = /^v(\d+\.\d+\.\d+.*)$/.exec(mk.ref ?? '');
  return v && plugin === mk.name ? v[1] : undefined;
}

const [a0, a1, a2] = argv;

if (a0 === '--version' || a0 === '-v') {
  say(`${state.version ?? '2.1.286'} (Claude Code)`);
  process.exit(0);
}

if (a0 === 'plugin' && a1 === 'list') {
  say(JSON.stringify(state.plugins, null, 2));
  process.exit(0);
}

if (a0 === 'plugin' && a1 === 'marketplace') {
  const rest = argv.slice(3);
  const pos = positionals(rest);
  if (a2 === 'list') {
    say(JSON.stringify(state.marketplaces.map(({ name, ...e }) => ({ name, ...e, installLocation: e.path ?? `/fake/marketplaces/${name}` })), null, 2));
    process.exit(0);
  }
  if (a2 === 'add') {
    const raw = pos[0];
    if (!raw) die('error: missing required argument source');
    if ((state.unreachable ?? []).includes(raw)) die(`✘ Failed to add marketplace: Failed to clone marketplace repository ${raw}`);
    const { name, entry } = parseSource(raw);
    const existing = state.marketplaces.find((m) => m.name === name);
    if (existing) {
      const { name: _n, ...e } = existing;
      if (JSON.stringify(e) === JSON.stringify(entry)) {
        say(`Adding marketplace…✔ Marketplace '${name}' already on disk — declared in user settings`);
        process.exit(0);
      }
      die(`✘ Failed to add marketplace: Marketplace '${name}' is already declared and its network source differs from the one declared for it in settings`);
    }
    state.marketplaces.push({ name, ...entry });
    save();
    say(`Adding marketplace…✔ Successfully added marketplace: ${name} (declared in user settings)`);
    process.exit(0);
  }
  if (a2 === 'remove' || a2 === 'rm') {
    const name = pos[0];
    if (!state.marketplaces.some((m) => m.name === name)) die(`✘ Failed to remove marketplace: Marketplace '${name}' not found`);
    const gone = state.plugins.filter((p) => p.id.endsWith(`@${name}`));
    state.marketplaces = state.marketplaces.filter((m) => m.name !== name);
    state.plugins = state.plugins.filter((p) => !p.id.endsWith(`@${name}`));
    save();
    say(`✔ Successfully removed marketplace: ${name}`);
    if (gone.length) say(`Also uninstalled ${gone.length} plugin from this marketplace:\n${gone.map((p) => `  ${p.id}`).join('\n')}`);
    process.exit(0);
  }
  if (a2 === 'update') {
    const name = pos[0];
    if (name && !state.marketplaces.some((m) => m.name === name)) die(`✘ Failed to update marketplace: Marketplace '${name}' not found`);
    say(`Updating marketplace: ${name ?? 'all'}...✔ Successfully updated marketplace: ${name ?? 'all'}`);
    process.exit(0);
  }
}

if (a0 === 'plugin' && ['install', 'i', 'uninstall', 'remove', 'update'].includes(a1)) {
  const rest = argv.slice(2);
  const id = positionals(rest)[0];
  const scope = flagValue(rest, '--scope', '-s');
  const [name, marketplace] = String(id).split('@');
  const installed = state.plugins.find((p) => p.id === id && (!scope || p.scope === scope));

  if (a1 === 'install' || a1 === 'i') {
    if (!marketplace || !state.marketplaces.some((m) => m.name === marketplace)) die(`✘ Failed to install plugin "${id}": Marketplace "${marketplace}" not found`);
    if (installed) {
      say(`Installing plugin "${id}"...✔ Plugin "${id}" is already installed (scope: ${installed.scope})`);
      process.exit(0);
    }
    const version = availableVersion(marketplace, name);
    if (!version) die(`✘ Failed to install plugin "${id}": Plugin "${name}" not found in marketplace "${marketplace}"`);
    state.plugins.push({ id, version, scope: scope ?? 'user', enabled: true, installPath: `/fake/cache/${marketplace}/${name}/${version}` });
    save();
    say(`Installing plugin "${id}"...✔ Successfully installed plugin: ${id} (scope: ${scope ?? 'user'})`);
    process.exit(0);
  }
  if (a1 === 'uninstall' || a1 === 'remove') {
    if (!installed) die(`✘ Failed to uninstall plugin "${id}": Plugin "${id}" not found in installed plugins`);
    state.plugins = state.plugins.filter((p) => p !== installed);
    save();
    say(`✔ Successfully uninstalled plugin: ${name} (scope: ${installed.scope})`);
    process.exit(0);
  }
  if (a1 === 'update') {
    if (!installed) die(`✘ Failed to update plugin "${id}": Plugin "${name}" not found`);
    const latest = availableVersion(marketplace, name);
    say(`Checking for updates for plugin "${id}"…`);
    if (!latest || latest === installed.version) {
      say(`✔ ${name} is already at the latest version (${installed.version}).`);
      process.exit(0);
    }
    const old = installed.version;
    installed.version = latest;
    save();
    say(`✔ Plugin "${name}" updated from ${old} to ${latest}. Restart to apply changes.`);
    process.exit(0);
  }
}

if (a0 === 'mcp') {
  const rest = argv.slice(2);
  if (a1 === 'list') {
    const names = Object.keys(state.mcpServers);
    if (!names.length) say('No MCP servers configured. Use `claude mcp add` to add a server.');
    else {
      say('Checking MCP server health…\n');
      for (const n of names) say(`${n}: ${[state.mcpServers[n].command, ...(state.mcpServers[n].args ?? [])].join(' ')} - ✔ Connected`);
    }
    process.exit(0);
  }
  if (a1 === 'get') {
    const name = positionals(rest)[0];
    const s = state.mcpServers[name];
    if (!s) {
      say(`No MCP server named "${name}". Run \`claude mcp add\` to add one.`);
      process.exit(1);
    }
    const scopeText = { user: 'User config (available in all your projects)', local: 'Local config (private to you in this project)', project: 'Project config (shared via .mcp.json)' }[s.scope ?? 'local'];
    say(`${name}:\n  Scope: ${scopeText}\n  Status: ✔ Connected\n  Type: stdio\n  Command: ${s.command}\n  Args: ${(s.args ?? []).join(' ')}\n  Environment:\n\nTo remove this server, run: claude mcp remove ${name} -s ${s.scope ?? 'local'}`);
    process.exit(0);
  }
  if (a1 === 'add') {
    const dd = rest.indexOf('--');
    const head = dd === -1 ? rest : rest.slice(0, dd);
    const tail = dd === -1 ? positionals(rest).slice(1) : rest.slice(dd + 1);
    const name = positionals(head)[0];
    const scope = flagValue(head, '--scope', '-s') ?? 'local';
    const [command, ...args] = tail;
    if (!name || !command) die('error: missing required argument');
    if (state.mcpServers[name] && state.mcpServers[name].scope === scope) die(`MCP server ${name} already exists in ${scope} config`);
    state.mcpServers[name] = { scope, command, args };
    save();
    say(`Added stdio MCP server ${name} with command: ${[command, ...args].join(' ')} to ${scope} config`);
    process.exit(0);
  }
  if (a1 === 'remove') {
    const name = positionals(rest)[0];
    const scope = flagValue(rest, '--scope', '-s');
    const s = state.mcpServers[name];
    if (!s || (scope && s.scope !== scope)) die(`No ${scope ? `${scope}-scoped ` : ''}MCP server found with name: ${name}`);
    delete state.mcpServers[name];
    save();
    say(`Removed MCP server ${name} from ${s.scope} config`);
    process.exit(0);
  }
}

die(`fake claude: unsupported command: ${argv.join(' ')}`, 2);

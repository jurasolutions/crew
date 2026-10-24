// Preflight checks and the read-only inventory: what Claude Code already has, however it got there.
// Three places count: plugins (CLI-installed or claude.ai-synced, via `claude plugin list --json`),
// loose skills in <config>/skills/<name>/SKILL.md (only ever read), and MCP servers.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MIN_CLAUDE } from './context.mjs';
import { reason, which } from './exec.mjs';
import { compareVersions } from './source.mjs';

export function preflight(ctx) {
  const problems = [];
  const node = process.versions.node;
  if ((Number(node.split('.')[0]) || 0) < 20) problems.push(`Node ${node} is too old; crew needs Node 20 or newer.`);

  let claude = null;
  const c = ctx.claude(['--version'], { timeout: 60_000 });
  if (c.code !== 0) {
    problems.push(c.notFound
      ? 'claude is not on PATH. Install Claude Code first (https://code.claude.com/docs/en/setup).'
      : `claude --version failed: ${reason(c)}`);
  } else {
    claude = /(\d+\.\d+\.\d+)/.exec(c.stdout)?.[1] ?? null;
    if (!claude) problems.push(`could not read a version from \`claude --version\`: ${c.stdout.trim()}`);
    else if (compareVersions(claude, MIN_CLAUDE) < 0) problems.push(`Claude Code ${claude} is too old; crew needs ${MIN_CLAUDE} or newer. Run: claude update`);
  }

  let git = null;
  const g = ctx.git(['--version'], { timeout: 60_000 });
  if (g.code !== 0) problems.push(g.notFound ? 'git is not on PATH. Install git first.' : `git --version failed: ${reason(g)}`);
  else git = /(\d+\.\d+(?:\.\d+)?)/.exec(g.stdout)?.[1] ?? g.stdout.trim();

  return { ok: problems.length === 0, problems, node, claude, git };
}

function parseJsonOutput(text, what) {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    const i = t.search(/[[{]/);
    if (i > 0) {
      try { return JSON.parse(t.slice(i)); } catch { /* fall through */ }
    }
    throw new Error(`${what} did not print JSON: ${t.slice(0, 200)}`);
  }
}

export function listPlugins(ctx) {
  const r = ctx.claude(['plugin', 'list', '--json'], { timeout: 120_000 });
  if (r.code !== 0) throw new Error(`claude plugin list --json failed: ${reason(r)}`);
  const v = parseJsonOutput(r.stdout, 'claude plugin list --json');
  return Array.isArray(v) ? v : (v.installed ?? []);
}

export function listMarketplaces(ctx) {
  const r = ctx.claude(['plugin', 'marketplace', 'list', '--json'], { timeout: 120_000 });
  if (r.code !== 0) throw new Error(`claude plugin marketplace list --json failed: ${reason(r)}`);
  const v = parseJsonOutput(r.stdout, 'claude plugin marketplace list --json');
  return Array.isArray(v) ? v : [];
}

// `claude mcp get <name>` exits 0 when a server of that name is configured (any scope) and 1 with
// `No MCP server named "<name>"` when not. It health-checks the server, so it can be slow.
export function mcpGet(ctx, name) {
  const r = ctx.claude(['mcp', 'get', name], { timeout: 120_000 });
  if (r.code === 0) {
    const scope = /Scope:\s*([^\n(]+)/.exec(r.stdout)?.[1]?.trim();
    return { present: true, scope };
  }
  if (r.timedOut) return { present: true, scope: 'unknown; health check timed out' };
  if (/No MCP server named/i.test(`${r.stdout}\n${r.stderr}`)) return { present: false };
  return { present: false, error: reason(r) };
}

export function mcpNamesOf(item) {
  return item.detect?.mcpNames ?? [item.name];
}

export function inventory(ctx, { mcpNames = [] } = {}) {
  const plugins = listPlugins(ctx);
  const marketplaces = listMarketplaces(ctx);
  const mcp = new Map();
  for (const name of new Set(mcpNames)) mcp.set(name, mcpGet(ctx, name));
  return { plugins, marketplaces, mcp };
}

export const looseSkillDir = (configDir, name) => join(configDir, 'skills', name);

export function looseSkillsPresent(configDir, skills = []) {
  return skills.length > 0 && skills.every((s) => existsSync(join(looseSkillDir(configDir, s), 'SKILL.md')));
}

const pluginNamesOf = (item) => [...new Set([item.plugin, ...(item.detect?.pluginNames ?? [])].filter(Boolean))];

// How (and whether) a registry item is present.
export function detect(ctx, inv, item) {
  if (item.kind === 'mcp') {
    const hit = mcpNamesOf(item).map((n) => inv.mcp.get(n)).find((v) => v?.present);
    return { present: !!hit, how: hit ? 'mcp' : null, scope: hit?.scope, plugins: [], loose: false, duplicate: false };
  }
  const names = pluginNamesOf(item);
  const plugins = inv.plugins.filter((p) => names.some((n) => String(p.id ?? '').startsWith(`${n}@`)));
  const loose = looseSkillsPresent(ctx.configDir, item.detect?.looseSkills ?? []);
  const plugin = plugins.find((p) => p.scope !== 'synced') ?? plugins[0];
  const how = plugin ? (plugin.scope === 'synced' ? 'synced' : 'plugin') : loose ? 'loose' : null;
  const duplicate = (plugins.length > 0 && loose) || plugins.length > 1;
  return { present: !!how, how, plugin, plugins, loose, duplicate };
}

export function duplicateText(ctx, det) {
  const parts = det.plugins.map((p) => p.id);
  if (det.loose) parts.push(`loose skills in ${join(ctx.configDir, 'skills')}`);
  return `duplicate: ${parts.join(' and ')}`;
}

// "present: synced (1.2.3; vetted 1.3.1)" and friends.
export function presentLabel(det, item, { withVetted = true } = {}) {
  if (det.how === 'loose') return 'present: loose';
  if (det.how === 'mcp') return `present: mcp${det.scope ? ` (${det.scope})` : ''}`;
  const v = det.plugin?.version;
  const vetted = item.vetted?.version;
  const ver = v && withVetted && vetted && vetted !== v ? `${v}; vetted ${vetted}` : v;
  return `present: ${det.how}${ver ? ` (${ver})` : ''}${det.plugin?.enabled === false ? ' (disabled)' : ''}`;
}

// "needs <binary> on PATH" note for items with requiresBinary; '' when fine. Never installs anything.
export function binaryNote(ctx, item) {
  const rb = item.requiresBinary;
  if (!rb?.command || which(rb.command, ctx.env)) return '';
  return `${rb.command} not on PATH (crew never installs binaries); install it with: ${rb.hint ?? rb.command}`;
}

// `crew uninstall [--with-deps]`: remove the crew plugin and its marketplace. With --with-deps,
// also remove the plugins and MCP servers recorded in <config>/crew/state.json, and nothing else.
// The official marketplace and loose skills are never touched.

import { CREW_MARKETPLACE, CREW_PLUGIN } from './context.mjs';
import { reason } from './exec.mjs';
import { inventory, preflight } from './inventory.mjs';
import { createTally, plural } from './report.mjs';
import { loadState, saveState } from './state.mjs';

const scopeOf = (p) => (p?.scope && p.scope !== 'synced' ? p.scope : 'user');

export function uninstall(ctx) {
  const { out } = ctx;
  const withDeps = !!ctx.flags.withDeps;
  const pf = preflight(ctx);
  if (!pf.ok) {
    for (const p of pf.problems) out.line(`preflight failed: ${p}`);
    return 1;
  }
  const state = loadState(ctx.configDir);
  let inv;
  try {
    inv = inventory(ctx, { mcpNames: withDeps ? Object.keys(state.mcpServers) : [] });
  } catch (e) {
    out.line(`inventory failed: ${e.message}`);
    return 1;
  }
  const tally = createTally(out, { dryRun: ctx.dryRun });

  const crew = inv.plugins.find((p) => p.id === CREW_PLUGIN);
  if (crew) {
    const r = ctx.claude(['plugin', 'uninstall', CREW_PLUGIN, '--scope', scopeOf(crew)], { mutating: true });
    if (r.code === 0) {
      delete state.plugins[CREW_PLUGIN];
      tally.change('crew', `removed (${CREW_PLUGIN})`);
    } else tally.fail('crew', reason(r));
  } else {
    delete state.plugins[CREW_PLUGIN];
    tally.skip('crew', 'plugin not installed');
  }

  if (inv.marketplaces.some((m) => m.name === CREW_MARKETPLACE)) {
    const r = ctx.claude(['plugin', 'marketplace', 'remove', CREW_MARKETPLACE], { mutating: true });
    if (r.code === 0) {
      delete state.marketplaces[CREW_MARKETPLACE];
      state.crew = null;
      tally.change('crew marketplace', 'removed');
    } else tally.fail('crew marketplace', reason(r));
  } else {
    delete state.marketplaces[CREW_MARKETPLACE];
    state.crew = null;
    tally.skip('crew marketplace', 'not configured');
  }

  const leftPlugins = () => Object.keys(state.plugins).filter((id) => id !== CREW_PLUGIN);
  if (withDeps) {
    for (const id of leftPlugins()) {
      const label = state.plugins[id]?.item ?? id;
      const p = inv.plugins.find((x) => x.id === id);
      if (!p) {
        delete state.plugins[id];
        tally.skip(label, `${id} is no longer installed`);
        continue;
      }
      const r = ctx.claude(['plugin', 'uninstall', id, '--scope', scopeOf(p)], { mutating: true });
      if (r.code === 0) {
        delete state.plugins[id];
        tally.change(label, `removed (${id})`);
      } else tally.fail(label, reason(r));
    }
    for (const name of Object.keys(state.mcpServers)) {
      const label = state.mcpServers[name]?.item ?? name;
      if (!inv.mcp.get(name)?.present) {
        delete state.mcpServers[name];
        tally.skip(label, `MCP server ${name} is no longer configured`);
        continue;
      }
      const r = ctx.claude(['mcp', 'remove', name, '--scope', state.mcpServers[name]?.scope ?? 'user'], { mutating: true });
      if (r.code === 0) {
        delete state.mcpServers[name];
        tally.change(label, `removed (mcp ${name})`);
      } else tally.fail(label, reason(r));
    }
  }

  if (!ctx.dryRun) saveState(ctx.configDir, state);

  const c = tally.counts;
  const kept = leftPlugins().length + Object.keys(state.mcpServers).length;
  const keptNote = !withDeps && kept
    ? ` Left ${plural(kept, 'dependency')} crew installed in place; crew uninstall --with-deps removes ${kept === 1 ? 'it' : 'them'}.`
    : '';
  if (ctx.dryRun) {
    out.line(`Dry run: ${plural(ctx.runner.planned.length, 'command')} would run; nothing was changed.`);
    return c.failed ? 1 : 0;
  }
  if (c.failed) {
    out.line(`Finished with ${plural(c.failed, 'failure')}.${keptNote}`);
    return 1;
  }
  out.line(`Done: ${plural(c.changed, 'item')} removed.${keptNote}${c.changed ? ' Restart Claude Code to finish.' : ''}`);
  return 0;
}

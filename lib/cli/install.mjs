// `crew install` and `crew update`. Detect what is already there, however it got there, and fill
// only the gaps. Never deletes or overwrites anything crew did not install.

import { CREW_MARKETPLACE, CREW_PLUGIN, OFFICIAL, select } from './context.mjs';
import { reason } from './exec.mjs';
import {
  binaryNote, detect, duplicateText, inventory, listPlugins, mcpNamesOf, preflight, presentLabel,
} from './inventory.mjs';
import { createTally, plural } from './report.mjs';
import { describeEntry, impliedVersion, sourceMatches } from './source.mjs';
import { loadState, saveState } from './state.mjs';

const withNote = (label, note) => (note ? `${label}; ${note}` : label);

// What `claude plugin marketplace list --json` will show for a source we just added.
function entryFor(src) {
  if (src.kind === 'directory') return { source: 'directory', path: src.path };
  if (src.kind === 'github') return { source: 'github', repo: src.repo, ...(src.ref ? { ref: src.ref } : {}) };
  return { source: 'git', url: src.url, ...(src.ref ? { ref: src.ref } : {}) };
}

function accessHint(src) {
  if (src.kind !== 'github') return '';
  return ` (check read access to github.com/${src.repo}: \`gh auth login\` then \`gh auth setup-git\`, or an SSH key)`;
}

// On native Windows a stdio MCP server started through an npm shim needs `cmd /c`.
export function mcpCommand(item, platform = process.platform) {
  const args = item.args ?? [];
  if (platform === 'win32' && /^(npx|npm|pnpm|yarn|bunx)$/i.test(item.command)) return ['cmd', ['/c', item.command, ...args]];
  return [item.command, args];
}

const parseUpdated = (text) => /(\d+\.\d+\.\d+[\w.+-]*)\s*(?:→|->|to)\s*(\d+\.\d+\.\d+[\w+-]*(?:\.\d+)*)/.exec(text);

export function install(ctx, { update = false } = {}) {
  const { out } = ctx;
  const pf = preflight(ctx);
  if (!pf.ok) {
    for (const p of pf.problems) out.line(`preflight failed: ${p}`);
    return 1;
  }
  out.line(`preflight: ok (node ${pf.node}, claude ${pf.claude}, git ${pf.git})`);

  const sel = select(ctx);
  const mcpNames = sel.items.filter((i) => i.kind === 'mcp').flatMap(mcpNamesOf);
  let inv;
  try {
    inv = inventory(ctx, { mcpNames });
  } catch (e) {
    out.line(`inventory failed: ${e.message}`);
    return 1;
  }
  const state = loadState(ctx.configDir);
  const tally = createTally(out, { dryRun: ctx.dryRun });
  const now = new Date().toISOString();

  // 3. Marketplaces the selected plugins come from (the official one always, on a full run).
  const needed = new Set(sel.items.filter((i) => i.kind === 'plugin').map((i) => i.marketplace));
  if (!ctx.flags.only) needed.add(OFFICIAL);
  const unavailable = new Set();
  for (const name of needed) {
    if (inv.marketplaces.some((m) => m.name === name)) {
      tally.present(name, 'present: marketplace');
      continue;
    }
    const def = ctx.deps.marketplaces?.[name];
    if (!def?.source) {
      unavailable.add(name);
      tally.fail(name, 'marketplace is not declared in registry/dependencies.json');
      continue;
    }
    const r = ctx.claude(['plugin', 'marketplace', 'add', def.source], { mutating: true });
    if (r.code !== 0) {
      unavailable.add(name);
      tally.fail(name, reason(r));
      continue;
    }
    inv.marketplaces.push({ name, source: 'github', repo: def.source });
    state.marketplaces[name] = { source: def.source, addedAt: now };
    tally.change(name, 'installed (marketplace)');
  }

  // 4. Crew itself, pinned to the source.
  if (sel.crew) installCrew(ctx, inv, state, tally, now);

  // In update mode, refresh the catalogs crew-installed plugins come from before updating them.
  const crewInstalled = (id) => id !== CREW_PLUGIN && Object.hasOwn(state.plugins, id) && inv.plugins.some((p) => p.id === id);
  if (update) {
    const refresh = new Set(sel.items
      .filter((i) => i.kind === 'plugin' && !unavailable.has(i.marketplace) && crewInstalled(`${i.plugin}@${i.marketplace}`))
      .map((i) => i.marketplace));
    for (const m of refresh) {
      const r = ctx.claude(['plugin', 'marketplace', 'update', m], { mutating: true });
      if (r.code !== 0) out.line(`${m}: warning: could not refresh the marketplace: ${reason(r)}`);
    }
  }

  // 5 + 6. Dependencies, then extras.
  for (const item of sel.items) {
    const det = detect(ctx, inv, item);
    const note = binaryNote(ctx, item);

    if (det.present) {
      const pid = det.plugin?.id;
      if (update && det.how === 'plugin' && pid && crewInstalled(pid)) {
        const r = ctx.claude(['plugin', 'update', pid, '--scope', det.plugin.scope || 'user'], { mutating: true });
        if (r.code !== 0) {
          out.line(`${item.id}: ${withNote(presentLabel(det, item), `warning: update failed (${reason(r)})`)}`);
        } else if (r.dryRun) {
          tally.change(item.id, withNote(`updated (if the catalog has a newer version than ${det.plugin.version ?? 'the installed one'})`, note));
        } else if (/already at the latest/i.test(`${r.stdout}${r.stderr}`)) {
          tally.present(item.id, withNote(`${presentLabel(det, item)}; up to date`, note));
        } else {
          const m = parseUpdated(`${r.stdout}\n${r.stderr}`);
          state.plugins[pid] = { ...state.plugins[pid], version: m?.[2], updatedAt: now };
          tally.change(item.id, withNote(m ? `updated (${m[1]} -> ${m[2]})` : 'updated', note));
        }
        continue;
      }
      let label = presentLabel(det, item);
      if (det.duplicate) label += `; warning: ${duplicateText(ctx, det)}`;
      tally.present(item.id, withNote(label, note));
      continue;
    }

    if (item.kind === 'mcp') {
      const [command, args] = mcpCommand(item);
      const r = ctx.claude(['mcp', 'add', '--scope', 'user', item.name, '--', command, ...args], { mutating: true });
      if (r.code !== 0) {
        tally.fail(item.id, reason(r));
        continue;
      }
      inv.mcp.set(item.name, { present: true, scope: 'User config' });
      state.mcpServers[item.name] = { item: item.id, scope: 'user', command, args, installedAt: now };
      tally.change(item.id, withNote('installed (mcp, user scope)', note));
      continue;
    }

    if (item.kind !== 'plugin') {
      tally.skip(item.id, `unknown kind "${item.kind}"`);
      continue;
    }
    if (unavailable.has(item.marketplace)) {
      tally.fail(item.id, `marketplace ${item.marketplace} is not available`);
      continue;
    }
    const id = `${item.plugin}@${item.marketplace}`;
    const r = ctx.claude(['plugin', 'install', id, '--scope', 'user'], { mutating: true });
    if (r.code !== 0) {
      tally.fail(item.id, reason(r));
      continue;
    }
    inv.plugins.push({ id, scope: 'user', enabled: true });
    state.plugins[id] = { item: item.id, installedAt: now };
    tally.change(item.id, withNote(`installed (${id})`, note));
  }

  if (!ctx.dryRun) saveState(ctx.configDir, state);

  // 7. Summary.
  const c = tally.counts;
  const tail = [plural(c.changed, 'change'), `${c.present} present`, c.skipped ? `${c.skipped} skipped` : null, c.failed ? `${c.failed} failed` : null]
    .filter(Boolean).join(', ');
  if (ctx.dryRun) {
    out.line(`Dry run: ${plural(ctx.runner.planned.length, 'command')} would run (${tail}); nothing was changed.`);
    return c.failed ? 1 : 0;
  }
  if (c.failed) {
    out.line(`Finished with failures (${tail}). Fix the failures above and run crew ${update ? 'update' : 'install'} again.`);
    return 1;
  }
  if (c.changed) out.line(`Done (${tail}). Restart Claude Code to load crew.`);
  else out.line(`Nothing to change: everything is already in place (${tail}).`);
  return 0;
}

function installCrew(ctx, inv, state, tally, now) {
  const src = ctx.source;
  const expected = impliedVersion(src, ctx.pkg.version);
  let entry = inv.marketplaces.find((m) => m.name === CREW_MARKETPLACE);
  let repinnedFrom = null;

  // Re-adding a marketplace under the same name with a different ref is refused, so re-pin by
  // removing it (which also uninstalls crew@crew) and adding it again.
  if (entry && !sourceMatches(entry, src)) {
    repinnedFrom = describeEntry(entry);
    const r = ctx.claude(['plugin', 'marketplace', 'remove', CREW_MARKETPLACE], { mutating: true });
    if (r.code !== 0) return tally.fail('crew', `could not remove the crew marketplace pinned to ${repinnedFrom}: ${reason(r)}`);
    inv.marketplaces = inv.marketplaces.filter((m) => m.name !== CREW_MARKETPLACE);
    inv.plugins = inv.plugins.filter((p) => !String(p.id).endsWith(`@${CREW_MARKETPLACE}`));
    entry = null;
  }
  if (!entry) {
    const r = ctx.claude(['plugin', 'marketplace', 'add', src.spec], { mutating: true });
    if (r.code !== 0) return tally.fail('crew', `marketplace add ${src.spec}: ${reason(r)}${accessHint(src)}`);
    inv.marketplaces.push({ name: CREW_MARKETPLACE, ...entryFor(src) });
    state.marketplaces[CREW_MARKETPLACE] = { source: src.spec, addedAt: now };
  }

  const current = inv.plugins.find((p) => p.id === CREW_PLUGIN);
  if (current && current.version === expected && !repinnedFrom) {
    state.crew = { source: src.spec, version: current.version };
    return tally.present('crew', `present: plugin (${current.version}) from ${src.spec}`);
  }

  const args = current
    ? ['plugin', 'update', CREW_PLUGIN, '--scope', current.scope && current.scope !== 'synced' ? current.scope : 'user']
    : ['plugin', 'install', CREW_PLUGIN, '--scope', 'user'];
  const r = ctx.claude(args, { mutating: true });
  if (r.code !== 0) return tally.fail('crew', reason(r));

  let version = expected;
  if (!ctx.dryRun) {
    try {
      version = listPlugins(ctx).find((p) => p.id === CREW_PLUGIN)?.version ?? expected;
    } catch { /* keep expected */ }
  }
  state.plugins[CREW_PLUGIN] = { item: 'crew', source: src.spec, version, installedAt: now };
  state.crew = { source: src.spec, version };
  inv.plugins.push({ id: CREW_PLUGIN, version, scope: 'user', enabled: true });

  const notes = [];
  if (repinnedFrom) notes.push(`re-pinned from ${repinnedFrom}`);
  if (!ctx.dryRun && version !== expected) notes.push(`warning: expected ${expected}`);
  const verb = current ? 'updated' : 'installed';
  tally.change('crew', `${verb} (${version} from ${src.spec}${notes.length ? `; ${notes.join('; ')}` : ''})`);
}

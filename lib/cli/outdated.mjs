// `crew outdated` (network): is anything crew pins behind upstream? It only reports; the skill
// scout reviews each change and nothing moves until a human approves.
//   vendored sources  -> lib/upstream.mjs sourceStatus (git ls-remote)
//   plugin pins       -> the marketplace catalog JSON: entry `source` (deep-equal) and `version`
//   mcp pins          -> https://registry.npmjs.org/<pkg>/latest
// Network access goes through `net` so tests can stub it.

import { isDeepStrictEqual } from 'node:util';
import { loadManifest, sourceStatus } from '../upstream.mjs';
import { select } from './context.mjs';
import { compareVersions } from './source.mjs';

export const NEXT_STEP = 'Run /crew:scout upgrades to review.';

export async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'crew-cli' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

export const defaultNet = { fetchJson, sourceStatus };

const short = (sha) => (typeof sha === 'string' ? sha.slice(0, 7) : '?');

function describeSource(s) {
  if (s === undefined) return 'none';
  if (typeof s === 'string') return s;
  const where = s.url ?? s.repo ?? s.package ?? s.source;
  const at = s.sha ? `@${short(s.sha)}` : s.ref ? `#${s.ref}` : '';
  return `${where}${at}${s.path ? ` (${s.path})` : ''}`;
}

function npmPackageOf(item) {
  if (item.vetted?.npm) return item.vetted.npm;
  for (const a of item.args ?? []) {
    const m = /^(@?[^@\s]+(?:\/[^@\s]+)?)@\d/.exec(a);
    if (m) return m[1];
  }
  return null;
}

export function vendorRow(id, src, s, skills) {
  const base = { id: `vendor/${id}`, kind: 'vendor', vetted: src.version ?? null, pinnedCommit: src.commit, latest: s.latestTag ?? null };
  const pinned = [src.version, `@${short(src.commit)}`].filter(Boolean).join(' ');
  if (s.status === 'behind') {
    return { ...base, status: 'behind', detail: `pinned ${pinned}, latest release ${s.latestTag}; affects ${skills.length} vendored skill${skills.length === 1 ? '' : 's'}: ${skills.join(', ')}` };
  }
  if (s.status === 'current') {
    return { ...base, status: 'current', detail: pinned };
  }
  return { ...base, status: 'changed', detail: `pinned @${short(src.commit)} is neither the latest release (${s.latestTag ?? 'none'} @${short(s.latestTagCommit)}) nor the default-branch head (@${short(s.head)})` };
}

export function pluginRow(item, catalog) {
  const base = { id: item.id, kind: 'plugin', vetted: item.vetted?.version ?? null };
  const entry = (catalog?.plugins ?? []).find((p) => p.name === item.plugin);
  if (!entry) return { ...base, status: 'changed', latest: null, detail: `${item.plugin} is no longer in the ${item.marketplace} catalog` };
  const vetted = item.vetted?.version;
  const cmp = vetted && entry.version ? compareVersions(entry.version, vetted) : null;
  const sameSource = item.vetted?.catalogSource !== undefined && isDeepStrictEqual(entry.source, item.vetted.catalogSource);
  const latest = entry.version ?? null;
  if (cmp === 1) return { ...base, status: 'behind', latest, detail: `vetted ${vetted}, catalog ${entry.version}${sameSource ? '' : `; source ${describeSource(item.vetted?.catalogSource)} -> ${describeSource(entry.source)}`}` };
  if (!sameSource) return { ...base, status: 'changed', latest, detail: `catalog source ${describeSource(item.vetted?.catalogSource)} -> ${describeSource(entry.source)}` };
  if (cmp !== null && cmp !== 0) return { ...base, status: 'changed', latest, detail: `catalog version ${entry.version}, vetted ${vetted}` };
  const relative = typeof entry.source === 'string';
  return { ...base, status: 'current', latest, detail: `${entry.version ?? vetted ?? ''} ${describeSource(entry.source)}${relative ? ' (in-catalog plugin; content follows the catalog commit)' : ''}`.trim() };
}

export function mcpRow(item, pkg, meta) {
  const vetted = item.vetted?.version ?? null;
  const latest = meta?.version ?? null;
  const base = { id: item.id, kind: 'mcp', vetted, latest };
  const cmp = compareVersions(latest, vetted);
  if (cmp === 1) return { ...base, status: 'behind', detail: `${pkg}: vetted ${vetted}, npm latest ${latest}` };
  if (cmp === 0) return { ...base, status: 'current', detail: `${pkg}@${vetted}` };
  return { ...base, status: 'changed', detail: `${pkg}: vetted ${vetted}, npm latest ${latest ?? 'unknown'}` };
}

export async function outdated(ctx, net = defaultNet) {
  const fetchJsonFn = net.fetchJson ?? fetchJson;
  const sourceStatusFn = net.sourceStatus ?? sourceStatus;
  const rows = [];
  const failed = (id, kind, e) => rows.push({ id, kind, status: 'failed', detail: e?.message ?? String(e) });
  const sel = select(ctx);
  const wanted = (id) => !ctx.flags.only || ctx.flags.only.includes(id);

  // Vendored skill sources.
  if (!ctx.flags.only) {
    let manifest;
    try {
      manifest = loadManifest(ctx.root);
    } catch (e) {
      failed('vendor', 'vendor', e);
    }
    for (const [id, src] of Object.entries(manifest?.sources ?? {})) {
      const skills = (manifest.skills ?? []).filter((s) => s.source === id).map((s) => s.name);
      try {
        rows.push(vendorRow(id, src, await sourceStatusFn(src), skills));
      } catch (e) {
        failed(`vendor/${id}`, 'vendor', e);
      }
    }
  }

  // Plugin pins, one catalog fetch per marketplace.
  const catalogs = new Map();
  for (const item of sel.items.filter((i) => i.kind === 'plugin' && wanted(i.id))) {
    const url = ctx.deps.marketplaces?.[item.marketplace]?.catalog;
    if (!url) {
      failed(item.id, 'plugin', new Error(`no catalog URL for marketplace ${item.marketplace} in registry/dependencies.json`));
      continue;
    }
    if (!catalogs.has(url)) catalogs.set(url, Promise.resolve().then(() => fetchJsonFn(url)));
    try {
      rows.push(pluginRow(item, await catalogs.get(url)));
    } catch (e) {
      failed(item.id, 'plugin', e);
    }
  }

  // MCP pins on npm.
  for (const item of sel.items.filter((i) => i.kind === 'mcp' && wanted(i.id))) {
    const pkg = npmPackageOf(item);
    if (!pkg) {
      failed(item.id, 'mcp', new Error('no npm package to compare (set vetted.npm)'));
      continue;
    }
    try {
      rows.push(mcpRow(item, pkg, await fetchJsonFn(`https://registry.npmjs.org/${pkg}/latest`)));
    } catch (e) {
      failed(item.id, 'mcp', e);
    }
  }

  const count = (s) => rows.filter((r) => r.status === s).length;
  const summary = { behind: count('behind'), changed: count('changed'), current: count('current'), failed: count('failed') };
  if (ctx.flags.json) {
    ctx.out.line(JSON.stringify({ items: rows, summary, next: NEXT_STEP }, null, 2));
  } else {
    for (const r of rows) ctx.out.line(`${r.id}: ${r.status === 'failed' ? `failed: ${r.detail}` : `${r.status} (${r.detail})`}`);
    const parts = [`${summary.behind} behind`, `${summary.changed} changed`, `${summary.current} current`];
    if (summary.failed) parts.push(`${summary.failed} could not be checked`);
    ctx.out.line(`outdated: ${parts.join(', ')}. ${NEXT_STEP}`);
  }
  return 0;
}

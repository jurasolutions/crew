// crew outdated with the network stubbed: vendored sources, catalog pins, npm pins.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { createContext } from '../../lib/cli/context.mjs';
import { NEXT_STEP, mcpRow, outdated, pluginRow } from '../../lib/cli/outdated.mjs';
import { DEPS, EXTRAS, ROOT } from '../fixtures/fake-claude/harness.mjs';

const REGISTRY = JSON.parse(readFileSync(join(ROOT, 'registry', 'dependencies.json'), 'utf8'));
const CATALOG_URL = REGISTRY.marketplaces['claude-plugins-official'].catalog;
const UPSTREAM = JSON.parse(readFileSync(join(ROOT, 'vendor', 'UPSTREAM.json'), 'utf8'));

function capture(flags = {}) {
  let text = '';
  const stdout = { write: (s) => { text += s; } };
  const ctx = createContext({ flags, env: { CLAUDE_CONFIG_DIR: '/nonexistent-crew-test' }, stdout, stderr: stdout });
  return { ctx, text: () => text, lines: () => text.split('\n').filter(Boolean) };
}

// A catalog that matches every vetted pin, which tests then perturb.
function vettedCatalog() {
  return {
    name: 'claude-plugins-official',
    plugins: [...DEPS, ...EXTRAS].filter((x) => x.kind === 'plugin').map((x) => ({
      name: x.plugin,
      source: structuredClone(x.vetted.catalogSource),
      ...(x.vetted.version && typeof x.vetted.catalogSource === 'string' ? { version: x.vetted.version } : {}),
    })),
  };
}

const currentVendor = (src) => ({ status: 'current', latestTag: `v${src.version}`, latestTagCommit: src.commit, head: src.commit });

function stubNet({ catalog = vettedCatalog(), npm = {}, vendor = currentVendor, fail = [] } = {}) {
  const urls = [];
  return {
    urls,
    net: {
      fetchJson: async (url) => {
        urls.push(url);
        if (fail.some((f) => url.includes(f))) throw new Error(`getaddrinfo ENOTFOUND ${new URL(url).host}`);
        if (url === CATALOG_URL) return catalog;
        const m = /^https:\/\/registry\.npmjs\.org\/(.+)\/latest$/.exec(url);
        if (m) return { name: m[1], version: npm[m[1]] ?? EXTRAS.find((x) => x.vetted?.npm === m[1])?.vetted.version };
        throw new Error(`unexpected URL ${url}`);
      },
      sourceStatus: (src) => vendor(src),
    },
  };
}

describe('outdated', () => {
  test('everything current: one line per item, then the scout pointer; exit 0', async () => {
    const c = capture();
    const { net, urls } = stubNet();
    const code = await outdated(c.ctx, net);
    assert.equal(code, 0);
    const lines = c.lines();
    const ids = [...Object.keys(UPSTREAM.sources).map((s) => `vendor/${s}`), ...DEPS.map((d) => d.id), ...EXTRAS.map((x) => x.id)];
    for (const id of ids) assert.match(lines.find((l) => l.startsWith(`${id}: `)) ?? `${id}: <none>`, /: current \(/);
    assert.equal(lines.at(-1), `outdated: 0 behind, 0 changed, ${ids.length} current. ${NEXT_STEP}`);
    assert.equal(urls.filter((u) => u === CATALOG_URL).length, 1, 'the catalog is fetched once');
  });

  test('a stale pin: moved source is "changed", newer version is "behind", npm and vendor too', async () => {
    const catalog = vettedCatalog();
    const sp = catalog.plugins.find((p) => p.name === 'superpowers');
    sp.source = { ...sp.source, sha: 'f'.repeat(40) };
    const lsp = catalog.plugins.find((p) => p.name === 'typescript-lsp');
    lsp.version = '1.1.0';
    catalog.plugins = catalog.plugins.filter((p) => p.name !== 'pyright-lsp');
    const mcp = EXTRAS.find((x) => x.kind === 'mcp');
    const c = capture();
    const { net } = stubNet({
      catalog,
      npm: { [mcp.vetted.npm]: '9.9.9' },
      vendor: (src) => ({ status: 'behind', latestTag: 'v9.0.0', latestTagCommit: 'a'.repeat(40), head: 'a'.repeat(40) }),
    });
    assert.equal(await outdated(c.ctx, net), 0);
    const line = (id) => c.lines().find((l) => l.startsWith(`${id}: `));
    assert.match(line('superpowers'), /^superpowers: changed \(catalog source .*@bb92a77 -> .*@fffffff\)/);
    assert.match(line('typescript-lsp'), /^typescript-lsp: behind \(vetted 1\.0\.0, catalog 1\.1\.0\)/);
    assert.match(line('pyright-lsp'), /^pyright-lsp: changed \(pyright-lsp is no longer in the claude-plugins-official catalog\)/);
    assert.match(line(mcp.id), new RegExp(`^${mcp.id}: behind \\(.*npm latest 9\\.9\\.9\\)`));
    const mp = UPSTREAM.sources.mattpocock;
    const mpSkills = UPSTREAM.skills.filter((s) => s.source === 'mattpocock').map((s) => s.name);
    assert.equal(line('vendor/mattpocock'), `vendor/mattpocock: behind (pinned ${mp.version} @${mp.commit.slice(0, 7)}, latest release v9.0.0; affects ${mpSkills.length} vendored skills: ${mpSkills.join(', ')})`);
    for (const id of Object.keys(UPSTREAM.sources)) assert.match(line(`vendor/${id}`), /: behind \(pinned /);
    assert.match(line('mattpocock-skills'), /: current/);
    assert.match(c.lines().at(-1), new RegExp(`behind, .*changed, .*current\\. ${NEXT_STEP.replace(/[./]/g, '\\$&')}$`));
  });

  test('a moved upstream head without a new release is "changed"', async () => {
    const c = capture();
    const { net } = stubNet({ vendor: (src) => ({ status: 'head-moved', latestTag: `v${src.version}`, latestTagCommit: 'b'.repeat(40), head: 'c'.repeat(40) }) });
    assert.equal(await outdated(c.ctx, net), 0);
    assert.match(c.lines().find((l) => l.startsWith('vendor/mattpocock')), new RegExp(`changed \\(pinned @${UPSTREAM.sources.mattpocock.commit.slice(0, 7)} is neither the latest release`));
  });

  test('network failures are reported per item and still exit 0', async () => {
    const c = capture();
    const { net } = stubNet({ fail: ['raw.githubusercontent.com', 'registry.npmjs.org'], vendor: () => { throw new Error('could not reach github.com'); } });
    assert.equal(await outdated(c.ctx, net), 0);
    for (const id of [...Object.keys(UPSTREAM.sources).map((s) => `vendor/${s}`), ...DEPS.map((d) => d.id), ...EXTRAS.map((x) => x.id)]) {
      assert.match(c.lines().find((l) => l.startsWith(`${id}: `)), /: failed: /);
    }
    assert.match(c.lines().at(-1), /could not be checked\. Run \/crew:scout upgrades to review\.$/);
  });

  test('--json prints one document', async () => {
    const c = capture({ json: true });
    const { net } = stubNet();
    assert.equal(await outdated(c.ctx, net), 0);
    const j = JSON.parse(c.text());
    assert.equal(j.next, NEXT_STEP);
    assert.equal(j.summary.behind, 0);
    assert.ok(j.items.every((i) => i.status === 'current'));
  });

  test('row helpers: deep-equal source compare and semver compare', () => {
    const item = DEPS.find((d) => d.id === 'mattpocock-skills');
    const same = { plugins: [{ name: item.plugin, source: structuredClone(item.vetted.catalogSource) }] };
    assert.equal(pluginRow(item, same).status, 'current');
    const reordered = { plugins: [{ name: item.plugin, source: Object.fromEntries(Object.entries(item.vetted.catalogSource).reverse()) }] };
    assert.equal(pluginRow(item, reordered).status, 'current', 'key order does not matter');
    const newer = { plugins: [{ name: item.plugin, version: '1.4.0', source: structuredClone(item.vetted.catalogSource) }] };
    assert.equal(pluginRow(item, newer).status, 'behind');
    const mcp = EXTRAS.find((x) => x.kind === 'mcp');
    assert.equal(mcpRow(mcp, 'pkg', { version: mcp.vetted.version }).status, 'current');
    assert.equal(mcpRow(mcp, 'pkg', { version: '0.0.1' }).status, 'changed');
  });
});

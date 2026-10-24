// crew uninstall [--with-deps]: removes crew; with --with-deps only what state.json records.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import {
  EXTRAS, LOOSE_FRONTEND, LOOSE_SUPERPOWERS, OFFICIAL, THIS_MAC, fakeMachine,
} from '../fixtures/fake-claude/harness.mjs';

const machines = [];
const machine = (opts) => {
  const m = fakeMachine(opts);
  machines.push(m);
  return m;
};
afterEach(() => {
  while (machines.length) machines.pop().cleanup();
});

// This Mac, plus one plugin the user installed themselves before crew arrived.
const userOwnPlugin = { id: 'typescript-lsp@claude-plugins-official', version: '1.0.0', scope: 'user', enabled: true };
const withOwnPlugin = { ...THIS_MAC, state: { ...THIS_MAC.state, plugins: [...THIS_MAC.state.plugins, userOwnPlugin] } };

const looseSnapshot = (config) => [...LOOSE_SUPERPOWERS, ...LOOSE_FRONTEND]
  .map((s) => [s, readFileSync(join(config, 'skills', s, 'SKILL.md'), 'utf8')]);

describe('uninstall', () => {
  test('removes the crew plugin and marketplace; leaves dependencies alone', () => {
    const m = machine(withOwnPlugin);
    assert.equal(m.crew(['install']).code, 0);
    m.clearCalls();
    const r = m.crew(['uninstall']);
    assert.equal(r.code, 0, r.all);
    assert.deepEqual(m.mutatingCalls(), ['plugin uninstall crew@crew --scope user', 'plugin marketplace remove crew']);
    const fake = m.fake();
    assert.ok(!fake.plugins.some((p) => p.id === 'crew@crew'));
    assert.ok(!fake.marketplaces.some((x) => x.name === 'crew'));
    assert.ok(fake.marketplaces.some((x) => x.name === OFFICIAL));
    assert.ok(fake.plugins.some((p) => p.id === 'pyright-lsp@claude-plugins-official'), 'crew-installed deps stay without --with-deps');
    assert.ok(fake.mcpServers.playwright);
    assert.match(r.lines.at(-1), /crew uninstall --with-deps removes them/);
    // state.json still remembers the deps, so a later --with-deps can remove them.
    assert.ok(m.crewState().plugins['pyright-lsp@claude-plugins-official']);
    assert.ok(!m.crewState().plugins['crew@crew']);
  });

  test('--with-deps removes only state.json items; loose skills, synced and user plugins untouched', () => {
    const m = machine(withOwnPlugin);
    const loose = looseSnapshot(m.config);
    assert.equal(m.crew(['install']).code, 0);
    m.clearCalls();
    const r = m.crew(['uninstall', '--with-deps']);
    assert.equal(r.code, 0, r.all);
    const mcp = EXTRAS.filter((x) => x.kind === 'mcp').map((x) => `mcp remove ${x.name} --scope user`);
    assert.deepEqual(m.mutatingCalls(), [
      'plugin uninstall crew@crew --scope user',
      'plugin marketplace remove crew',
      'plugin uninstall pyright-lsp@claude-plugins-official --scope user',
      ...mcp,
    ]);
    const fake = m.fake();
    assert.deepEqual(fake.plugins.map((p) => p.id).sort(), ['mattpocock-skills@synced', 'typescript-lsp@claude-plugins-official']);
    assert.deepEqual(fake.mcpServers, {});
    assert.ok(fake.marketplaces.some((x) => x.name === OFFICIAL), 'never removes claude-plugins-official');
    assert.deepEqual(looseSnapshot(m.config), loose);
    const st = m.crewState();
    assert.deepEqual(st.plugins, {});
    assert.deepEqual(st.mcpServers, {});
  });

  test('--with-deps on a fresh install never removes the official marketplace crew added', () => {
    const m = machine();
    assert.equal(m.crew(['install']).code, 0);
    assert.ok(m.crewState().marketplaces[OFFICIAL]);
    m.clearCalls();
    const r = m.crew(['uninstall', '--with-deps']);
    assert.equal(r.code, 0, r.all);
    assert.ok(!m.mutatingCalls().some((c) => c.includes(`remove ${OFFICIAL}`)));
    assert.deepEqual(m.fake().plugins, []);
    assert.ok(m.fake().marketplaces.some((x) => x.name === OFFICIAL));
  });

  test('items already gone are skipped, not failed', () => {
    const m = machine(THIS_MAC);
    assert.equal(m.crew(['install']).code, 0);
    m.editFake((s) => {
      s.plugins = s.plugins.filter((p) => p.id !== 'pyright-lsp@claude-plugins-official');
    });
    const r = m.crew(['uninstall', '--with-deps']);
    assert.equal(r.code, 0, r.all);
    assert.match(m.line(r, 'pyright-lsp'), /^pyright-lsp: skipped: /);
    const again = m.crew(['uninstall']);
    assert.equal(again.code, 0, again.all);
    assert.equal(m.line(again, 'crew'), 'crew: skipped: plugin not installed');
  });

  test('--dry-run makes no mutating calls and keeps state.json', () => {
    const m = machine(THIS_MAC);
    assert.equal(m.crew(['install']).code, 0);
    const before = m.crewState();
    m.clearCalls();
    const r = m.crew(['uninstall', '--with-deps', '--dry-run']);
    assert.equal(r.code, 0, r.all);
    assert.deepEqual(m.mutatingCalls(), []);
    assert.ok(r.lines.includes('$ claude plugin uninstall crew@crew --scope user'));
    assert.ok(r.lines.includes('$ claude plugin marketplace remove crew'));
    assert.deepEqual(m.crewState(), before);
    assert.ok(existsSync(join(m.config, 'skills', 'using-superpowers', 'SKILL.md')));
  });

  test('--with-deps is only accepted by uninstall', () => {
    const m = machine();
    const r = m.crew(['install', '--with-deps']);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /--with-deps works with uninstall/);
  });
});

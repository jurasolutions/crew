// crew doctor: per-item status, exit codes, duplicates, drift, missing binaries.

import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import {
  DEFAULT_SOURCE, EXTRAS, LOOSE_FRONTEND, LOOSE_SUPERPOWERS, OFFICIAL, OFFICIAL_MARKETPLACE, PKG, THIS_MAC, fakeMachine,
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

const [owner, rest] = DEFAULT_SOURCE.split('/');
const crewMarketplace = { name: 'crew', source: 'github', repo: `${owner}/${rest.split('#')[0]}`, ref: `v${PKG.version}` };
const crewPlugin = { id: 'crew@crew', version: PKG.version, scope: 'user', enabled: true };

describe('doctor', () => {
  test('this Mac after install: exit 0; reports how each item is present, and drift', () => {
    const m = machine(THIS_MAC);
    assert.equal(m.crew(['install']).code, 0);
    m.clearCalls();
    const r = m.crew(['doctor']);
    assert.equal(r.code, 0, r.all);
    assert.deepEqual(m.mutatingCalls(), []);
    assert.equal(m.line(r, 'crew'), `crew: present: plugin (${PKG.version}) from ${DEFAULT_SOURCE}`);
    assert.equal(m.line(r, 'superpowers'), 'superpowers: present: loose (version unknown)');
    assert.equal(m.line(r, 'frontend-design'), 'frontend-design: present: loose (version unknown)');
    assert.equal(m.line(r, 'mattpocock-skills'), 'mattpocock-skills: present: synced (1.2.3); warning: drift: 1.2.3 installed, vetted 1.3.1');
    assert.match(r.lines.at(-1), /^doctor: ok \(0 errors, \d+ warnings?\)\.$/);
  });

  test('a missing required dependency exits 1', () => {
    const m = machine({
      state: { marketplaces: [OFFICIAL_MARKETPLACE, crewMarketplace], plugins: [crewPlugin, { id: 'mattpocock-skills@synced', version: '1.3.1', scope: 'synced', enabled: true }] },
      looseSkills: LOOSE_FRONTEND,
    });
    const r = m.crew(['doctor']);
    assert.equal(r.code, 1, r.all);
    assert.match(m.line(r, 'superpowers'), /^superpowers: missing \(required\); error: /);
    assert.equal(m.line(r, 'mattpocock-skills'), 'mattpocock-skills: present: synced (1.3.1)');
    assert.match(r.lines.at(-1), /^doctor: problems found \(1 error, /);
  });

  test('missing crew exits 1; a missing extra only warns', () => {
    const m = machine({ ...THIS_MAC });
    const r = m.crew(['doctor']);
    assert.equal(r.code, 1, r.all);
    assert.match(m.line(r, 'crew'), /^crew: missing; error: crew marketplace missing; error: plugin crew@crew not installed/);
    for (const x of EXTRAS) assert.match(m.line(r, x.id), /missing \(optional extra\); warning: /);

    const ok = machine({ ...THIS_MAC, state: { ...THIS_MAC.state, marketplaces: [OFFICIAL_MARKETPLACE, crewMarketplace], plugins: [...THIS_MAC.state.plugins, crewPlugin] } });
    const r2 = ok.crew(['doctor']);
    assert.equal(r2.code, 0, r2.all);
  });

  test('duplicate warning: superpowers as a plugin and as loose skills (exit 0)', () => {
    const m = machine({
      state: {
        marketplaces: [OFFICIAL_MARKETPLACE, crewMarketplace],
        plugins: [crewPlugin, { id: 'superpowers@claude-plugins-official', version: '7.0.0', scope: 'user', enabled: true }, { id: 'mattpocock-skills@synced', version: '1.3.1', scope: 'synced', enabled: true }, { id: 'mattpocock-skills@claude-plugins-official', version: '1.3.1', scope: 'user', enabled: true }],
      },
      looseSkills: [...LOOSE_SUPERPOWERS, ...LOOSE_FRONTEND],
    });
    const r = m.crew(['doctor']);
    assert.equal(r.code, 0, r.all);
    assert.match(m.line(r, 'superpowers'), /^superpowers: present: plugin \(7\.0\.0\); warning: duplicate: superpowers@claude-plugins-official and loose skills in /);
    assert.match(m.line(r, 'mattpocock-skills'), /warning: duplicate: mattpocock-skills@synced and mattpocock-skills@claude-plugins-official/);
  });

  test('crew version and source drift are warnings', () => {
    const m = machine({
      state: { marketplaces: [OFFICIAL_MARKETPLACE, { ...crewMarketplace, ref: 'v0.9.0' }], plugins: [{ ...crewPlugin, version: '0.9.0' }] },
      looseSkills: [...LOOSE_SUPERPOWERS, ...LOOSE_FRONTEND, 'grilling', 'domain-modeling', 'tdd', 'code-review'],
    });
    const r = m.crew(['doctor']);
    assert.equal(r.code, 0, r.all);
    const l = m.line(r, 'crew');
    assert.match(l, /warning: marketplace pinned to .*#v0\.9\.0; this package expects /);
    assert.match(l, new RegExp(`warning: crew 0\\.9\\.0 installed; this package is ${PKG.version.replace(/\./g, '\\.')} \\(run crew update\\)`));
  });

  test('--json is one JSON document with per-item status', () => {
    const m = machine(THIS_MAC);
    const r = m.crew(['doctor', '--json']);
    assert.equal(r.code, 1);
    const j = JSON.parse(r.stdout);
    assert.equal(j.ok, false);
    assert.equal(j.preflight.ok, true);
    const byId = Object.fromEntries(j.items.map((i) => [i.id, i]));
    assert.equal(byId.crew.status, 'error');
    assert.equal(byId.superpowers.how, 'loose');
    assert.equal(byId['mattpocock-skills'].how, 'synced');
    assert.equal(byId['mattpocock-skills'].version, '1.2.3');
    assert.equal(byId['mattpocock-skills'].vetted, '1.3.1');
    assert.equal(byId['mattpocock-skills'].status, 'warning');
    assert.equal(byId[OFFICIAL].status, 'ok');
    assert.ok(j.errors >= 1);
  });

  test('preflight failure exits 1', () => {
    const m = machine({ state: { version: '1.0.0' } });
    const r = m.crew(['doctor']);
    assert.equal(r.code, 1);
    assert.match(r.stdout, /preflight failed: Claude Code 1\.0\.0 is too old/);
  });
});

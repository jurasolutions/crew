// crew install / update against the fake `claude` (test/fixtures/fake-claude).

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import { which } from '../../lib/cli/exec.mjs';
import {
  DEFAULT_SOURCE, DEPS, EXTRAS, LOOSE_FRONTEND, LOOSE_SUPERPOWERS, OFFICIAL, OFFICIAL_MARKETPLACE, PKG, THIS_MAC,
  fakeMachine, localCrewSource, mcpAddArgs, stubBinary,
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

const pluginInstall = (x) => `plugin install ${x.plugin}@${x.marketplace} --scope user`;
const extraInstall = (x) => (x.kind === 'mcp' ? mcpAddArgs(x) : pluginInstall(x));
const OWNER_REPO = DEFAULT_SOURCE.split('#')[0];

describe('install', () => {
  test('fresh machine: adds the official marketplace, crew, all 3 deps and the extras', () => {
    const m = machine();
    const r = m.crew(['install']);
    assert.equal(r.code, 0, r.all);
    assert.equal(DEPS.length, 3);
    assert.deepEqual(m.mutatingCalls(), [
      'plugin marketplace add anthropics/claude-plugins-official',
      `plugin marketplace add ${DEFAULT_SOURCE}`,
      'plugin install crew@crew --scope user',
      ...DEPS.map(pluginInstall),
      ...EXTRAS.map(extraInstall),
    ]);
    assert.match(m.line(r, 'crew'), new RegExp(`^crew: installed \\(${PKG.version} from `));
    for (const d of DEPS) assert.match(m.line(r, d.id), /: installed/);
    for (const x of EXTRAS) assert.match(m.line(r, x.id), /: installed/);
    assert.match(r.lines.at(-1), /Restart Claude Code to load crew\.$/);

    const st = m.crewState();
    assert.deepEqual(Object.keys(st.plugins).sort(), [
      'crew@crew',
      ...[...DEPS, ...EXTRAS.filter((x) => x.kind === 'plugin')].map((x) => `${x.plugin}@${x.marketplace}`),
    ].sort());
    assert.deepEqual(Object.keys(st.mcpServers), EXTRAS.filter((x) => x.kind === 'mcp').map((x) => x.name));
    assert.ok(st.marketplaces[OFFICIAL]);
    assert.equal(st.crew.source, DEFAULT_SOURCE);
  });

  test('this Mac: installs only crew + extras and reports present: synced / present: loose', () => {
    const m = machine(THIS_MAC);
    const skillBefore = readFileSync(join(m.config, 'skills', 'systematic-debugging', 'SKILL.md'), 'utf8');
    const r = m.crew(['install']);
    assert.equal(r.code, 0, r.all);
    assert.deepEqual(m.mutatingCalls(), [
      `plugin marketplace add ${DEFAULT_SOURCE}`,
      'plugin install crew@crew --scope user',
      ...EXTRAS.map(extraInstall),
    ]);
    assert.equal(m.line(r, OFFICIAL), `${OFFICIAL}: present: marketplace`);
    assert.equal(m.line(r, 'superpowers'), 'superpowers: present: loose');
    assert.equal(m.line(r, 'mattpocock-skills'), 'mattpocock-skills: present: synced (1.2.3; vetted 1.3.1)');
    assert.equal(m.line(r, 'frontend-design'), 'frontend-design: present: loose');
    // Loose skills are only ever read.
    assert.equal(readFileSync(join(m.config, 'skills', 'systematic-debugging', 'SKILL.md'), 'utf8'), skillBefore);
    // Nothing crew did not install is recorded as crew's.
    const st = m.crewState();
    assert.ok(!Object.keys(st.plugins).some((id) => id.startsWith('mattpocock-skills@') || id.startsWith('superpowers@')));
    assert.ok(!st.marketplaces[OFFICIAL]);
  });

  test('idempotent: a second run makes zero add/install calls and says so', () => {
    for (const opts of [{}, THIS_MAC]) {
      const m = machine(opts);
      assert.equal(m.crew(['install']).code, 0);
      m.clearCalls();
      const r = m.crew(['install']);
      assert.equal(r.code, 0, r.all);
      assert.deepEqual(m.mutatingCalls(), []);
      assert.match(r.lines.at(-1), /^Nothing to change/);
      assert.ok(m.calls().length > 0, 'inventory still runs');
    }
  });

  test('--dry-run: prints the exact commands and makes no mutating calls', () => {
    const m = machine();
    const before = m.fake();
    const r = m.crew(['install', '--dry-run']);
    assert.equal(r.code, 0, r.all);
    assert.deepEqual(m.mutatingCalls(), []);
    assert.deepEqual(m.fake(), before);
    assert.equal(m.crewState(), null, 'no state.json in a dry run');
    const printed = r.lines.filter((l) => l.startsWith('$ ')).map((l) => l.slice(2));
    assert.deepEqual(printed, [
      'claude plugin marketplace add anthropics/claude-plugins-official',
      `claude plugin marketplace add ${DEFAULT_SOURCE}`,
      'claude plugin install crew@crew --scope user',
      ...[...DEPS.map(pluginInstall), ...EXTRAS.map(extraInstall)].map((c) => `claude ${c}`),
    ]);
    assert.match(m.line(r, 'superpowers'), /would install/);
    assert.match(r.lines.at(-1), /^Dry run: .*nothing was changed\.$/);
  });

  test('--no-extras skips extras; --only limits to one item', () => {
    const m = machine(THIS_MAC);
    const r = m.crew(['install', '--no-extras']);
    assert.equal(r.code, 0, r.all);
    assert.deepEqual(m.mutatingCalls(), [`plugin marketplace add ${DEFAULT_SOURCE}`, 'plugin install crew@crew --scope user']);
    for (const x of EXTRAS) assert.equal(m.line(r, x.id), undefined);

    const f = machine();
    const r2 = f.crew(['install', '--only', 'superpowers']);
    assert.equal(r2.code, 0, r2.all);
    assert.deepEqual(f.mutatingCalls(), ['plugin marketplace add anthropics/claude-plugins-official', 'plugin install superpowers@claude-plugins-official --scope user']);

    const bad = f.crew(['install', '--only', 'nope']);
    assert.equal(bad.code, 2);
    assert.match(bad.stderr, /unknown --only id "nope"/);
  });

  test('--source /local/path (and CREW_SOURCE) override where crew comes from', () => {
    const m = machine({ state: { marketplaces: [OFFICIAL_MARKETPLACE] } });
    const local = localCrewSource(m.dir);
    const r = m.crew(['install', '--only', 'crew', '--source', local]);
    assert.equal(r.code, 0, r.all);
    assert.deepEqual(m.mutatingCalls(), [`plugin marketplace add ${local}`, 'plugin install crew@crew --scope user']);
    assert.equal(m.fake().marketplaces.find((x) => x.name === 'crew').source, 'directory');
    assert.equal(m.crewState().crew.source, local);

    // Same path again: nothing to do. Via the env var this time.
    m.clearCalls();
    const again = m.crew(['install', '--only', 'crew'], { CREW_SOURCE: local });
    assert.equal(again.code, 0, again.all);
    assert.deepEqual(m.mutatingCalls(), []);

    // Back to the default (GitHub) source: re-pinned with remove + add + install.
    m.clearCalls();
    const back = m.crew(['install', '--only', 'crew']);
    assert.equal(back.code, 0, back.all);
    assert.deepEqual(m.mutatingCalls(), ['plugin marketplace remove crew', `plugin marketplace add ${DEFAULT_SOURCE}`, 'plugin install crew@crew --scope user']);
    assert.match(m.line(back, 'crew'), /re-pinned from /);
  });

  test('a failed dependency is reported and fails the run; the rest still install', () => {
    const m = machine({ state: { failures: [{ match: 'plugin install superpowers', message: '✘ Failed to install plugin "superpowers@claude-plugins-official": network down' }] } });
    const r = m.crew(['install']);
    assert.equal(r.code, 1, r.all);
    assert.match(m.line(r, 'superpowers'), /^superpowers: failed: .*network down/);
    assert.match(m.line(r, 'mattpocock-skills'), /installed/);
    assert.match(r.lines.at(-1), /^Finished with failures/);
    assert.ok(!m.crewState().plugins['superpowers@claude-plugins-official']);
  });

  test('an unreachable crew source fails with an access hint', () => {
    const m = machine({ state: { marketplaces: [OFFICIAL_MARKETPLACE], unreachable: [DEFAULT_SOURCE] } });
    const r = m.crew(['install', '--only', 'crew']);
    assert.equal(r.code, 1);
    assert.match(m.line(r, 'crew'), /failed: .*gh auth setup-git/);
    assert.ok(!m.mutatingCalls().includes('plugin install crew@crew --scope user'));
  });

  test('preflight fails fast: old Claude Code, or claude missing from PATH', () => {
    const old = machine({ state: { version: '2.0.9' } });
    const r = old.crew(['install']);
    assert.equal(r.code, 1);
    assert.match(r.stdout, /preflight failed: Claude Code 2\.0\.9 is too old; crew needs 2\.1\.0/);
    assert.deepEqual(old.mutatingCalls(), []);
    assert.deepEqual(old.calls(), [['--version']]);

    const none = machine();
    const r2 = none.crew(['install'], { PATH: none.pathWithoutClaude });
    assert.equal(r2.code, 1);
    assert.match(r2.stdout, /preflight failed: claude is not on PATH/);
  });

  test('requiresBinary: hint when the binary is missing, quiet when it is on PATH, never installs it', () => {
    const [found, missing] = EXTRAS.filter((x) => x.requiresBinary);
    assert.ok(found && missing, 'expects two extras with requiresBinary');
    const binDir = mkdtempSync(join(tmpdir(), 'crew-bin-'));
    try {
      stubBinary(binDir, found.requiresBinary.command);
      const m = machine({ ...THIS_MAC, extraPath: [binDir] });
      const r = m.crew(['install']);
      assert.equal(r.code, 0, r.all);
      assert.ok(!m.line(r, found.id).includes('not on PATH'), m.line(r, found.id));
      if (!which(missing.requiresBinary.command, m.env)) {
        assert.ok(m.line(r, missing.id).includes(`${missing.requiresBinary.command} not on PATH`), m.line(r, missing.id));
        assert.ok(m.line(r, missing.id).includes(missing.requiresBinary.hint));
      }
      assert.ok(!m.mutatingCalls().some((c) => /npm|pipx/.test(c)));
    } finally {
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  test('a duplicate (plugin and loose skills) is warned about, not changed', () => {
    const m = machine({
      state: { marketplaces: [OFFICIAL_MARKETPLACE], plugins: [{ id: 'superpowers@claude-plugins-official', version: '7.0.0', scope: 'user', enabled: true }] },
      looseSkills: LOOSE_SUPERPOWERS,
    });
    const r = m.crew(['install', '--only', 'superpowers']);
    assert.equal(r.code, 0, r.all);
    assert.match(m.line(r, 'superpowers'), /present: plugin \(7\.0\.0\); warning: duplicate: superpowers@claude-plugins-official and loose skills/);
    assert.deepEqual(m.mutatingCalls(), []);
  });

  test('loose detection needs every detect.looseSkills folder', () => {
    const m = machine({ state: { marketplaces: [OFFICIAL_MARKETPLACE] }, looseSkills: ['systematic-debugging', ...LOOSE_FRONTEND] });
    const r = m.crew(['install', '--only', 'superpowers,frontend-design']);
    assert.equal(r.code, 0, r.all);
    assert.match(m.line(r, 'superpowers'), /installed/);
    assert.equal(m.line(r, 'frontend-design'), 'frontend-design: present: loose');
  });
});

describe('update', () => {
  test('a new ref re-pins crew with remove + add + install, and updates crew-installed plugins', () => {
    const m = machine({
      state: { marketplaces: [OFFICIAL_MARKETPLACE], plugins: [{ id: 'typescript-lsp@claude-plugins-official', version: '1.0.0', scope: 'user', enabled: true }] },
    });
    assert.equal(m.crew(['install']).code, 0);
    m.editFake((s) => {
      s.catalog[OFFICIAL].superpowers = '7.1.0';
      s.catalog[OFFICIAL]['typescript-lsp'] = '1.1.0';
    });
    m.clearCalls();
    const next = `${OWNER_REPO}#v1.1.0`;
    const r = m.crew(['update', '--source', next]);
    assert.equal(r.code, 0, r.all);
    const calls = m.mutatingCalls();
    const i = calls.indexOf('plugin marketplace remove crew');
    assert.ok(i >= 0, calls.join('\n'));
    assert.deepEqual(calls.slice(i, i + 3), ['plugin marketplace remove crew', `plugin marketplace add ${next}`, 'plugin install crew@crew --scope user']);
    assert.match(m.line(r, 'crew'), /^crew: installed \(1\.1\.0 from .*re-pinned from .*#v1\.0\.0/);
    assert.equal(m.fake().plugins.find((p) => p.id === 'crew@crew').version, '1.1.0');
    assert.equal(m.crewState().crew.source, next);

    // Plugins crew installed get `claude plugin update`; the user's own typescript-lsp does not.
    assert.ok(calls.includes(`plugin marketplace update ${OFFICIAL}`));
    assert.ok(calls.includes('plugin update superpowers@claude-plugins-official --scope user'));
    assert.ok(!calls.some((c) => c.startsWith('plugin update typescript-lsp')));
    assert.equal(m.line(r, 'superpowers'), 'superpowers: updated (7.0.0 -> 7.1.0)');
    assert.match(m.line(r, 'mattpocock-skills'), /present: plugin \(1\.3\.1\); up to date/);
    assert.match(m.line(r, 'typescript-lsp'), /present: plugin \(1\.0\.0\)/);
    assert.equal(m.fake().plugins.find((p) => p.id === 'typescript-lsp@claude-plugins-official').version, '1.0.0');
  });

  test('update with the same source changes nothing for crew', () => {
    const m = machine(THIS_MAC);
    assert.equal(m.crew(['install']).code, 0);
    m.clearCalls();
    const r = m.crew(['update']);
    assert.equal(r.code, 0, r.all);
    assert.ok(!m.mutatingCalls().some((c) => c.startsWith('plugin marketplace add') || c.startsWith('plugin install') || c.includes('remove')));
    assert.match(m.line(r, 'crew'), /present: plugin/);
  });

  test('update --dry-run runs nothing', () => {
    const m = machine();
    assert.equal(m.crew(['install']).code, 0);
    m.clearCalls();
    const r = m.crew(['update', '--dry-run', '--source', `${OWNER_REPO}#v1.1.0`]);
    assert.equal(r.code, 0, r.all);
    assert.deepEqual(m.mutatingCalls(), []);
    assert.ok(r.lines.includes('$ claude plugin marketplace remove crew'));
    assert.ok(r.lines.includes(`$ claude plugin marketplace add ${OWNER_REPO}#v1.1.0`));
  });
});

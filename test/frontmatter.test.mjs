import assert from 'node:assert/strict';
import { test } from 'node:test';
import { patchFrontmatter, readKey, splitFrontmatter } from '../lib/frontmatter.mjs';
import { patchSkill } from '../lib/upstream.mjs';

const skill = `---
name: to-spec
description: "Turn the conversation into a spec: no interview."
disable-model-invocation: true
metadata:
  credits:
    author: someone
---

Body line one.
---
Body keeps its own rules.
`;

test('splitFrontmatter keeps the body byte for byte', () => {
  const { body } = splitFrontmatter(skill);
  assert.equal(body, '\nBody line one.\n---\nBody keeps its own rules.\n');
});

test('readKey reads quoted and plain values', () => {
  const { frontmatter } = splitFrontmatter(skill);
  assert.equal(readKey(frontmatter, 'description'), 'Turn the conversation into a spec: no interview.');
  assert.equal(readKey(frontmatter, 'name'), 'to-spec');
  assert.equal(readKey(frontmatter, 'missing'), undefined);
});

test('patchFrontmatter removes, sets and adds keys; nested blocks survive', () => {
  const { frontmatter } = splitFrontmatter(skill);
  const out = patchFrontmatter(frontmatter, {
    remove: ['disable-model-invocation'],
    set: { description: 'New: text' },
    setIfAbsent: { license: 'MIT', name: 'ignored' },
  });
  assert.equal(out, 'name: to-spec\ndescription: "New: text"\nmetadata:\n  credits:\n    author: someone\nlicense: MIT\n');
});

test('patchSkill prefixes the upstream description and leaves the body alone', () => {
  const out = patchSkill(skill, { prefix: 'Crew only: ', license: 'MIT' });
  const { frontmatter, body } = splitFrontmatter(out);
  assert.equal(readKey(frontmatter, 'description'), 'Crew only: Turn the conversation into a spec: no interview.');
  assert.equal(readKey(frontmatter, 'disable-model-invocation'), undefined);
  assert.equal(body, splitFrontmatter(skill).body);
});

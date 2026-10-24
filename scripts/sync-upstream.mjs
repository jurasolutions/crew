#!/usr/bin/env node
// Maintainer tool for vendor/. Usage:
//   node scripts/sync-upstream.mjs check                 verify vendor/ == upstream@pin + patch (exit 1 if not)
//   node scripts/sync-upstream.mjs sync [--only <src>]   write vendor/ from vendor/UPSTREAM.json
//   node scripts/sync-upstream.mjs diff <src> <ref>      preview moving <src> to <ref> (tag, branch or SHA)
//   node scripts/sync-upstream.mjs latest                newest upstream release per source
// Add --json to any command for machine-readable output (used by the skill scout).

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, diffTo, loadManifest, sourceStatus, sync } from '../lib/upstream.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const json = args.includes('--json');
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const positional = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--only'));
const print = (value, text) => console.log(json ? JSON.stringify(value, null, 2) : text);

switch (positional[0]) {
  case 'check': {
    const r = check(root);
    print(r, r.ok ? 'vendor/ matches upstream at the pinned commits.' : r.problems.map((p) => `${p.problem}: ${p.path}`).join('\n'));
    process.exitCode = r.ok ? 0 : 1;
    break;
  }
  case 'sync': {
    const r = sync(root, { onlySource: flag('--only') });
    print(r, `wrote ${r.written} files from ${Object.entries(r.commits).map(([k, v]) => `${k}@${v.slice(0, 7)}`).join(', ')}`);
    break;
  }
  case 'diff': {
    const [, source, ref] = positional;
    if (!source || !ref) throw new Error('usage: diff <source> <ref>');
    const r = diffTo(root, source, ref);
    print(r, `${source}: ${r.fromCommit.slice(0, 7)} -> ${r.toCommit.slice(0, 7)}\n${r.stat || '(no changes)'}\n\n${r.diff}`);
    break;
  }
  case 'latest': {
    const manifest = loadManifest(root);
    const rows = Object.entries(manifest.sources).map(([id, src]) => ({ id, ...sourceStatus(src) }));
    print(rows, rows.map((r) => `${r.id}: ${r.status} (pinned ${r.pinnedVersion ?? ''} ${r.pinnedCommit.slice(0, 7)}; latest ${r.latestTag ?? '-'}; head ${r.head.slice(0, 7)})`).join('\n'));
    break;
  }
  default:
    console.error('usage: sync-upstream.mjs check | sync [--only <src>] | diff <src> <ref> | latest  [--json]');
    process.exitCode = 2;
}

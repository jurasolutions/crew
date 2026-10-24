#!/usr/bin/env node
// Runs every test/**/*.test.mjs with node's test runner. A script rather than a glob because
// Node 20 doesn't expand test globs itself and Windows shells don't expand them either.
// Extra args pass through (e.g. --test-only). The e2e run lives in scripts/e2e.mjs, outside test/.

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const found = [];
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (name === 'fixtures' || name === 'node_modules') continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.test.mjs')) found.push(relative(root, p));
  }
};
walk(join(root, 'test'));
found.sort();

const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...process.argv.slice(2), ...found], { cwd: root, stdio: 'inherit' });
process.exitCode = r.status ?? 1;

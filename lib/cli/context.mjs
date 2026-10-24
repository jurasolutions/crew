// Everything a command needs: the package, both registries, the config dir, the crew source,
// output, and a runner for external commands.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunner } from './exec.mjs';
import { defaultSource, parseSource } from './source.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MIN_CLAUDE = '2.1.0';
export const OFFICIAL = 'claude-plugins-official';
export const CREW_MARKETPLACE = 'crew';
export const CREW_PLUGIN = 'crew@crew';

export class UsageError extends Error {}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function createContext({ flags = {}, env = process.env, stdout = process.stdout, stderr = process.stderr, root = ROOT } = {}) {
  const pkg = readJson(join(root, 'package.json'));
  const deps = readJson(join(root, 'registry', 'dependencies.json'));
  const extras = readJson(join(root, 'registry', 'extras.json'));
  const configDir = env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  const sourceSpec = flags.source ?? (env.CREW_SOURCE || defaultSource(pkg));
  let source;
  try {
    source = parseSource(sourceSpec);
  } catch (e) {
    throw new UsageError(e.message);
  }
  const out = {
    line: (s = '') => stdout.write(`${s}\n`),
    error: (s = '') => stderr.write(`${s}\n`),
  };
  // In --json mode the command prints one JSON document; nothing else goes to stdout.
  const runner = createRunner({ dryRun: !!flags.dryRun, env, print: flags.json ? () => {} : out.line });
  return {
    root, pkg, deps, extras, configDir, source, flags, env, out, runner,
    dryRun: !!flags.dryRun,
    claude: (args, opts) => runner.exec('claude', args, opts),
    git: (args, opts) => runner.exec('git', args, opts),
  };
}

// The registry items this run covers, honouring --only and --no-extras.
export function select(ctx) {
  const all = [
    ...(ctx.deps.dependencies ?? []).map((d) => ({ ...d, group: 'dependency' })),
    ...(ctx.extras.extras ?? []).map((x) => ({ ...x, group: 'extra', required: false })),
  ];
  const only = ctx.flags.only;
  if (only) {
    const known = ['crew', ...all.map((i) => i.id)];
    for (const id of only) {
      if (!known.includes(id)) throw new UsageError(`unknown --only id "${id}". Known ids: ${known.join(', ')}`);
    }
  }
  const items = all.filter((i) => (!only || only.includes(i.id)) && !(i.group === 'extra' && ctx.flags.noExtras));
  return { crew: !only || only.includes('crew'), items };
}

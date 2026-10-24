// Test harness: a throwaway machine with the fake `claude` first on PATH, a temp
// CLAUDE_CONFIG_DIR, and helpers to run bin/crew.mjs and read what it did.

import { spawnSync } from 'node:child_process';
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { which } from '../../../lib/cli/exec.mjs';
import { defaultSource } from '../../../lib/cli/source.mjs';

export const FAKE_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(FAKE_DIR, '..', '..', '..');
export const BIN = join(ROOT, 'bin', 'crew.mjs');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const PKG = readJson(join(ROOT, 'package.json'));
export const DEPS = readJson(join(ROOT, 'registry', 'dependencies.json')).dependencies;
export const EXTRAS = readJson(join(ROOT, 'registry', 'extras.json')).extras;
export const DEFAULT_SOURCE = defaultSource(PKG);
export const OFFICIAL = 'claude-plugins-official';

// What the fake official marketplace serves.
export const OFFICIAL_CATALOG = {
  superpowers: '7.0.0',
  'mattpocock-skills': '1.3.1',
  'frontend-design': '1.0.0',
  'typescript-lsp': '1.0.0',
  'pyright-lsp': '1.0.0',
  playwright: '0.0.1',
  cloudflare: '1.0.0',
};

export const OFFICIAL_MARKETPLACE = { name: OFFICIAL, source: 'github', repo: 'anthropics/claude-plugins-official' };

// The loose superpowers copy and the loose frontend-design folder.
export const LOOSE_SUPERPOWERS = [
  'brainstorming', 'dispatching-parallel-agents', 'executing-plans', 'finishing-a-development-branch',
  'receiving-code-review', 'requesting-code-review', 'subagent-driven-development', 'systematic-debugging',
  'test-driven-development', 'using-git-worktrees', 'using-superpowers', 'verification-before-completion',
  'writing-plans', 'writing-skills',
];
export const LOOSE_FRONTEND = ['frontend-design'];

// The machine this was written on: mattpocock via claude.ai sync, superpowers and
// frontend-design as loose skills, the official marketplace known, nothing CLI-installed.
export const THIS_MAC = {
  state: {
    plugins: [{ id: 'mattpocock-skills@synced', version: '1.2.3', scope: 'synced', enabled: true, installPath: '/fake/synced/mattpocock' }],
    marketplaces: [OFFICIAL_MARKETPLACE],
  },
  looseSkills: [...LOOSE_SUPERPOWERS, ...LOOSE_FRONTEND],
};

const MUTATING = [
  /^plugin marketplace (add|remove|rm|update)\b/,
  /^plugin (install|i|uninstall|remove|update|enable|disable)\b/,
  /^mcp (add|add-json|remove)\b/,
];
export const isMutating = (argv) => MUTATING.some((re) => re.test(argv.join(' ')));

export const mcpAddArgs = (x) => {
  const args = x.args ?? [];
  const cmd = process.platform === 'win32' && /^(npx|npm|pnpm|yarn|bunx)$/i.test(x.command)
    ? ['cmd', '/c', x.command, ...args]
    : [x.command, ...args];
  return `mcp add --scope user ${x.name} -- ${cmd.join(' ')}`;
};

// Write an executable stub called `name` into `dir` (for requiresBinary checks).
export function stubBinary(dir, name) {
  mkdirSync(dir, { recursive: true });
  if (process.platform === 'win32') writeFileSync(join(dir, `${name}.cmd`), '@echo off\n');
  else {
    writeFileSync(join(dir, name), '#!/bin/sh\nexit 0\n');
    chmodSync(join(dir, name), 0o755);
  }
}

export function writeLooseSkill(config, name) {
  mkdirSync(join(config, 'skills', name), { recursive: true });
  writeFileSync(join(config, 'skills', name, 'SKILL.md'), `---\nname: ${name}\ndescription: loose copy\n---\nBody of ${name}.\n`);
}

export function fakeMachine({ state = {}, looseSkills = [], extraPath = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'crew-cli-'));
  const config = join(dir, 'config');
  mkdirSync(config, { recursive: true });
  for (const s of looseSkills) writeLooseSkill(config, s);

  const statePath = join(dir, 'fake-claude-state.json');
  const logPath = join(dir, 'fake-claude-calls.log');
  writeFileSync(statePath, JSON.stringify({
    version: '2.1.286',
    plugins: [],
    marketplaces: [],
    mcpServers: {},
    ...state,
    catalog: { [OFFICIAL]: { ...OFFICIAL_CATALOG }, ...(state.catalog ?? {}) },
  }, null, 2));
  if (process.platform !== 'win32') chmodSync(join(FAKE_DIR, 'claude'), 0o755);

  const git = which('git');
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!/^(path|claude_config_dir|crew_source|fake_claude_\w+|node_test_context)$/i.test(k)) env[k] = v;
  }
  const pathFor = (dirs) => [...dirs, dirname(process.execPath), git ? dirname(git) : null].filter(Boolean).join(delimiter);
  env.PATH = pathFor([FAKE_DIR, ...extraPath]);
  env.CLAUDE_CONFIG_DIR = config;
  env.FAKE_CLAUDE_STATE = statePath;
  env.FAKE_CLAUDE_LOG = logPath;

  const m = {
    dir, config, env, statePath, logPath,
    pathWithoutClaude: pathFor(extraPath),
    crew(args, extraEnv = {}) {
      const r = spawnSync(process.execPath, [BIN, ...args], { env: { ...env, ...extraEnv }, encoding: 'utf8' });
      const stdout = r.stdout ?? '';
      return { code: r.status, stdout, stderr: r.stderr ?? '', lines: stdout.split(/\r?\n/).filter(Boolean), all: `${stdout}\n${r.stderr ?? ''}` };
    },
    calls: () => (existsSync(logPath) ? readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []),
    mutatingCalls: () => m.calls().filter(isMutating).map((a) => a.join(' ')),
    clearCalls: () => rmSync(logPath, { force: true }),
    fake: () => readJson(statePath),
    editFake(fn) {
      const s = readJson(statePath);
      fn(s);
      writeFileSync(statePath, JSON.stringify(s, null, 2));
    },
    crewState: () => {
      const p = join(config, 'crew', 'state.json');
      return existsSync(p) ? readJson(p) : null;
    },
    line: (r, id) => r.lines.find((l) => l.startsWith(`${id}: `)),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
  return m;
}

// A local crew checkout for --source tests: a marketplace named crew with one plugin, crew.
export function localCrewSource(parent, version = PKG.version) {
  const dir = join(parent, 'crew-checkout');
  mkdirSync(join(dir, '.claude-plugin'), { recursive: true });
  writeFileSync(join(dir, '.claude-plugin', 'marketplace.json'), JSON.stringify({ name: 'crew', owner: { name: 'test' }, plugins: [{ name: 'crew', source: './' }] }));
  writeFileSync(join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'crew', version }));
  return dir;
}

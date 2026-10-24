// Vendoring: fetch upstream skill sources at a pinned commit, apply the frontmatter-only
// patch, and compare or write the result under vendor/. Shared by scripts/sync-upstream.mjs
// and `crew outdated`.

import { execFileSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { joinFrontmatter, patchFrontmatter, readKey, splitFrontmatter } from './frontmatter.mjs';

const SHA = /^[0-9a-f]{40}$/;

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

export function loadManifest(root) {
  return JSON.parse(readFileSync(join(root, 'vendor', 'UPSTREAM.json'), 'utf8'));
}

const cacheRoot = () => process.env.CREW_UPSTREAM_CACHE || join(tmpdir(), 'crew-upstream');

// Fetch `repo` at `ref` (full SHA, tag or branch) into a scratch checkout. Never executes anything from it.
export function fetchAt(repo, ref) {
  const dir = join(cacheRoot(), `${repo.replace('/', '__')}@${ref.replace(/[^\w.-]/g, '_')}`);
  const marker = join(dir, '.crew-commit');
  if (SHA.test(ref) && existsSync(marker)) return { dir, commit: readFileSync(marker, 'utf8').trim() };
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  git(['init', '-q', dir]);
  const url = `https://github.com/${repo}.git`;
  const candidates = SHA.test(ref) ? [ref] : [`refs/tags/${ref}`, `refs/heads/${ref}`];
  let fetched = false;
  for (const c of candidates) {
    try { git(['-C', dir, 'fetch', '-q', '--depth', '1', url, c]); fetched = true; break; } catch { /* next */ }
  }
  if (!fetched) throw new Error(`could not fetch ${repo} at ${ref}`);
  git(['-C', dir, '-c', 'advice.detachedHead=false', 'checkout', '-q', 'FETCH_HEAD']);
  const commit = git(['-C', dir, 'rev-parse', 'HEAD']);
  writeFileSync(marker, commit);
  return { dir, commit };
}

function walk(base, exclude = []) {
  const out = [];
  const visit = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const rel = relative(base, p).split(sep).join('/');
      if (name === '.git' || name === '.crew-commit') continue;
      if (exclude.includes(rel.split('/')[0]) && d === base) continue;
      if (statSync(p).isDirectory()) visit(p);
      else out.push(rel);
    }
  };
  visit(base);
  return out.sort();
}

export function patchSkill(text, { description, prefix, license }) {
  const { frontmatter, body } = splitFrontmatter(text);
  const upstreamDescription = readKey(frontmatter, 'description') ?? '';
  const fm = patchFrontmatter(frontmatter, {
    remove: ['disable-model-invocation'],
    set: { description: prefix + (description ?? upstreamDescription) },
    setIfAbsent: license ? { license } : {},
  });
  return joinFrontmatter(fm, body);
}

// Every file vendoring should produce, as a Map of repo-relative path -> Buffer.
// `overrides` maps source id -> ref, to preview an upgrade without editing the manifest.
export function expectedFiles(manifest, { overrides = {}, onlySource } = {}) {
  const files = new Map();
  const fetched = {};
  const sourceDir = (id) => {
    const src = manifest.sources[id];
    if (!src) throw new Error(`unknown source ${id}`);
    fetched[id] ??= fetchAt(src.repo, overrides[id] ?? src.commit);
    return fetched[id].dir;
  };
  const wanted = (id) => !onlySource || onlySource === id;

  for (const id of Object.keys(manifest.sources)) {
    const src = manifest.sources[id];
    if (!wanted(id) || !src.licenseFile) continue;
    if (!manifest.skills.some((s) => s.source === id) && !(manifest.files ?? []).some((f) => f.source === id)) continue;
    files.set(`vendor/${id}/LICENSE`, readFileSync(join(sourceDir(id), src.licenseFile)));
  }
  for (const skill of manifest.skills) {
    if (!wanted(skill.source)) continue;
    const src = manifest.sources[skill.source];
    const base = join(sourceDir(skill.source), skill.path);
    for (const rel of walk(base, [...(manifest.exclude ?? []), ...(skill.exclude ?? [])])) {
      let content = readFileSync(join(base, rel));
      if (rel === 'SKILL.md') {
        content = Buffer.from(patchSkill(content.toString('utf8'), {
          description: skill.description,
          prefix: skill.prefix ?? manifest.descriptionPrefix ?? '',
          license: src.license,
        }));
      }
      files.set(`vendor/${skill.source}/${skill.name}/${rel}`, content);
    }
  }
  for (const f of manifest.files ?? []) {
    if (!wanted(f.source)) continue;
    files.set(`vendor/${f.source}/${f.dest}`, readFileSync(join(sourceDir(f.source), f.path)));
  }
  return { files, commits: Object.fromEntries(Object.entries(fetched).map(([k, v]) => [k, v.commit])) };
}

function actualFiles(root, onlySource) {
  const vendor = join(root, 'vendor');
  const out = new Map();
  for (const rel of walk(vendor)) {
    if (rel === 'UPSTREAM.json') continue;
    if (onlySource && !rel.startsWith(`${onlySource}/`)) continue;
    out.set(`vendor/${rel}`, readFileSync(join(vendor, rel)));
  }
  return out;
}

// Compare vendor/ with what the pinned commits produce. Byte for byte.
export function check(root) {
  const manifest = loadManifest(root);
  const { files: expected } = expectedFiles(manifest);
  const actual = actualFiles(root);
  const problems = [];
  for (const [p, buf] of expected) {
    if (!actual.has(p)) problems.push({ path: p, problem: 'missing' });
    else if (!actual.get(p).equals(buf)) problems.push({ path: p, problem: 'differs from upstream + patch' });
  }
  for (const p of actual.keys()) if (!expected.has(p)) problems.push({ path: p, problem: 'not produced by UPSTREAM.json' });
  return { ok: problems.length === 0, problems };
}

// Write vendor/ from the manifest. Removes vendored files the manifest no longer produces.
export function sync(root, { onlySource } = {}) {
  const manifest = loadManifest(root);
  const { files: expected, commits } = expectedFiles(manifest, { onlySource });
  const actual = actualFiles(root, onlySource);
  for (const p of actual.keys()) if (!expected.has(p)) rmSync(join(root, p));
  for (const [p, buf] of expected) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), buf);
  }
  return { written: expected.size, commits };
}

// Preview moving one source to a new ref: returns the stat and full diff against vendor/.
export function diffTo(root, sourceId, ref) {
  const manifest = loadManifest(root);
  const { files, commits } = expectedFiles(manifest, { overrides: { [sourceId]: ref }, onlySource: sourceId });
  const preview = join(cacheRoot(), `preview-${sourceId}-${Date.now()}`);
  for (const [p, buf] of files) {
    mkdirSync(dirname(join(preview, p)), { recursive: true });
    writeFileSync(join(preview, p), buf);
  }
  mkdirSync(join(preview, 'vendor', sourceId), { recursive: true });
  const from = join(root, 'vendor', sourceId);
  const to = join(preview, 'vendor', sourceId);
  const run = (extra) => {
    try {
      return execFileSync('git', ['diff', '--no-index', ...extra, from, to], { encoding: 'utf8' });
    } catch (e) {
      return e.stdout ?? ''; // exit 1 means "differences found"
    }
  };
  return {
    source: sourceId,
    fromCommit: manifest.sources[sourceId].commit,
    toCommit: commits[sourceId],
    stat: run(['--stat']).trim(),
    diff: run([]),
  };
}

const semver = (t) => (/^v?(\d+)\.(\d+)\.(\d+)$/.exec(t) || []).slice(1).map(Number);
const newer = (a, b) => {
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
};

// Latest release tag and default-branch head for a GitHub repo, via `git ls-remote`.
export function latestRelease(repo) {
  const url = `https://github.com/${repo}.git`;
  const tags = new Map();
  for (const line of git(['ls-remote', '--tags', url]).split('\n').filter(Boolean)) {
    const [commit, ref] = line.split('\t');
    const name = ref.replace('refs/tags/', '');
    if (name.endsWith('^{}')) tags.set(name.slice(0, -3), commit); // peeled commit wins
    else if (!tags.has(name)) tags.set(name, commit);
  }
  let best;
  for (const [name, commit] of tags) {
    const v = semver(name);
    if (v.length === 3 && (!best || newer(v, best.v))) best = { name, commit, v };
  }
  const head = git(['ls-remote', url, 'HEAD']).split('\t')[0];
  return { latestTag: best?.name, latestTagCommit: best?.commit, head };
}

// Is a vendored source behind upstream?
export function sourceStatus(src) {
  const r = latestRelease(src.repo);
  const pinned = semver(src.version ?? '');
  const tagNewer = r.latestTag && pinned.length === 3 && newer(semver(r.latestTag), pinned);
  let status = 'current';
  if (tagNewer) status = 'behind';
  else if (src.commit !== r.head && src.commit !== r.latestTagCommit) status = 'head-moved';
  return { repo: src.repo, pinnedVersion: src.version, pinnedCommit: src.commit, ...r, status };
}

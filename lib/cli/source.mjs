// Where the crew marketplace comes from: `owner/repo#ref`, a git URL, or a local directory.

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve, win32 } from 'node:path';

const isWin = process.platform === 'win32';

export function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v ?? '').trim());
  return m ? m.slice(1).map(Number) : null;
}

// -1, 0, 1, or null when either side is not a semver.
export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}

// `owner/repo#v<version>` from package.json `repository`.
export function defaultSource(pkg) {
  const raw = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const m = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(raw ?? '')
    ?? /^(?:github:)?([\w.-]+)\/([\w.-]+)$/.exec(raw ?? '');
  if (!m) throw new Error(`package.json repository.url is not a GitHub repo: ${raw}`);
  return `${m[1]}/${m[2]}#v${pkg.version}`;
}

export function parseSource(spec) {
  const s = String(spec ?? '').trim();
  if (!s) throw new Error('empty --source');
  if (isAbsolute(s) || win32.isAbsolute(s) || s.startsWith('./') || s.startsWith('../') || s.startsWith('.\\') || s.startsWith('..\\')) {
    const path = resolve(s);
    return { kind: 'directory', path, spec: path };
  }
  if (/^(https?:\/\/|ssh:\/\/|git@|git\+)/.test(s)) {
    const [url, ref] = s.split('#');
    return { kind: 'git', url, ref: ref || undefined, spec: s };
  }
  const m = /^([\w.-]+)\/([\w.-]+)(?:#(.+))?$/.exec(s);
  if (!m) throw new Error(`--source must be owner/repo#ref or an absolute path, got: ${s}`);
  return { kind: 'github', repo: `${m[1]}/${m[2]}`, ref: m[3] || undefined, spec: s };
}

const normPath = (p) => {
  let r = resolve(p).replace(/[\\/]+$/, '');
  if (isWin) r = r.toLowerCase();
  return r;
};

// Does a `claude plugin marketplace list --json` entry already point at this source?
export function sourceMatches(entry, src) {
  if (!entry) return false;
  switch (src.kind) {
    case 'directory':
      return entry.source === 'directory' && typeof entry.path === 'string' && normPath(entry.path) === normPath(src.path);
    case 'github':
      return entry.source === 'github'
        && String(entry.repo ?? '').toLowerCase() === src.repo.toLowerCase()
        && (entry.ref ?? '') === (src.ref ?? '');
    case 'git':
      return (entry.url ?? entry.repo) === src.url && (entry.ref ?? '') === (src.ref ?? '');
    default:
      return false;
  }
}

// How an existing marketplace entry reads, for messages.
export function describeEntry(entry) {
  if (!entry) return 'none';
  if (entry.source === 'directory') return entry.path;
  if (entry.source === 'github') return entry.ref ? `${entry.repo}#${entry.ref}` : entry.repo;
  return [entry.url ?? entry.repo ?? entry.source, entry.ref].filter(Boolean).join('#');
}

// The crew plugin version this source should give us: a semver tag names it, a local directory
// declares it in its plugin.json; anything else falls back to this package's version.
export function impliedVersion(src, fallback) {
  if (src.kind === 'directory') {
    const manifest = resolve(src.path, '.claude-plugin', 'plugin.json');
    if (existsSync(manifest)) {
      try {
        const v = JSON.parse(readFileSync(manifest, 'utf8')).version;
        if (v) return v;
      } catch { /* fall back */ }
    }
    return fallback;
  }
  const m = /^v?(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)$/.exec(src.ref ?? '');
  return m ? m[1] : fallback;
}

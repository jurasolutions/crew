// Running external commands (claude, git) the same way on macOS, Linux and native Windows.
// On win32 `claude` is often a `.cmd` shim, which Node only runs through a shell, so there we
// build one safely quoted command line and hand it to cmd.exe. Elsewhere we never use a shell.

import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { delimiter, join } from 'node:path';

const isWin = process.platform === 'win32';

// Quote one argument for cmd.exe + the MSVC argv parser. Plain tokens pass through unchanged.
export function quoteWin(arg) {
  const s = String(arg);
  if (s !== '' && /^[\w@+=:,./\\#~-]+$/.test(s)) return s;
  // Double backslashes that precede a quote (or the closing quote), then escape the quote.
  const escaped = s.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1');
  return `"${escaped}"`;
}

// Human-readable command line, copy-pasteable in sh and cmd for the arguments crew uses.
export function display(cmd, args) {
  return [cmd, ...args].map((a) => (/^[\w@+=:,./\\#~%-]+$/.test(String(a)) ? String(a) : JSON.stringify(String(a)))).join(' ');
}

function pathKey(env) {
  return Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
}

// Is `command` an executable on PATH? Returns its full path or null. Never runs it.
export function which(command, env = process.env) {
  const dirs = String(env[pathKey(env)] ?? '').split(delimiter).filter(Boolean);
  const exts = isWin
    ? ['', ...String(env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)]
    : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const p = join(dir, command + ext);
      try {
        const st = statSync(p);
        if (!st.isFile()) continue;
        if (!isWin && (st.mode & 0o111) === 0) continue;
        return p;
      } catch { /* not here */ }
    }
  }
  return null;
}

// A runner executes commands, or in dry-run mode prints the mutating ones and runs none of them.
// Read-only inventory commands (`mutating: false`) still run in dry-run, so the plan is accurate.
export function createRunner({ dryRun = false, env = process.env, print = () => {} } = {}) {
  const planned = [];

  function exec(cmd, args, { mutating = false, timeout = 10 * 60 * 1000 } = {}) {
    const line = display(cmd, args);
    if (mutating) planned.push(line);
    if (mutating && dryRun) {
      print(`$ ${line}`);
      return { code: 0, stdout: '', stderr: '', dryRun: true, line };
    }
    const opts = {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
      timeout,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    };
    const r = isWin
      ? spawnSync([cmd, ...args].map(quoteWin).join(' '), { ...opts, shell: true })
      : spawnSync(cmd, args, opts);
    const stdout = r.stdout ?? '';
    const stderr = r.stderr ?? '';
    const notFound = r.error?.code === 'ENOENT' || (isWin && r.status !== 0 && /is not recognized as an internal or external command/i.test(stderr));
    const timedOut = r.error?.code === 'ETIMEDOUT';
    let code = r.status;
    if (code === null || code === undefined) code = notFound ? 127 : 1;
    if (notFound) code = 127;
    return { code, stdout, stderr, error: r.error, notFound, timedOut, line };
  }

  return { exec, planned, dryRun };
}

// The most useful one-line reason from a failed command's output.
export function reason(result) {
  if (result.notFound) return `${result.line.split(' ')[0]} not found on PATH`;
  if (result.timedOut) return 'timed out';
  const lines = `${result.stderr}\n${result.stdout}`
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s✘✔×!]+/u, '').trim())
    .filter(Boolean);
  const pick = lines.find((l) => /fail|error|not found|denied|refus|differs|could not|cannot/i.test(l)) ?? lines[0];
  return (pick ?? `exit ${result.code}`).slice(0, 300);
}

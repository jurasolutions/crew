// Argument parsing and dispatch for the `crew` CLI.

import { createContext, UsageError } from './context.mjs';
import { doctor } from './doctor.mjs';
import { install } from './install.mjs';
import { outdated } from './outdated.mjs';
import { uninstall } from './uninstall.mjs';

export const USAGE = `Usage: crew <command> [options]

Commands:
  install              install the crew plugin and every missing dependency and extra
  update               install, re-pin crew to this version, update plugins crew installed
  doctor               report what is present, how, and what is off (exit 1 if crew or a
                       required dependency is missing)
  outdated             compare every pin with upstream (network); report only
  uninstall            remove crew and its marketplace; dependencies stay

Options:
  --dry-run            print the commands that would change anything; run none of them
  --only <id>          limit to one item (repeatable, or comma-separated): crew, a dependency
                       id or an extra id
  --no-extras          skip registry/extras.json
  --source <spec>      where the crew marketplace comes from: owner/repo#ref or an absolute
                       path (also CREW_SOURCE; default: this package's repo at v<version>)
  --with-deps          uninstall: also remove what crew installed (recorded in
                       <config>/crew/state.json)
  --json               doctor, outdated: machine-readable output
  -h, --help           show this help
  -v, --version        print the crew version

Config dir: $CLAUDE_CONFIG_DIR, or ~/.claude.`;

export function parseArgs(argv) {
  const flags = { dryRun: false, only: null, noExtras: false, source: undefined, json: false, withDeps: false, help: false, version: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eq = a.startsWith('--') ? a.indexOf('=') : -1;
    const name = eq > 0 ? a.slice(0, eq) : a;
    const inline = eq > 0 ? a.slice(eq + 1) : undefined;
    const value = () => {
      if (inline !== undefined) return inline;
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new UsageError(`${name} needs a value`);
      return v;
    };
    const bare = () => {
      if (inline !== undefined) throw new UsageError(`${name} takes no value`);
    };
    switch (name) {
      case '--dry-run': bare(); flags.dryRun = true; break;
      case '--no-extras': bare(); flags.noExtras = true; break;
      case '--json': bare(); flags.json = true; break;
      case '--with-deps': bare(); flags.withDeps = true; break;
      case '--only': (flags.only ??= []).push(...value().split(',').map((s) => s.trim()).filter(Boolean)); break;
      case '--source': flags.source = value(); break;
      case '-h': case '--help': flags.help = true; break;
      case '-v': case '--version': flags.version = true; break;
      default:
        if (a.startsWith('-')) throw new UsageError(`unknown option ${a}`);
        positional.push(a);
    }
  }
  return { command: positional[0], extra: positional.slice(1), flags };
}

const COMMANDS = {
  install: (ctx) => install(ctx),
  update: (ctx) => install(ctx, { update: true }),
  doctor: (ctx) => doctor(ctx),
  outdated: (ctx) => outdated(ctx),
  uninstall: (ctx) => uninstall(ctx),
};

export async function main(argv, { env = process.env, stdout = process.stdout, stderr = process.stderr } = {}) {
  const usageError = (msg) => {
    stderr.write(`crew: ${msg}\n\n${USAGE}\n`);
    return 2;
  };
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    if (e instanceof UsageError) return usageError(e.message);
    throw e;
  }
  const { command, extra, flags } = parsed;
  if (flags.help) {
    stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (flags.version) {
    const ctx = createContext({ flags, env, stdout, stderr });
    stdout.write(`${ctx.pkg.version}\n`);
    return 0;
  }
  if (!command) return usageError('missing command');
  if (!Object.hasOwn(COMMANDS, command)) return usageError(`unknown command "${command}"`);
  if (extra.length) return usageError(`unexpected argument "${extra[0]}"`);
  if (flags.json && !['doctor', 'outdated'].includes(command)) return usageError('--json works with doctor and outdated');
  if (flags.withDeps && command !== 'uninstall') return usageError('--with-deps works with uninstall');

  try {
    const ctx = createContext({ flags, env, stdout, stderr });
    return await COMMANDS[command](ctx);
  } catch (e) {
    if (e instanceof UsageError) return usageError(e.message);
    stderr.write(`crew ${command}: ${e.message}\n`);
    return 1;
  }
}

// <config>/crew/state.json: the record of what crew itself installed. `uninstall --with-deps`
// removes only what is listed here; anything else on the machine is never touched.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const statePath = (configDir) => join(configDir, 'crew', 'state.json');

export function emptyState() {
  return { schema: 1, crew: null, plugins: {}, mcpServers: {}, marketplaces: {} };
}

export function loadState(configDir) {
  const p = statePath(configDir);
  if (!existsSync(p)) return emptyState();
  try {
    const s = JSON.parse(readFileSync(p, 'utf8'));
    return { ...emptyState(), ...s, plugins: s.plugins ?? {}, mcpServers: s.mcpServers ?? {}, marketplaces: s.marketplaces ?? {} };
  } catch (e) {
    throw new Error(`could not read ${p}: ${e.message}`);
  }
}

export function saveState(configDir, state) {
  const p = statePath(configDir);
  mkdirSync(dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tmp, p);
}

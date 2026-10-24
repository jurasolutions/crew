#!/usr/bin/env node
// crew: install the crew plugin and its dependencies into Claude Code.
// Zero dependencies; see lib/cli/ and `crew --help`.

import { main } from '../lib/cli/main.mjs';

main(process.argv.slice(2)).then(
  (code) => { process.exitCode = code; },
  (e) => {
    process.stderr.write(`crew: ${e?.stack ?? e}\n`);
    process.exitCode = 1;
  },
);

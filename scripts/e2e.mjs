#!/usr/bin/env node
// End-to-end acceptance run (PRD §2 criterion 5). Not part of `npm test`: it spends real model usage.
//
//   node scripts/e2e.mjs [--model sonnet] [--max-turns 40] [--out <dir>] [--until G1]
//
// Copies fixtures/e2e-repo into a fresh git repo, then drives `/crew:deliver` through
// `claude -p` turns, answering each stop the way a user would. Records, per turn, the
// conductor's message and the crew branches, then checks the artifacts and the gates.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const crew = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const model = opt('--model', 'sonnet');
const maxTurns = Number(opt('--max-turns', '40'));
const until = opt('--until'); // stop once this gate is asked, before answering (e.g. G1)
const out = opt('--out', join(tmpdir(), `crew-e2e-${Date.now()}`));
const repo = join(out, 'repo');

const TASK = 'Let people split a bill unevenly by percentage (for example 50/30/20), with a rounding rule so the shares always add up to the exact total, and expose it on the CLI.';

function sh(cmd, cmdArgs, cwd = repo) {
  return spawnSync(cmd, cmdArgs, { cwd, encoding: 'utf8' }).stdout?.trim() ?? '';
}

mkdirSync(out, { recursive: true });
cpSync(join(crew, 'fixtures', 'e2e-repo'), repo, { recursive: true });
sh('git', ['init', '-q', '-b', 'main']);
sh('git', ['add', '-A']);
sh('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', 'commit', '-qm', 'initial']);

const transcript = [];
const turns = [];
let session;
let reply = `/crew:deliver ${TASK}`;
let done = false;

// The simulated user answers only the gate that comes next, and only when the end of the
// conductor's message asks for it as a question (a gate merely mentioned is not a question),
// judged from the end of the message, where it asks. Intake messages list every gate ahead.
let phase = 'G0';
const answered = []; // { gate, turn }: the turn whose message asked for it
function chooseReply(text) {
  const tail = text.slice(-1500).toLowerCase();
  const asks = (re) => re.test(tail);
  const turn = turns.length - 1;
  const recommend = 'Your recommendation is right; take it, and take your recommendations for any remaining questions like it.';
  switch (phase) {
    case 'G0':
      answered.push({ gate: 'G0', turn });
      phase = 'G1';
      return 'G0: confirmed. Go with your recommended size and route, and yes to your other questions.';
    case 'G1':
      if (asks(/\bg1\b[^\n]{0,160}\?|requirements (are )?ready\?/)) {
        answered.push({ gate: 'G1', turn });
        phase = 'G2';
        return 'G1: yes, the requirements are ready.';
      }
      return `${recommend} Tell me when the requirements are ready (G1).`;
    case 'G2':
      if (asks(/\bg2\b[^\n]{0,200}\?|sign[- ]?off[^\n]{0,160}\?/)) {
        answered.push({ gate: 'G2', turn });
        phase = 'build';
        return 'G2: the spec is signed off. Proceed to build.';
      }
      return `${recommend} Carry on to the spec reviews and G2.`;
    default:
      if (asks(/\bg3\b/)) { answered.push({ gate: 'G3', turn }); return 'G3: the tickets are approved.'; }
      if (asks(/\bg4\b|merge locally|open a pr|keep the branch|discard/)) {
        answered.push({ gate: 'G4', turn });
        done = true;
        return 'G4: keep the branch. Do not merge or open a PR. Close the run.';
      }
      return `${recommend} Carry on.`;
  }
}

for (let n = 0; n < maxTurns && !done; n++) {
  const cliArgs = [
    '-p', reply,
    '--plugin-dir', crew,
    '--model', model,
    '--output-format', 'json',
    '--permission-mode', 'acceptEdits',
    '--allowedTools', 'Read,Write,Edit,Glob,Grep,Bash,Agent,Skill,TodoWrite,WebFetch,WebSearch',
  ];
  if (session) cliArgs.push('--resume', session);
  const started = Date.now();
  const r = spawnSync('claude', cliArgs, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60 * 60 * 1000 });
  let result;
  try { result = JSON.parse(r.stdout); } catch { result = { result: r.stdout || r.stderr, is_error: true }; }
  session = result.session_id ?? session;
  const text = String(result.result ?? '');
  const branches = sh('git', ['branch', '--list', 'crew/*', '--format=%(refname:short)']).split('\n').filter(Boolean);
  const merges = Number(sh('git', ['rev-list', '--merges', '--count', '--all']) || 0);
  turns.push({ n, sent: reply, seconds: Math.round((Date.now() - started) / 1000), cost: result.total_cost_usd, branches, merges, gates: [...text.matchAll(/\bG[0-4]\b/g)].map((m) => m[0]) });
  transcript.push(`## Turn ${n}\n\n**Sent:** ${reply}\n\n**Conductor:**\n\n${text}\n\n_branches: ${branches.join(', ') || 'none'}_\n`);
  writeFileSync(join(out, 'transcript.md'), transcript.join('\n'));
  console.log(`turn ${n}: ${turns.at(-1).seconds}s, gates ${turns.at(-1).gates.join(',') || '-'}, branches ${branches.length}`);
  if (result.is_error) break;
  reply = chooseReply(text);
  if (until && answered.some((a) => a.gate === until)) break;
}

if (until) {
  const ctx = existsSync(join(repo, 'CONTEXT.md'));
  console.log(`\nstopped at ${until} (turn ${answered.find((a) => a.gate === until)?.turn ?? '-'}): CONTEXT.md ${ctx ? 'present' : 'MISSING'}; gates ${answered.map((a) => a.gate).join(', ')}`);
  process.exit(ctx ? 0 : 1);
}

// Artifact and gate checks.
const scratch = join(repo, '.scratch');
const feature = existsSync(scratch) ? readdirSync(scratch).find((d) => existsSync(join(scratch, d, 'crew-log.md'))) : undefined;
const f = (p) => feature && existsSync(join(scratch, feature, p));
const reviews = feature && existsSync(join(scratch, feature, 'reviews')) ? readdirSync(join(scratch, feature, 'reviews')) : [];
const ticketBranchTurn = turns.findIndex((t) => t.branches.some((b) => /-\d\d-/.test(b)));
const featureBranch = feature ? `crew/${feature}` : undefined;
// Ticket branches are deleted once merged, so count the merges into the feature branch.
const ticketMerges = featureBranch ? Number(sh('git', ['rev-list', '--merges', '--count', featureBranch]) || 0) : 0;
const firstMergeTurn = ticketMerges ? turns.findIndex((t) => t.merges > 0) : -1;
const testsOnFeature = featureBranch && sh('git', ['branch', '--list', featureBranch])
  ? (sh('git', ['checkout', '-q', featureBranch]), spawnSync('npm', ['test'], { cwd: repo, encoding: 'utf8' }).status === 0)
  : false;
const gateTurn = (g) => answered.find((a) => a.gate === g)?.turn ?? -1;
const worktrees = sh('git', ['worktree', 'list']).split('\n').filter((l) => l.includes('.claude/worktrees'));

const checks = {
  'operating card written': existsSync(join(repo, 'docs', 'agents', 'crew.md')),
  'glossary (CONTEXT.md) written': existsSync(join(repo, 'CONTEXT.md')),
  'feature folder with crew-log': Boolean(feature),
  'spec': f('spec.md'),
  'functional review + UAT': reviews.includes('functional.md') && reviews.includes('uat.md'),
  'technical review': reviews.includes('technical.md'),
  'test strategy': reviews.includes('test-strategy.md'),
  'code review(s)': reviews.some((r) => r.startsWith('code-review')),
  'QA report': reviews.some((r) => r.startsWith('qa-')),
  'quality gate': reviews.includes('quality-gate.md'),
  'release package + PR body': reviews.includes('release.md') && reviews.includes('pr-body.md'),
  'tickets built on branches and merged': ticketMerges > 0 || ticketBranchTurn >= 0,
  // state seen after turn N was made during turn N, i.e. before the reply to N was sent
  'no ticket work before G2 sign-off': [ticketBranchTurn, firstMergeTurn].every((t) => t === -1 || (gateTurn('G2') >= 0 && t > gateTurn('G2'))),
  'crew-log has no merge conflict markers': !(feature && /^(<<<<<<<|>>>>>>>)/m.test(readFileSync(join(scratch, feature, 'crew-log.md'), 'utf8'))),
  'feature branch tests pass': testsOnFeature,
  'stopped at G0, G1, G2 and G4, in order': ['G0', 'G1', 'G2', 'G4'].every((g, i, a) => gateTurn(g) >= 0 && (i === 0 || gateTurn(g) > gateTurn(a[i - 1]))),
  'no crew worktrees left': worktrees.length === 0,
  'main untouched': sh('git', ['rev-list', '--count', 'main']) === '1',
};

const cost = turns.reduce((s, t) => s + (t.cost ?? 0), 0);
const report = [
  `# Crew e2e run — ${new Date().toISOString()}`,
  '',
  `Model: ${model} · turns: ${turns.length} · cost: $${cost.toFixed(2)} · feature: ${feature ?? '-'}`,
  '',
  '| Check | Result |',
  '|---|---|',
  ...Object.entries(checks).map(([k, v]) => `| ${k} | ${v ? 'pass' : 'FAIL'} |`),
  '',
  `Gates answered: ${answered.map((a) => `${a.gate}@turn${a.turn}`).join(', ') || 'none'}`,
  `Reviews written: ${reviews.join(', ') || 'none'}`,
  `Transcript: ${join(out, 'transcript.md')}`,
].join('\n');
writeFileSync(join(out, 'report.md'), report);
writeFileSync(join(out, 'turns.json'), JSON.stringify(turns, null, 2));
console.log(`\n${report}`);
process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;

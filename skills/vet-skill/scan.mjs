#!/usr/bin/env node
// vet-skill/scan.mjs: the skill scout's static red-flag scanner (PRD §5.6, vetting step 3).
//
//   node scan.mjs <dir> [--json]
//
// Read-only and inert. It lists <dir>, opens each regular file for reading without following
// links, and matches text. It never executes, imports or requires anything from <dir>, never
// follows a symlink, skips .git/, and leaves files over 5 MB unread. Exit 0 when the scan
// completes (whatever it finds), 2 on a usage error.
//
// `floor` is the lowest rating the scout may give: any high finding makes it High, any medium
// makes it Medium, otherwise Low. Each rule below carries the `why` the scout cites.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const EXCERPT_MAX = 160;
const PER_RULE_FILE_CAP = 50; // findings kept per rule per file; the rest are counted in `omitted`
const WINDOW = 20000; // very long lines are matched in overlapping windows
const RANK = { info: 0, medium: 1, high: 2 };
const SEVERITIES = ['high', 'medium', 'info'];

// Contexts a line or command can be matched in.
const SCRIPTY = ['script', 'hook', 'server'];

/* ------------------------------------------------------------------------------------------ */
/* Shared vocabulary                                                                          */
/* ------------------------------------------------------------------------------------------ */

const SHELLS = String.raw`(?:sudo\s+(?:-\S+\s+)*)?(?:env\s+(?:\w+=\S*\s+)*)?(?:(?:ba|z|da|k|fi|c|tc)?sh|python[23]?(?:\.\d+)?|node|perl|ruby|php|deno|bun|pwsh|powershell)\b`;

const RISKY_EXT = /(?<=[\w-])\.(?:zip|dmg|exe|msi|pkg|appimage|deb|rpm|sh|bash|command|ps1|bat|cmd|scr|jar|7z|rar|tgz|tar(?:\.gz|\.xz|\.bz2)?|gz|xz|vbs|run|bin)(?=$|[\s"'`)\]>,;:!?]|\?)/i;
const DOWNLOAD_VERB = /\b(?:download(?:s|ed|ing)?|fetch|grab|save|curl|wget|iwr|Invoke-WebRequest|Start-BitsTransfer|bitsadmin)\b/i;
const RUN_VERB = /\b(?:run|runs|execute|launch|open|double-click|extract|unzip|unpack|untar|install|chmod|start|source)\b|\|\s*(?:sudo\s+)?(?:ba|z)?sh\b|\btar\s+-?x/i;
const PREREQ_HEADING = /\b(?:prereq\w*|pre-req\w*|requirements?|setup|set[ -]up|install\w*|getting started|before you (?:begin|start)|dependencies|first steps?|quick ?start)\b/i;
const PREREQ_LINE = /\b(?:prerequisites?|pre-requisites?|before (?:you )?(?:use|using|start|begin|running)|one-time setup|required (?:setup|download|step))\b/i;

const NET_OUT = /\bfetch\s*\(|\baxios\b|\bhttps?\.(?:request|get)\s*\(|\b(?:curl|wget)\b|\bInvoke-(?:WebRequest|RestMethod)\b|(?:^|[\s(|;&])(?:iwr|irm)\s|\brequests\.(?:get|post|put|patch|delete|request)\s*\(|\burlopen\s*\(|\burllib\.request\b|\bhttpx\.(?:get|post|put|Client|AsyncClient)\b|\bXMLHttpRequest\b|\bsendBeacon\b|\bnew\s+WebSocket\s*\(|\bnet\.(?:connect|createConnection)\s*\(|\bsocket\.create_connection\b|\bWebFetch\b/i;

const CFG_TARGET = String.raw`(?:(?<![\w-])settings(?:\.local)?\.json\b|\.claude[\\/]settings\b|\bpermissions\.(?:allow|deny|ask|defaultMode|additionalDirectories)\b|\ballow(?:ed)?[ _-]?(?:list|tools)\b|\ballowlist\b|\bpermission\s+(?:list|rules?|settings)\b|(?<![\w.-])\.(?:npmrc|yarnrc(?:\.yml)?|pypirc|condarc|gemrc|bashrc|zshrc|bash_profile|bash_login|zprofile|zshenv|zlogin|profile|cshrc|tcshrc|kshrc|gitconfig|claude\.json|mcp\.json)\b|\bpip\.(?:conf|ini)\b|\bconfig\.fish\b|\bPowerShell_profile\.ps1\b|\$PROFILE\b|(?<![\w-])(?:CLAUDE(?:\.local)?|MEMORY|AGENTS)\.md\b|\bshell\s+(?:rc|profile|startup\s+files?|config(?:uration)?)\b)`;
const CFG_VERB = String.raw`\b(?:writes?|writing|edit(?:s|ing)?|modif(?:y|ies|ying)|updat(?:e|es|ing)|append(?:s|ing)?|add(?:s|ing)?|insert(?:s|ing)?|chang(?:e|es|ing)|patch(?:es|ing)?|overwrit(?:e|es|ing)|replac(?:e|es|ing)|rewrit(?:e|es|ing)|inject(?:s|ing)?|put|sets?|creat(?:e|es|ing)|delet(?:e|es|ing)|remov(?:e|es|ing)|disabl(?:e|es|ing)|enabl(?:e|es|ing)|sav(?:e|es|ing)|register(?:s|ing)?|grant(?:s|ing)?|echo|sed\s+-i\S*|cp|mv|ln\s+-\w*s\w*|Set-Content|Add-Content|Out-File|writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream|outputFile(?:Sync)?|writeJson(?:Sync)?)\b`;
const CLAUSE = (n) => String.raw`(?:[^.;!?\n]|[.!?](?=\S)){0,${n}}?`;
const MEMORY_FILE = /(?<![\w-])(?:CLAUDE(?:\.local)?|MEMORY|AGENTS)\.md\b/;

const HOME_PATH = String.raw`(?:~[\\/]|\$HOME\b|\$\{HOME\}|%USERPROFILE%|%APPDATA%|%LOCALAPPDATA%|\$env:(?:USERPROFILE|APPDATA|LOCALAPPDATA|HOME)\b|\/etc\/|\/usr\/(?:local\/)?(?:bin|lib|share)\/)`;

const INVISIBLE = /[­ᅟᅠ᠎​-‏‪-‮⁠-⁤⁦-⁯ㅤ﻿ﾠ︀-︎\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/u;
const INVISIBLE_G = new RegExp(INVISIBLE.source, 'gu');

const SECRET_ENV_REF = /(?:process\.env\.|process\.env\[\s*['"`]|os\.environ(?:\.get)?\s*[[(]\s*['"]|os\.getenv\s*\(\s*['"]|\$env:|\bENV\[\s*['"]|\bgetenv\s*\(\s*['"]|Deno\.env\.get\s*\(\s*['"]|\$\{|\$)([A-Z_][A-Z0-9_]*)/g;
const SECRET_NAME = /(?:^|_)(?:TOKEN|SECRET|APIKEY|PASSWORD|PASSWD|PAT|CREDENTIALS?)(?:_|$)|(?:^|_)(?:API|ACCESS|PRIVATE|SECRET|AUTH)_KEY(?:_|$)/;
const ENV_DUMP = /\bJSON\.stringify\(\s*process\.env\b|\bprintenv\b|\benv\s*\|\s*(?:curl|nc|base64)|\bjson\.dumps\(\s*(?:dict\(\s*)?os\.environ\b|\bGet-ChildItem\s+env:/;

const WELL_KNOWN = ['superpowers', 'frontend-design', 'mattpocock-skills', 'caveman', 'ponytail', 'playwright', 'context7'];

const NAMESPACE_HOSTS = /^(?:www\.)?w3\.org$|^json-schema\.org$|^purl\.org$|^ns\.adobe\.com$|^xmlns\.com$|^schemas\./i;
const QUIET_HOST = /^(?:localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])$|\.localhost$|(?:^|\.)example\.(?:com|org|net)$|\.(?:example|invalid|test|local)$/i;

/* ------------------------------------------------------------------------------------------ */
/* Rule table                                                                                 */
/* ------------------------------------------------------------------------------------------ */
//
// Each rule: id, severity (default), why (what the scout cites) and a matcher:
//   patterns: regexes tried on every line, and on hook, MCP/LSP and package-script commands.
//             An entry is a RegExp or { re, contexts, accept, sev }. `contexts` limits where it
//             applies (doc, config, script, hook, server); `accept` vetoes a hit; `sev` sets
//             the severity of a hit. Rule-level contexts/accept/sev are the defaults.
//   check:    a function over a whole file, for structure (JSON, frontmatter, file layout).

const P = (re, opts = {}) => ({ re, ...opts });

export const RULES = [
  {
    id: 'remote-code-exec',
    severity: 'high',
    why: 'Downloads code and runs it in one step. What runs is whatever the server sends at that moment, with the user\'s permissions.',
    patterns: [
      new RegExp(String.raw`\b(?:curl|wget)\b[^|\n]*\|\s*${SHELLS}`, 'i'),
      /\b(?:irm|iwr|Invoke-RestMethod|Invoke-WebRequest|curl|wget|DownloadString)\b[^\n]*\|\s*(?:iex|Invoke-Expression)\b/i,
      /\bInvoke-Expression\b/i,
      /\biex\s*\(?\s*(?:\(\s*)?(?:New-Object|irm|iwr|Invoke-RestMethod|Invoke-WebRequest|\[System\.Net)/i,
      /\[scriptblock\]::Create\s*\(/i,
      /(?:^|[\s;&|(])(?:source|\.|(?:ba|z|k)?sh)\s+<\(\s*(?:curl|wget)\b/i,
      /\beval\s+["']?(?:\$\(|`)\s*(?:curl|wget)\b/i,
      /\b(?:(?:ba|z|k)?sh|python[23]?|node|perl|ruby)\s+(?:-\w+\s+)*-c\s+["']?\$\(\s*(?:curl|wget)\b/i,
      /\b(?:curl|wget)\b[^\n;&|]*?(?:\s-[A-Za-z]*[oO]\s*|\s--output(?:-document)?[= ]\s*)\S+[^\n]*?(?:&&|;)\s*(?:sudo\s+)?(?:chmod\s+[+0-7a-z]*x|(?:ba|z)?sh\s|\.\/|source\s|python[23]?\s|node\s|exec\s)/i,
      /\b(?:eval|exec)\s*\(\s*(?:await\s+)?\(?\s*(?:await\s+)?(?:fetch|axios(?:\.get)?|requests\.get|urllib\.request\.urlopen|urlopen|https?\.get)\s*\(/i,
    ],
  },
  {
    id: 'prerequisite-download',
    severity: 'high',
    why: 'A setup step that has the agent or user download and run a file. This is how malicious skills deliver malware (ClawHavoc); password-protected archives also hide the payload from scanners.',
    patterns: [
      P(DOWNLOAD_VERB, {
        contexts: ['doc'],
        accept: (m, line, lc) => {
          const prereq = PREREQ_HEADING.test(lc.section) || PREREQ_LINE.test(line);
          const risky = RISKY_EXT.test(line);
          const run = RUN_VERB.test(line);
          return (risky && (prereq || run)) || (prereq && run && /https?:\/\//.test(line));
        },
      }),
      /\b(?:zip|archive|7z|rar)\b[^\n]{0,80}\bpass(?:word|phrase|code)\s*(?:is\s*)?[:=]|\bpass(?:word|phrase|code)[- ]protected\s+(?:zip|archive|7z|rar)\b|\bpass(?:word|phrase|code)\s*[:=][^\n]{0,60}\b(?:zip|archive|7z|rar|extract|unzip)\b|\bunzip\s+-P\s|\b7z\s+x\b[^\n]*\s-p\S/i,
    ],
  },
  {
    id: 'runtime-instructions-fetch',
    severity: 'medium',
    why: 'Pulls rules or prompts from a URL at run time, so what the agent follows can change after vetting. Pin to a commit or vendor the file.',
    patterns: [
      P(/\b(?:fetch|re-?fetch|load|download|retrieve|pull|grab|get|webfetch|curl|wget)\w*\b(?:(?!https?:)[^\n]){0,60}?\b(?:latest|current|newest|up-to-date|live|remote|updated)?\s*(?:guidelines?|rules?|rulesets?|instructions?|prompts?|polic(?:y|ies)|checklists?|standards?|playbooks?|directives?|conventions)\b[^\n]{0,80}?(https?:\/\/[^\s)>\]"'`]+)/i, { accept: (m) => !pinnedGitUrl(m[1]) }),
      P(/\b(?:follow|obey|apply|adopt)\b[^\n]{0,40}?\b(?:instructions?|rules?|guidelines?|steps?|prompts?)\b[^\n]{0,30}?\b(?:at|from|in|on)\b[^\n]{0,20}?(https?:\/\/[^\s)>\]"'`]+)/i, { accept: (m) => !pinnedGitUrl(m[1]) }),
      P(/\b(?:WebFetch|fetch|load|read|download|retrieve|pull|get|curl|wget|import)\b[^\n]{0,80}?(https?:\/\/(?:raw\.githubusercontent\.com|gist\.githubusercontent\.com|github\.com\/[^\s/]+\/[^\s/]+\/(?:raw|blob)|cdn\.jsdelivr\.net\/gh)\/[^\s)>\]"'`]+)/i, { accept: (m) => !pinnedGitUrl(m[1]) }),
    ],
  },
  {
    id: 'unpinned-remote-package',
    severity: 'medium',
    why: 'Runs a package at whatever version is newest when it starts, so the code that runs is not the code that was vetted. Pin an exact version.',
    contexts: SCRIPTY,
    patterns: [
      P(/\b(?:npx|bunx|pnpx|pnpm\s+dlx|yarn\s+dlx|npm\s+exec)\s+([^\n;&|]*)/, { accept: (m, line, lc) => (m.detail = unpinnedNpx(m[1], lc.ctx)) !== null }),
      P(/\b(?:uvx|pipx\s+run|pipx\s+install|uv\s+tool\s+(?:run|install))\s+([^\n;&|]*)/, { accept: (m) => (m.detail = unpinnedUvx(m[1])) !== null }),
      P(/\b(?:pip[23]?|python[23]?(?:\.\d+)?\s+-m\s+pip|uv\s+pip)\s+install\s+([^\n;&|#>]*)/, { accept: (m) => (m.detail = unpinnedPip(m[1])) !== null }),
      P(/\bnpm\s+(?:i|install|add)\s+(?:-g|--global)\s+([^\n;&|]*)/, { accept: (m) => (m.detail = unpinnedNpmGlobal(m[1])) !== null }),
      P(/\bgo\s+install\s+(\S+@latest)\b/, { accept: (m) => (m.detail = m[1]) && true }),
    ],
  },
  {
    id: 'secret-path-read',
    severity: 'high',
    why: 'Touches a credential store: SSH keys, cloud credentials, .env files, keychains, browser profiles, Claude credentials or secret tokens. A skill rarely needs this; it is the first step of exfiltration.',
    accept: (m, line, lc) => !insideUrl(line, m.index) && !(lc.ctx === 'doc' && negatedBefore(line, m.index)),
    patterns: [
      /(?<![\w-])\.ssh(?![\w-])/i,
      /\bid_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?\b|\bauthorized_keys\b/i,
      /(?<![\w-])\.aws(?![\w-])|\bAWS_SHARED_CREDENTIALS_FILE\b/i,
      /(?<![\w-])(?:\.netrc|_netrc|\.pypirc|\.git-credentials|\.gnupg|\.kube[\\/]config|\.docker[\\/]config\.json|\.config[\\/]gh[\\/]hosts\.ya?ml|\.config[\\/]gcloud|\.azure[\\/])(?![\w-])/i,
      /\bcredentials\.(?:json|ya?ml|txt|db|toml|ini|csv|xml)\b|[\\/]credentials(?![\w.-])|\bapplication_default_credentials\b/i,
      /\.claude[\\/]\.credentials|(?<![\w-])\.credentials\.json\b|(?<![\w.-])\.claude\.json\b/i,
      /\b(?:cat|less|more|head|tail|bat|source|read|reads|reading|load|loads|loading|open|opens|parse|parses|print|prints|grep|readFileSync|readFile|Get-Content|type|copy|cp|upload|uploads|send|sends|exfiltrate)\b[^\n]{0,50}?(?<![\w.-])\.env(?:\.(?:local|production|prod|development|dev|staging|test))?(?![\w.-])/i,
      P(/\brequire\(\s*['"]dotenv['"]\s*\)|\bfrom\s+['"]?dotenv\b|\bimport\s+['"]dotenv\/config['"]|\bload_dotenv\s*\(|\bdotenv\.config\s*\(/, { contexts: SCRIPTY }),
      /\bsecurity\s+(?:find-generic-password|find-internet-password|dump-keychain|export)\b|Library[\\/]Keychains|\blogin\.keychain|\bsecret-tool\s+lookup\b|\bkwallet-query\b|\bcmdkey\s+\/list\b|\bCredRead[AW]?\b|\bGet-StoredCredential\b|\bkeyring\.get_password\b|\bkeytar\b/i,
      /(?:Library[\\/]Application Support|AppData[\\/](?:Local|Roaming)|\.config)[\\/](?:Google[\\/]Chrome|Chromium|BraveSoftware|Microsoft[\\/]Edge|Mozilla|Firefox|google-chrome|chromium|Vivaldi|Opera Software|Arc)\b|(?<![\w-])\.mozilla[\\/]firefox|\b(?:cookies\.sqlite|logins\.json|key[34]\.db)\b|\bLogin Data\b/,
      /(?<![\w-])\.(?:bash|zsh|sh|python)_history\b|\bConsoleHost_history\b|\/etc\/shadow\b/i,
    ],
    check: checkSecretEnv,
  },
  {
    id: 'config-tamper',
    severity: 'high',
    why: 'Writes, or tells the agent to edit, agent or shell configuration: settings and permission lists, package registries, CLAUDE.md or MEMORY.md, shell rc files, startup items. These changes outlive the skill and can widen what runs without a prompt. A prose instruction that only touches CLAUDE.md, AGENTS.md or MEMORY.md is medium: the agent makes that edit in the open, where the user sees it. Scripts doing the same, and every other target, stay high.',
    accept: (m, line, lc) => !(lc.ctx === 'doc' && negatedBefore(line, m.index)),
    sev: (m, line, lc) => {
      if (lc.ctx !== 'doc' || lc.inFence) return 'high';
      // Medium only when the match is about a memory file and nothing else on the line is config.
      const strip = (s) => s.replace(new RegExp(MEMORY_FILE.source, 'gi'), '');
      const aboutMemory = strip(m[0]) !== m[0];
      return aboutMemory && !new RegExp(CFG_TARGET, 'i').test(strip(line)) ? 'medium' : 'high';
    },
    patterns: [
      new RegExp(CFG_VERB + CLAUSE(80) + CFG_TARGET, 'i'),
      P(new RegExp(CFG_TARGET + CLAUSE(50) + String.raw`\b(?:edit|modify|update|overwrite|patch|append\s+to|write\s+to|rewrite)\s+(?:it|this|that|them|the\s+file)\b`, 'i'), {
        accept: (m, line, lc) => {
          const verb = /\b(?:edit|modify|update|overwrite|patch|append\s+to|write\s+to|rewrite)\s+(?:it|this|that|them|the\s+file)\b/i.exec(m[0]);
          return !(lc.ctx === 'doc' && negatedBefore(line, m.index + (verb ? verb.index : 0)));
        },
      }),
      P(new RegExp(String.raw`(?:[^\s>=-]\s*>>?|>>|\btee\s+(?:-a\s+)?)\s*["']?[^\s"'|;&<>]*` + CFG_TARGET, 'i'), { accept: (m, line, lc) => lc.ctx !== 'doc' || lc.inFence }),
      new RegExp(String.raw`\bopen\s*\([^\n]{0,120}?` + CFG_TARGET + String.raw`[^\n]{0,60}?,\s*['"](?:a|w|x|r\+|w\+|a\+)b?['"]`, 'i'),
      /--dangerously-skip-permissions\b|--allow-dangerously-skip-permissions\b|\bbypassPermissions\b/,
      /\b(?:npm|pnpm|yarn)\s+config\s+set\b|\bnpm\s+set\s+(?:registry|\/\/)|\bpip[23]?\s+config\s+set\b|--extra-index-url\b|\bgit\s+config\s+(?:--global|--system)\s+(?:core\.hooksPath|core\.sshCommand|core\.fsmonitor|url\.\S+\.insteadOf|credential\.helper|http\.\S*proxy)\b/i,
      /\bcrontab\s+-(?!l\b)|[\\/]LaunchAgents[\\/]|[\\/]LaunchDaemons[\\/]|\bsystemctl\s+--user\s+enable\b|\bschtasks\s+\/create\b|CurrentVersion\\Run\b/i,
    ],
    check: checkShippedSettings,
  },
  {
    id: 'hooks',
    severity: 'medium',
    why: 'Hook commands run automatically, outside the sandbox, with full user permissions. Read each one line by line. Escalated to high when a hook command, or a script it runs, trips a high rule.',
    check: checkHooks,
  },
  {
    id: 'inline-exec',
    severity: 'medium',
    why: 'Skill or command text with !`...` runs that shell command when invoked, before the model reads the result. Escalated to high when the command trips a high rule.',
    check: checkInlineExec,
  },
  {
    id: 'mcp-server',
    severity: 'medium',
    why: 'MCP servers are processes or remote endpoints the agent talks to; local ones run with full user permissions and can reach the network. Check the command, its version pin and its source.',
    patterns: [/\bclaude\s+mcp\s+add(?:-json|-from-claude-desktop)?\b/],
    check: (file, api) => checkServers(file, api, 'mcp'),
  },
  {
    id: 'lsp-server',
    severity: 'info',
    why: 'Language server the plugin starts. Check which binary it runs and where that binary comes from.',
    check: (file, api) => checkServers(file, api, 'lsp'),
  },
  {
    id: 'install-script',
    severity: 'high',
    why: 'npm runs this script automatically on install, before anyone has read the code.',
    check: checkPackageJson,
  },
  {
    id: 'network-call',
    severity: 'info',
    why: 'Makes or references network calls. Note where data goes; inside a script or hook this is medium.',
    sev: (m, line, lc) => (lc.ctx === 'doc' || lc.ctx === 'config' || lc.isComment ? 'info' : 'medium'),
    patterns: [
      /\bfetch\s*\(|\baxios\b|\bhttps?\.(?:request|get)\s*\(|\b(?:curl|wget)\b|\bInvoke-(?:WebRequest|RestMethod)\b|(?:^|[\s(|;&])(?:iwr|irm)\s/i,
      /\brequests\.(?:get|post|put|patch|delete|head|request)\s*\(|\burlopen\s*\(|\burllib(?:\.request|2)\b|\bhttpx\.(?:get|post|put|patch|delete|request|Client|AsyncClient)\b|\baiohttp\.ClientSession\b/,
      /\bXMLHttpRequest\b|\bnavigator\.sendBeacon\b|\bnew\s+WebSocket\s*\(|\bnet\.(?:connect|createConnection)\s*\(|\bsocket\.create_connection\s*\(|\b(?:nc|ncat|netcat)\s+(?:-\w+\s+)*[\w.-]+\.\w+\s+\d{2,5}\b|\bWebFetch\b/,
      P(/\b(?:https?|wss?):\/\/([A-Za-z0-9.-]+(?::\d+)?)[^\s"'<>)\]`]*/, {
        contexts: SCRIPTY,
        // XML namespace identifiers are names, not requests.
        accept: (m, line) => !NAMESPACE_HOSTS.test(hostOf(m[1])) && !/xmlns(?::[\w-]+)?\s*=\s*["']?$/.test(line.slice(Math.max(0, m.index - 40), m.index)),
        // A plain <a href> link loads nothing; comments and local or example hosts are info.
        sev: (m, line, lc) => (lc.isComment || QUIET_HOST.test(hostOf(m[1])) || /<a\s[^<>]*href\s*=\s*["']?$/i.test(line.slice(Math.max(0, m.index - 200), m.index)) ? 'info' : 'medium'),
      }),
    ],
    check: checkDocLinks,
  },
  {
    id: 'telemetry',
    severity: 'medium',
    why: 'Collects or sends usage data, or posts to a webhook. Check what is sent, where, and whether it is on by default.',
    patterns: [
      /(?<![A-Za-z])telemetry(?![A-Za-z])|\bDO_NOT_TRACK\b/i, // letters-only boundary: also SOME_TELEMETRY_FLAG
      /\b(?:posthog|mixpanel|amplitude|segment\.(?:io|com)|analytics-node|google-analytics|googletagmanager|plausible\.io|hotjar|fullstory|rudderstack|snowplow|countly|matomo|heap\.io|sentry\.io|bugsnag)\b|@segment\/|\bgtag\s*\(/i,
      /\b(?:https?):\/\/[^\s"'<>)\]`]*(?:webhook|hooks\.slack\.com|discord(?:app)?\.com\/api\/webhooks|webhook\.site|requestbin|pipedream\.net|ngrok(?:-free)?\.(?:io|app|dev)|interact\.sh|\.oast\.|burpcollaborator|beeceptor|hookbin|requestcatcher|canarytokens)/i,
      P(/(?<![A-Za-z])analytics(?![A-Za-z])|\.track\s*\(|\btrackEvent\s*\(|\bposthog\.capture\s*\(|\busage[_ -]?(?:stats|statistics|metrics|ping)\b/i, { contexts: [...SCRIPTY, 'config'] }),
      P(/\b(?:collect|send|report|upload|share|transmit)s?\b[^\n]{0,30}\b(?:usage|anonymous|telemetry|analytics|crash)\s+(?:data|statistics|stats|reports?|metrics|information|events)\b|\b(?:tracking|analytics)\s+(?:pixel|id|code|script|beacon)\b/i, { contexts: ['doc'] }),
    ],
  },
  {
    id: 'obfuscation',
    severity: 'high',
    why: 'Hidden or encoded content (long base64, escape runs, invisible or bidi Unicode, control characters, padding, minified code) keeps a human reader from seeing what the file really says.',
    patterns: [
      P(/(?<![A-Za-z0-9+/=_-])(?:[A-Za-z0-9+/]{200,}={0,2}|[A-Za-z0-9_-]{200,})/, { accept: (m) => looksEncoded(m[0]), sev: dataUriSeverity }),
      /(?:\\x[0-9a-fA-F]{2}){8,}|(?:\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]{1,6}\}){6,}|(?:\\[0-7]{3}){8,}/,
      /\bString\.fromCharCode\s*\(\s*(?:\d+\s*,\s*){8,}|(?:\bchr\(\s*\d+\s*\)\s*\+\s*){6,}/,
      /(?:base64\s+(?:-d|--decode|-D)\b|\bb64decode\b|\batob\s*\(|Buffer\.from\([^)\n]*['"]base64['"]\)|FromBase64String|certutil\s+-decode)[^\n]*(?:\|\s*(?:ba|z)?sh\b|\beval\b|\bexec\b|Function\s*\(|\biex\b|Invoke-Expression)/i,
      /\b(?:eval|exec|iex|Invoke-Expression)\b\s*\(?[^\n]{0,80}(?:b64decode|atob\s*\(|base64\s+(?:-d|--decode)|FromBase64String)/i,
      P(INVISIBLE, { accept: invisibleIsSuspicious }),
      /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]|\r(?=.)/,
      /[ \t  - 　]{2000,}/,
      P(/^.{1001,}$/, { contexts: SCRIPTY, sev: () => 'high' }),
    ],
    check: checkBlankRuns,
  },
  {
    id: 'opaque-file',
    severity: 'high',
    why: 'A binary, archive, office or PDF document, or non-regular file that cannot be read as text. Its content is unreviewed; the agent should never be told to open it.',
  },
  {
    id: 'opaque-large-file',
    severity: 'high',
    why: 'File over 5 MB was not read. Its content is unreviewed.',
  },
  {
    id: 'media-file',
    severity: 'info',
    why: 'Image, font or media file. Not read as text; only its header was checked against its extension.',
  },
  {
    id: 'symlink',
    severity: 'info',
    why: 'Symlinks are never followed. One that points outside the package makes anything reading through it open a file elsewhere on the machine, such as a key; that is high.',
  },
  {
    id: 'write-outside',
    severity: 'medium',
    why: 'A script writes outside its own folder (home directory or system paths). Check what it writes and whether it cleans up.',
    contexts: SCRIPTY,
    patterns: [
      new RegExp(String.raw`(?:[^\s>=-]\s*>>?|>>|\btee\s+(?:-a\s+)?|\b(?:cp|mv|install|rsync)\s+(?:-\S+\s+)*\S+\s+|\bmkdir\s+(?:-p\s+)?|\btouch\s+|\bln\s+-\w*\s+\S+\s+)["']?` + HOME_PATH),
      new RegExp(String.raw`\b(?:writeFile|appendFile|mkdir|createWriteStream|copyFile|rename|outputFile|writeJson|symlink)(?:Sync)?\s*\(\s*(?:path\.(?:join|resolve)\s*\(\s*)?(?:os\.homedir\(\)|homedir\(\)|process\.env\.(?:HOME|USERPROFILE|APPDATA)|['"\x60]~[\\/]|['"\x60]\/etc\/)`),
      /\bopen\s*\(\s*(?:os\.path\.expanduser\s*\(|Path\.home\(\)|['"]~\/)[^\n]{0,100}?['"](?:a|w|x|r\+|w\+|a\+)b?['"]/,
      /\b(?:Path\.home\(\)|Path\(\s*['"]~)[^\n]{0,80}?\.(?:write_text|write_bytes|mkdir|touch)\s*\(/,
    ],
  },
  {
    id: 'broad-tools',
    severity: 'medium',
    why: 'Grants unrestricted shell, or every tool, without a prompt. Ask for the narrowest tool list that works.',
    check: checkBroadTools,
  },
  {
    id: 'injection-phrase',
    severity: 'high',
    why: 'Text that addresses the reviewing agent or tries to override its instructions. A skill that talks to its reviewer is a reject. A phrase in quotes is usually a mention (a warning about injection) and is medium: read it.',
    // "Never ignore previous instructions" is a safeguard, not an attack.
    accept: (m, line) => !negatedBefore(line, m.index),
    sev: (m, line) => (quotedAround(line, m.index, m.index + m[0].length) ? 'medium' : 'high'),
    patterns: [
      /\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+)?(?:of\s+)?(?:the\s+|your\s+|my\s+)?(?:previous|prior|above|earlier|preceding|original)\s+(?:instructions?|prompts?|rules|directions|guidelines|messages)\b/i,
      // "don't tell the user to use X" is phrasing advice; concealment is "don't tell the user (that|about|...)".
      /\b(?:do\s+not|don't|dont|never)\s+(?:tell|inform|notify|alert)\s+the\s+user\b(?!\s+to\s)|\bwithout\s+(?:telling|informing|notifying|alerting|showing|warning)\s+the\s+user\b|\b(?:hide|conceal|keep)\s+(?:this|it|these|the\s+\w+)\s+(?:hidden\s+)?from\s+the\s+user\b/i,
      /\bwithout\s+(?:the\s+user'?s?\s+)?(?:knowledge|consent)\b/i,
      P(/\bwithout\s+asking\b/i, { accept: withoutAskingIsSuspicious }),
      /\byou\s+are\s+now\s+(?:an?\s+|the\s+|acting\s+as|operating\s+as|in\s+(?:developer|god|admin|unrestricted|jailbreak|dan)\s+mode|free\b|unrestricted|no\s+longer)/i,
      /\b(?:reveal|print|show|output|repeat|leak|dump|ignore|override|overwrite|replace|disregard|forget|bypass|change|modify|append\s+to|prepend\s+to)\s+(?:\w+\s+){0,3}system\s+prompt\b|^[\s>#*\-[(<]*(?:new|updated|real|actual|true|hidden)?\s*system\s+prompt\s*[:\]>)]|<\s*\/?\s*(?:system|system-reminder)\s*>|<\|im_start\|>\s*system|<<\s*SYS\s*>>/i,
      /\[\s*(?:SYSTEM|INST)\s*\]/, // case-sensitive: "[system]" is a common template placeholder
      /\b(?:rate|mark|classify|score|label|report|treat|consider|grade|flag)\s+(?:this|the|our)\s+(?:skill|plugin|package|extension|tool|repo(?:sitory)?|code|file|server)\s+(?:as\s+)?(?:safe|trusted|benign|clean|low[\s-]?risk|approved|harmless|verified)\b/i,
      /\bthis\s+(?:skill|plugin|package|extension|tool|code|script|repo(?:sitory)?|file|server)\s+(?:is|has\s+been)\s+(?:(?:fully|already|officially|pre-?|security[\s-])\s*)?(?:safe|approved|trusted|verified|vetted|audited|whitelisted|allowlisted|certified)\b|\bthis\s+is\s+(?:safe|approved|trusted)\b(?!\s+(?:to|for|when|if|because|as\s+long|only)\b)/i,
      /\b(?:corporate|company|organi[sz]ation(?:al)?|enterprise|security|compliance|legal|admin(?:istrator)?|internal|IT)\s+(?:policy|policies|config(?:uration)?|team|department|requirements?|mandate)\s+(?:requires?|mandates?|says|states|dictates|demands|authori[sz]es|(?:has|have)\s+(?:approved|authori[sz]ed|pre-?approved|whitelisted))\b|\b(?:per|according\s+to|as\s+required\s+by|mandated\s+by)\s+(?:the\s+|our\s+|your\s+)?(?:corporate|company|organi[sz]ation(?:al)?|enterprise|security|IT)\s+polic(?:y|ies)\b/i,
      /\b(?:approved|authori[sz]ed|endorsed|verified|sanctioned|whitelisted|vetted)\s+by\s+(?:anthropic|claude|openai|the\s+(?:claude|anthropic)\s+team|your\s+(?:admin(?:istrator)?|organi[sz]ation|security\s+team|it\s+department))\b/i,
      /\b(?:note|message|instructions?)\s+(?:to|for)\s+(?:the\s+|any\s+)?(?:ai|llm|model|assistant|agent|claude|reviewer|scanner|auditor|scout|security\s+(?:review(?:er)?|scanner|tool))\b|\bif\s+you\s+are\s+(?:an?\s+)?(?:ai|llm|language\s+model|assistant|automated\s+(?:reviewer|scanner|agent)|security\s+(?:scanner|reviewer)|claude)\b|\b(?:the\s+)?(?:reviewer|scanner|auditor|scout|security\s+review(?:er)?)\s+(?:should|must|will|is\s+to)\s+(?:rate|mark|approve|pass|ignore|skip|allow|accept|whitelist)\b/i,
      /^[\s>#*\-]*(?:new|updated|real|actual|true|hidden|secret)\s+instructions\s*:/i,
    ],
  },
  {
    id: 'auto-update',
    severity: 'medium',
    why: 'Updates itself after install, so the code that runs drifts from the code that was vetted.',
    patterns: [
      P(/\bgit\s+(?:-C\s+\S+\s+)?pull\b/, { contexts: SCRIPTY }),
      P(/\bgit\s+(?:-C\s+\S+\s+)?fetch\b[^\n]*(?:&&|;)\s*git\s+(?:-C\s+\S+\s+)?(?:reset\s+--hard|checkout|merge|rebase)\b/, { contexts: SCRIPTY }),
      P(/\b(?:self|auto)[-_ ]?updat(?:e|es|er|ing)\b/i, { contexts: SCRIPTY }),
      // Prose needs the hyphen or space: a camelCase "autoUpdate" in a schema or doc is a field name.
      P(/\b(?:self|auto)[- ]updat(?:e|es|er|ing)\b/i, { contexts: ['doc', 'config'] }),
      P(/\bcheck[-_ ]?for[-_ ]?updates?\b|\bupdate[-_ ]?check\b/i, { contexts: SCRIPTY }),
      P(/(?:>|\s-o\s*|--output[= ]|\b(?:writeFileSync|writeFile|copyFileSync|renameSync)\s*\(\s*)["'(]?\s*(?:"?\$0"?|__filename|__file__|\$PSCommandPath|process\.argv\[1\])/, { contexts: SCRIPTY }),
      /\b(?:updat|upgrad)(?:e|es|ing)\s+(?:itself|yourself|this\s+(?:skill|plugin|tool))\b/i,
      /\b(?:download|fetch|pull|install|get)\w*\s+(?:the\s+)?(?:latest|newest|newer)\s+version\s+of\s+(?:this|itself|the\s+(?:skill|plugin))\b/i,
      /\bgit\s+-C\s+\S*(?:skills|plugins|\.claude)\S*\s+pull\b|\bcd\s+\S*(?:skills|plugins|\.claude)\S*\s*&&\s*git\s+pull\b/i,
    ],
  },
  {
    id: 'typosquat-hint',
    severity: 'info',
    why: 'Name is one or two edits from a well-known skill or plugin. Check the owner and repo are the real ones.',
    check: checkTyposquat,
  },
];

const RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r]));
// Rule ids whose findings are per item, not per line (so two on one line stay separate).
const ITEM_RULES = new Set(['hooks', 'inline-exec', 'mcp-server', 'lsp-server', 'install-script', 'broad-tools', 'typosquat-hint', 'symlink']);

// Compile pattern entries once: global flag for matchAll.
const LINE_RULES = RULES.filter((r) => r.patterns).map((r) => ({
  rule: r,
  patterns: r.patterns.map((p) => {
    const e = p instanceof RegExp ? { re: p } : p;
    const flags = e.re.flags.includes('g') ? e.re.flags : e.re.flags + 'g';
    return { ...e, re: new RegExp(e.re.source, flags) };
  }),
}));

/* ------------------------------------------------------------------------------------------ */
/* Matcher helpers                                                                            */
/* ------------------------------------------------------------------------------------------ */

function pinnedGitUrl(url) {
  const m = /^https?:\/\/(?:raw\.githubusercontent\.com\/[^/]+\/[^/]+\/|github\.com\/[^/]+\/[^/]+\/(?:raw|blob)\/|gist\.githubusercontent\.com\/[^/]+\/[^/]+\/raw\/|cdn\.jsdelivr\.net\/gh\/[^/]+\/[^/@]+@)([^/\s]+)/i.exec(url);
  return !!m && /^[0-9a-f]{40}$/i.test(m[1]);
}

const NEGATION = /\b(?:never|not|no|don't|dont|doesn't|do\s+not|must\s+not|mustn't|should\s+not|shouldn't|cannot|can't|won't|avoid|without)\b((?:\s+\S+){0,5})\s*$/i;
const DOUBLE_NEGATION = /\b(?:forget|hesitate|skip|fail|neglect|omit|stop|miss|wait)\b/i;

// True when the text just before `index`, within its clause, negates the action
// ("never edit settings.json", "does not read ~/.ssh"), but not "don't forget to ...".
function negatedBefore(line, index) {
  const pre = line.slice(0, index);
  const cut = Math.max(pre.lastIndexOf('. '), pre.lastIndexOf('; '), pre.lastIndexOf('! '), pre.lastIndexOf('? '), pre.lastIndexOf(': '));
  const clause = pre.slice(cut + 1);
  const m = NEGATION.exec(clause);
  return !!m && !DOUBLE_NEGATION.test(m[1]);
}

const QUOTE_PAIRS = { '"': '"', '“': '”', "'": "'", '‘': '’', '`': '`' };

// True when the matched phrase sits inside quotes ("ignore previous instructions," ...).
function quotedAround(line, start, end) {
  const before = line.slice(Math.max(0, start - 2), start).replace(/\s+$/, '');
  const open = before.slice(-1);
  const close = QUOTE_PAIRS[open];
  return !!close && line.slice(end, end + 4).includes(close);
}

function insideUrl(line, index) {
  for (const m of line.matchAll(/\bhttps?:\/\/[^\s"'<>)\]`]+/g)) {
    if (index >= m.index && index < m.index + m[0].length) return true;
  }
  return false;
}

const RISKY_ACTION = /\b(?:run|execute|install|send|upload|post|transmit|delete|remove|rm|download|curl|wget|share|forward|email|push|publish|approve|grant|enable|disable|modify|edit|change|overwrite|commit|deploy|pay|purchase|exfiltrat\w*|copy|move)\b/i;

function sentenceAround(line, index) {
  const before = line.slice(0, index);
  const start = Math.max(before.lastIndexOf('. '), before.lastIndexOf('; '), before.lastIndexOf('! '), before.lastIndexOf('? ')) + 1;
  const rest = line.slice(index);
  const endRel = rest.search(/[.;!?](?:\s|$)/);
  return line.slice(start, endRel === -1 ? line.length : index + endRel);
}

// "without asking the user / for permission" is suspicious; a bare "without asking" only when
// the same sentence asks for a risky action. "Never push without asking" is a safeguard.
function withoutAskingIsSuspicious(m, line) {
  if (negatedBefore(line, m.index)) return false;
  const tail = line.slice(m.index + m[0].length);
  if (/^\s+(?:the\s+user|anyone|them|for\s+(?:permission|confirmation|approval|consent))\b/i.test(tail)) return true;
  return RISKY_ACTION.test(sentenceAround(line, m.index).replace(/\bwithout\s+asking\b/i, ''));
}

const PICTO = /\p{Extended_Pictographic}/u;
function invisibleIsSuspicious(m, line, lc) {
  const ch = m[0];
  if (ch === '﻿' && m.index === 0 && lc.lineNo === 1) return false; // byte-order mark
  if (ch === '‍') {
    // zero-width joiner inside an emoji sequence
    const before = Array.from(line.slice(Math.max(0, m.index - 6), m.index)).filter((c) => !/[️\u{1F3FB}-\u{1F3FF}]/u.test(c));
    const after = Array.from(line.slice(m.index + 1, m.index + 4));
    if (before.length && PICTO.test(before[before.length - 1]) && after.length && PICTO.test(after[0])) return false;
  }
  return true;
}

function looksEncoded(run) {
  if (/^[0-9a-fA-F]+$/.test(run)) return /[0-9]/.test(run) && /[a-fA-F]/.test(run);
  return /[A-Z]/.test(run) && /[a-z]/.test(run) && /[0-9]/.test(run);
}

const MEDIA_MIME = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/bmp': 'bmp', 'image/avif': 'avif',
  'font/woff': 'woff', 'font/woff2': 'woff2', 'font/ttf': 'ttf', 'font/otf': 'otf',
  'application/font-woff': 'woff', 'application/font-woff2': 'woff2', 'application/x-font-woff': 'woff',
  'application/x-font-ttf': 'ttf', 'application/x-font-truetype': 'ttf', 'application/x-font-opentype': 'otf',
};

// A base64 blob inside a data: URI that decodes to the media type it claims is info; anything
// else stays high.
function dataUriSeverity(m, line) {
  const pre = line.slice(Math.max(0, m.index - 120), m.index);
  const d = /data:([\w.+-]+\/[\w.+-]+)(?:;[\w.=-]+)*;base64,$/i.exec(pre);
  if (!d) return 'high';
  const kind = MEDIA_MIME[d[1].toLowerCase()];
  if (!kind) return 'high';
  let head;
  try { head = Buffer.from(m[0].slice(0, 64), 'base64'); } catch { return 'high'; }
  m.detail = MEDIA_CHECK[kind]?.(head) ? `data: URI decodes to ${d[1]}` : `data: URI claims ${d[1]} but does not decode to it`;
  return MEDIA_CHECK[kind]?.(head) ? 'info' : 'high';
}

const ascii = (b, s, e) => b.toString('latin1', s, e);
const MEDIA_CHECK = {
  png: (b) => b[0] === 0x89 && ascii(b, 1, 4) === 'PNG',
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => ascii(b, 0, 4) === 'GIF8',
  webp: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP',
  ico: (b) => b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0,
  bmp: (b) => ascii(b, 0, 2) === 'BM',
  avif: (b) => ascii(b, 4, 8) === 'ftyp',
  tif: (b) => ascii(b, 0, 4) === 'II*\u0000' || ascii(b, 0, 4) === 'MM\u0000*',
  tiff: (b) => ascii(b, 0, 4) === 'II*\u0000' || ascii(b, 0, 4) === 'MM\u0000*',
  woff: (b) => ascii(b, 0, 4) === 'wOFF',
  woff2: (b) => ascii(b, 0, 4) === 'wOF2',
  ttf: (b) => (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0) || ascii(b, 0, 4) === 'true',
  otf: (b) => ascii(b, 0, 4) === 'OTTO',
  eot: (b) => b.length > 35 && b[34] === 0x4c && b[35] === 0x50,
  mp3: (b) => ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  mp4: (b) => ascii(b, 4, 8) === 'ftyp',
  m4a: (b) => ascii(b, 4, 8) === 'ftyp',
  mov: (b) => ascii(b, 4, 8) === 'ftyp' || ascii(b, 4, 8) === 'moov',
  wav: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE',
  ogg: (b) => ascii(b, 0, 4) === 'OggS',
  webm: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  flac: (b) => ascii(b, 0, 4) === 'fLaC',
};

/* --- package specs --- */

const unquote = (s) => s.replace(/^['"`]+|['"`,]+$/g, '');

function npmSpecUnpinned(spec) {
  const s = unquote(spec);
  if (!s || /^(?:\.{0,2}[\\/]|~|file:|\$)/.test(s)) return false; // local path or variable
  if (/^(?:git\+|git:|github:|https?:)/.test(s)) return !/#[0-9a-f]{7,40}$/i.test(s);
  const m = /^(@[^/@\s]+\/[^@\s]+|[^@\s]+)(?:@(.*))?$/.exec(s);
  if (!m) return false;
  const ver = m[2];
  if (ver === undefined || ver === '') return true;
  return /^(?:latest|next|canary|beta|alpha|rc|dev|nightly|insiders|\*|x)$/i.test(ver) || /[\^~<>*|]|(?:^|\.)x(?:\.|$)/i.test(ver);
}

// npx <pkg>@latest is always flagged; a bare <pkg> only with -y/--yes, or in a hook or server
// config, where npx runs without a TTY and installs whatever is newest.
function unpinnedNpx(rest, ctx) {
  const toks = rest.trim().split(/\s+/);
  let yes = ctx === 'hook' || ctx === 'server';
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '-y' || t === '--yes') { yes = true; continue; }
    if (t === '-p' || t === '--package') {
      const spec = toks[++i];
      if (spec && npmSpecUnpinned(spec) && (yes || /@(?:latest|next)\b/.test(spec) || ctx !== 'script')) return spec;
      continue;
    }
    if (t.startsWith('--package=')) {
      const spec = t.slice(10);
      if (npmSpecUnpinned(spec) && (yes || /@(?:latest|next)\b/.test(spec) || ctx !== 'script')) return spec;
      continue;
    }
    if (t === '-c' || t === '--call' || t === '--') return null;
    if (t.startsWith('-')) continue;
    if (!npmSpecUnpinned(t)) return null;
    const explicitFloat = /@[^@/]*$/.test(unquote(t));
    return yes || explicitFloat ? unquote(t) : null;
  }
  return null;
}

function unpinnedUvx(rest) {
  const toks = rest.trim().split(/\s+/);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '--from' || t === '--with') {
      const spec = toks[++i];
      if (spec && pySpecUnpinned(spec)) return spec;
      if (t === '--from') return null;
      continue;
    }
    if (/^(?:-p|--python|--index-url|--extra-index-url|-i)$/.test(t)) { i++; continue; }
    if (t.startsWith('-')) continue;
    return pySpecUnpinned(t) ? unquote(t) : null;
  }
  return null;
}

function pySpecUnpinned(spec) {
  const s = unquote(spec);
  if (!s || /^(?:\.{0,2}[\\/]|~|\$)/.test(s) || /\.(?:whl|tar\.gz|zip)$/i.test(s)) return false;
  if (/^git\+/.test(s)) return !/@[0-9a-f]{7,40}(?:#.*)?$/i.test(s);
  if (/@latest$/i.test(s)) return true;
  if (/@[\w.]+$/.test(s)) return false; // uvx pkg@1.2.3
  return !/===?/.test(s);
}

function unpinnedPip(rest) {
  const toks = rest.trim().split(/\s+/);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (/^(?:-r|--requirement|-c|--constraint|-e|--editable|-i|--index-url|--extra-index-url|-f|--find-links|-t|--target|--prefix|--root|--python-version|--platform)$/.test(t)) { i++; continue; }
    if (t.startsWith('-')) continue;
    if (/^[)\]}]/.test(t)) return null;
    if (pySpecUnpinned(t)) return unquote(t);
  }
  return null;
}

function unpinnedNpmGlobal(rest) {
  for (const t of rest.trim().split(/\s+/)) {
    if (t.startsWith('-')) continue;
    if (npmSpecUnpinned(t)) return unquote(t);
  }
  return null;
}

/* ------------------------------------------------------------------------------------------ */
/* Text utilities                                                                             */
/* ------------------------------------------------------------------------------------------ */

function hostOf(raw) {
  return raw.replace(/:\d+$/, '').replace(/\.+$/, '').toLowerCase();
}

// Long encoded runs are shortened: mixed-case-plus-digit runs, or long hex.
function shortenRun(run) {
  const longest = Math.max(...run.split(/[/_-]/).map((s) => s.length));
  const encoded = (longest >= 20 && /[A-Z]/.test(run) && /[a-z]/.test(run) && /[0-9]/.test(run)) || /^[0-9a-fA-F]{64,}$/.test(run);
  return encoded ? `${run.slice(0, 12)}…[${run.length} chars]` : run;
}

function sanitize(s) {
  return s
    .replace(/^[ \t]+|[ \t]+$/g, '')
    .replace(INVISIBLE_G, (ch) => `<U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}>`)
    .replace(/[ \t  - 　]{8,}/g, (sp) => ` [${sp.length} spaces] `)
    .replace(/[\u0000-\u001F\u007F]/g, (ch) => (ch === '\t' ? ' ' : `<0x${ch.charCodeAt(0).toString(16).padStart(2, '0')}>`))
    .replace(/[A-Za-z0-9+/=_-]{40,}/g, shortenRun)
    .replace(/ {2,}/g, ' ')
    .trim();
}

function clip(s) {
  const clean = sanitize(String(s));
  const chars = Array.from(clean);
  return chars.length > EXCERPT_MAX ? chars.slice(0, EXCERPT_MAX - 1).join('') + '…' : clean;
}

export function excerptAt(text, index = 0) {
  if (text.length <= 200) return clip(text);
  const start = Math.max(0, index - 40);
  return clip((start > 0 ? '…' : '') + text.slice(start, start + 600));
}

function lineOfIndex(text, index) {
  let n = 1;
  for (let i = text.indexOf('\n'); i !== -1 && i < index; i = text.indexOf('\n', i + 1)) n++;
  return n;
}

function lineOfString(text, value, fallback = 1) {
  if (typeof value !== 'string' || !value) return fallback;
  for (const needle of [JSON.stringify(value).slice(1, -1), value, value.slice(0, 40)]) {
    const i = text.indexOf(needle);
    if (i !== -1) return lineOfIndex(text, i);
  }
  return fallback;
}

function lineOfKey(text, key, fallback = 1) {
  const re = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`);
  const m = re.exec(text);
  return m ? lineOfIndex(text, m.index) : fallback;
}

function stripJsonComments(s) {
  let out = '';
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      out += c;
      if (c === '\\') { out += s[i + 1] ?? ''; i++; } else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && s[i + 1] === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i++; continue; }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function parseJson(text) {
  try { return JSON.parse(text.replace(/^﻿/, '')); } catch { /* fall through */ }
  try { return JSON.parse(stripJsonComments(text.replace(/^﻿/, ''))); } catch { return undefined; }
}

// Tolerant YAML frontmatter reader: top-level keys with their value and continuation lines.
function parseFrontmatter(lines) {
  if (!lines.length || lines[0].replace(/^﻿/, '').trim() !== '---') return null;
  let end = -1;
  for (let i = 1; i < lines.length && i < 500; i++) {
    if (/^(?:---|\.\.\.)\s*$/.test(lines[i])) { end = i; break; }
  }
  if (end === -1) return null;
  const keys = {};
  let cur = null;
  for (let i = 1; i < end; i++) {
    const m = /^([A-Za-z0-9_-]+)\s*:(.*)$/.exec(lines[i]);
    if (m) {
      cur = { key: m[1], value: m[2].trim(), line: i + 1, block: [] };
      if (!keys[m[1]]) keys[m[1]] = cur;
    } else if (cur) cur.block.push({ text: lines[i], line: i + 1 });
  }
  return { keys, end };
}

const yamlScalar = (v) => unquote(v.trim()).replace(/\s+#.*$/, '');

function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/* ------------------------------------------------------------------------------------------ */
/* File classification                                                                        */
/* ------------------------------------------------------------------------------------------ */

const SCRIPT_EXTS = new Set('sh bash zsh fish ksh csh ps1 psm1 psd1 bat cmd command js mjs cjs ts mts cts jsx tsx py pyw rb pl pm php lua go rs swift kt kts java cs vbs vb groovy r jl applescript'.split(' '));
const CONFIG_EXTS = new Set('json jsonc json5 yaml yml toml ini cfg conf properties plist'.split(' '));
const MARKDOWNISH = new Set(['md', 'mdx', 'markdown', 'txt', 'rst', '']);
const BINARY_EXTS = new Set('exe dll so dylib bin pyc pyo pyd class jar war ear aar wasm node o a lib obj elf msi dmg pkg deb rpm apk ipa iso img scr sys drv cpl ocx'.split(' '));
const ARCHIVE_EXTS = new Set('zip tar gz tgz bz2 tbz xz txz 7z rar zst lz lz4 lzma cab z'.split(' '));
const DOC_EXTS = new Set('docx docm doc xlsx xlsm xls pptx pptm ppt odt ods odp rtf pdf'.split(' '));

function extOf(rel) {
  const base = path.posix.basename(rel);
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1).toLowerCase() : '';
}

function kindOf(rel, text) {
  const e = extOf(rel);
  const base = path.posix.basename(rel);
  if (SCRIPT_EXTS.has(e) || text.startsWith('#!')) return 'script';
  if (/^\.(?:bash|zsh|ksh|fish|profile)\w*$/.test(base)) return 'script';
  if (CONFIG_EXTS.has(e) || /^\.[\w-]+rc$/.test(base)) return 'config';
  return 'doc';
}

const COMMENT_LINE = /^\s*(?:#(?!!)|\/\/|\/?\*|<!--|--\s|REM\b|::)/i;

/* ------------------------------------------------------------------------------------------ */
/* Scan engine                                                                                */
/* ------------------------------------------------------------------------------------------ */

export class UsageError extends Error {}

export function scan(target, { maxFileBytes = MAX_FILE_BYTES } = {}) {
  if (typeof target !== 'string' || !target) throw new UsageError('no directory given');
  const abs = path.resolve(target);
  let st;
  try { st = fs.statSync(abs); } catch { throw new UsageError(`not found: ${target}`); }
  if (!st.isDirectory()) throw new UsageError(`not a directory: ${target}`);
  const root = fs.realpathSync(abs);

  const state = {
    root,
    findings: [],
    byKey: new Map(),
    perRuleFile: new Map(),
    omitted: {},
    hosts: new Set(),
    files: [],
    fileSet: new Set(),
    refs: { hooks: new Map(), mcp: new Map(), lsp: new Map() }, // rel -> plugin root
    hookRefs: [],
    filesScanned: 0,
    maxFileBytes,
  };

  walk(state);
  prepass(state);
  for (const entry of state.files) scanFile(state, entry);
  postpass(state);
  return report(state, abs);
}

function addFinding(state, f) {
  const rule = RULE_BY_ID[f.rule];
  const finding = {
    rule: f.rule,
    severity: f.severity || rule.severity,
    file: f.file,
    line: f.line ?? 0,
    excerpt: clip(f.excerpt ?? ''),
    why: rule.why,
  };
  if (f.detail) finding.detail = clip(f.detail);
  const key = [finding.rule, finding.file, finding.line, ITEM_RULES.has(finding.rule) ? finding.excerpt : ''].join('\u0000');
  const prev = state.byKey.get(key);
  if (prev) {
    if (RANK[finding.severity] > RANK[prev.severity]) {
      prev.severity = finding.severity;
      if (finding.detail) prev.detail = finding.detail;
    } else if (finding.detail && !prev.detail) prev.detail = finding.detail;
    return prev;
  }
  const capKey = `${finding.rule}\u0000${finding.file}`;
  const n = state.perRuleFile.get(capKey) || 0;
  if (n >= PER_RULE_FILE_CAP) {
    const k = `${finding.file} ${finding.rule}`;
    state.omitted[k] = (state.omitted[k] || 0) + 1;
    return null;
  }
  state.perRuleFile.set(capKey, n + 1);
  state.byKey.set(key, finding);
  state.findings.push(finding);
  return finding;
}

function walk(state) {
  const { root } = state;
  const stack = [''];
  while (stack.length) {
    const relDir = stack.pop();
    const absDir = relDir ? path.join(root, ...relDir.split('/')) : root;
    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch (err) {
      addFinding(state, { rule: 'opaque-file', file: relDir || '.', excerpt: `${relDir || '.'}/ (unreadable directory)`, detail: err.code || 'read error' });
      continue;
    }
    for (const d of entries) {
      const rel = relDir ? `${relDir}/${d.name}` : d.name;
      const abs = path.join(absDir, d.name);
      if (d.isSymbolicLink()) { reportSymlink(state, rel, abs); continue; }
      if (d.isDirectory()) { if (d.name !== '.git') stack.push(rel); continue; }
      if (d.isFile()) { state.files.push({ rel, abs }); state.fileSet.add(rel); continue; }
      addFinding(state, { rule: 'opaque-file', file: rel, excerpt: `${rel} (not a regular file; never opened)` });
    }
  }
  state.files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

function reportSymlink(state, rel, abs) {
  let link = '';
  try { link = fs.readlinkSync(abs); } catch { /* unreadable link */ }
  const resolved = path.resolve(path.dirname(abs), link);
  const inside = link !== '' && (resolved === state.root || resolved.startsWith(state.root + path.sep));
  addFinding(state, {
    rule: 'symlink',
    severity: inside ? 'info' : 'high',
    file: rel,
    excerpt: `${rel} -> ${link || '?'}`,
    detail: inside ? 'points inside the package; not followed' : 'points outside the package; not followed',
  });
}

// Read plugin manifests first, so files they point at (custom hook, MCP and LSP configs) are
// parsed as such wherever they sit in the walk.
function prepass(state) {
  for (const entry of state.files) {
    if (!/(?:^|\/)\.claude-plugin\/plugin\.json$/.test(entry.rel)) continue;
    const buf = readSafely(state, entry);
    if (!buf) continue;
    const json = parseJson(buf.toString('utf8'));
    if (!json || typeof json !== 'object') continue;
    const pluginRoot = path.posix.dirname(path.posix.dirname(entry.rel));
    for (const [key, kind] of [['hooks', 'hooks'], ['mcpServers', 'mcp'], ['lspServers', 'lsp']]) {
      const v = json[key];
      for (const p of Array.isArray(v) ? v : [v]) {
        if (typeof p !== 'string') continue;
        const rel = path.posix.normalize(path.posix.join(pluginRoot === '.' ? '' : pluginRoot, p.replace(/^\$\{CLAUDE_PLUGIN_ROOT\}\/?/, '')));
        if (state.fileSet.has(rel)) state.refs[kind].set(rel, pluginRoot);
      }
    }
  }
}

function readSafely(state, entry) {
  let fd;
  try {
    const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
    fd = fs.openSync(entry.abs, flags);
    const st = fs.fstatSync(fd);
    if (!st.isFile() || st.size > state.maxFileBytes) return null;
    const buf = Buffer.alloc(st.size);
    let off = 0;
    while (off < st.size) {
      const n = fs.readSync(fd, buf, off, st.size - off, off);
      if (n === 0) break;
      off += n;
    }
    return buf.subarray(0, off);
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function scanFile(state, entry) {
  state.filesScanned++;
  const { rel } = entry;
  let st;
  try { st = fs.lstatSync(entry.abs); } catch { addFinding(state, { rule: 'opaque-file', file: rel, excerpt: `${rel} (could not stat)` }); return; }
  if (!st.isFile()) return;
  if (st.size > state.maxFileBytes) {
    addFinding(state, { rule: 'opaque-large-file', file: rel, excerpt: `${rel} (${(st.size / 1048576).toFixed(1)} MB, not read)` });
    return;
  }
  const buf = readSafely(state, entry);
  if (!buf) { addFinding(state, { rule: 'opaque-file', file: rel, excerpt: `${rel} (could not be read)` }); return; }

  const ext = extOf(rel);
  if (MEDIA_CHECK[ext]) {
    if (MEDIA_CHECK[ext](buf)) addFinding(state, { rule: 'media-file', file: rel, excerpt: `${rel} (${buf.length} bytes)` });
    else addFinding(state, { rule: 'opaque-file', file: rel, excerpt: `${rel} (${buf.length} bytes)`, detail: `extension says .${ext} but the content is not` });
    return;
  }
  if (BINARY_EXTS.has(ext) || ARCHIVE_EXTS.has(ext) || DOC_EXTS.has(ext)) {
    const what = BINARY_EXTS.has(ext) ? 'binary' : ARCHIVE_EXTS.has(ext) ? 'archive' : 'document';
    addFinding(state, { rule: 'opaque-file', file: rel, excerpt: `${rel} (${buf.length} bytes)`, detail: `${what} (.${ext})` });
    return;
  }
  if (buf.includes(0)) {
    const utf16 = (buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff);
    addFinding(state, { rule: 'opaque-file', file: rel, excerpt: `${rel} (${buf.length} bytes)`, detail: utf16 ? 'UTF-16 text, unreadable to text scanners' : 'binary content (null bytes)' });
    return;
  }

  const text = buf.toString('utf8');
  const lines = text.split('\n').map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
  const kind = kindOf(rel, text);
  const file = { rel, ext, kind, text, lines, base: path.posix.basename(rel) };
  let json;
  let fm;
  file.json = () => (json === undefined ? (json = CONFIG_EXTS.has(ext) ? parseJson(text) ?? null : null) : json);
  file.frontmatter = () => (fm === undefined ? (fm = ext === 'md' || ext === 'mdx' || ext === 'markdown' ? parseFrontmatter(lines) : null) : fm);

  for (const m of text.matchAll(/\b(?:https?|wss?|ftp):\/\/([A-Za-z0-9.-]+(?::\d+)?)/g)) {
    const h = hostOf(m[1]);
    if (h.includes('.') || h === 'localhost') if (!NAMESPACE_HOSTS.test(h)) state.hosts.add(h);
  }

  // Line rules
  const markdownish = MARKDOWNISH.has(ext);
  let section = '';
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (kind === 'doc' && markdownish) {
      if (/^\s{0,3}(?:```|~~~)/.test(line)) inFence = !inFence;
      else if (!inFence) {
        const h = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line) || /^\s*\*\*([^*]{2,60})\*\*:?\s*$/.exec(line);
        if (h) section = h[1];
      }
    }
    if (!line) continue;
    const lc = { ctx: kind, lineNo: i + 1, section, inFence, isComment: kind !== 'doc' && COMMENT_LINE.test(line) };
    matchLine(line, lc, (hit) => addFinding(state, { rule: hit.rule, severity: hit.severity, file: rel, line: i + 1, excerpt: excerptAt(line, hit.index), detail: hit.detail }));
  }

  // Structural rules
  const api = {
    state,
    add: (f) => addFinding(state, { file: rel, ...f }),
    command: (lineNo, cmd, ctx) => evalCommand(state, rel, lineNo, cmd, ctx),
  };
  for (const r of RULES) if (r.check) r.check(file, api);
}

function matchLine(text, lc, sink) {
  const chunks = text.length > WINDOW ? [] : [[text, 0]];
  if (text.length > WINDOW) for (let s = 0; s < text.length; s += WINDOW - 1000) chunks.push([text.slice(s, s + WINDOW), s]);
  for (const { rule, patterns } of LINE_RULES) {
    const ruleCtx = rule.contexts;
    let hit = null;
    for (const p of patterns) {
      const contexts = p.contexts || ruleCtx;
      if (contexts && !contexts.includes(lc.ctx)) continue;
      const accept = p.accept || rule.accept;
      const sev = p.sev || rule.sev;
      for (const [chunk, offset] of chunks) {
        for (const m of chunk.matchAll(p.re)) {
          if (accept && !accept(m, chunk, lc)) continue;
          const severity = sev ? sev(m, chunk, lc) : rule.severity;
          if (!severity) continue;
          hit = { rule: rule.id, severity, index: m.index + offset, detail: m.detail };
          break;
        }
        if (hit) break;
      }
      if (hit) break;
    }
    if (hit) sink(hit);
  }
}

// Run the line rules over a command a config will execute (hook, MCP/LSP server, npm script).
function evalCommand(state, rel, lineNo, cmd, ctx) {
  const hits = [];
  if (typeof cmd !== 'string' || !cmd) return hits;
  for (const m of cmd.matchAll(/\b(?:https?|wss?):\/\/([A-Za-z0-9.-]+(?::\d+)?)/g)) {
    const h = hostOf(m[1]);
    if (h.includes('.') || h === 'localhost') state.hosts.add(h);
  }
  for (const line of cmd.split('\n')) {
    if (!line.trim()) continue;
    matchLine(line, { ctx, lineNo, section: '', inFence: false, isComment: false }, (hit) => {
      hits.push(hit);
      addFinding(state, { rule: hit.rule, severity: hit.severity, file: rel, line: lineNo, excerpt: excerptAt(line, hit.index), detail: hit.detail });
    });
  }
  return hits;
}

const highOf = (hits) => [...new Set(hits.filter((h) => h.severity === 'high').map((h) => h.rule))];

/* --- structural checks --- */

function checkSecretEnv(file, api) {
  if (!/\$|env/.test(file.text)) return;
  const net = [];
  file.lines.forEach((l, i) => { if (NET_OUT.test(l)) net.push(i); });
  if (!net.length) return;
  file.lines.forEach((line, i) => {
    let hit = null;
    for (const m of line.matchAll(SECRET_ENV_REF)) {
      if (SECRET_NAME.test(m[1])) { hit = { index: m.index, name: m[1] }; break; }
    }
    if (!hit) {
      const d = ENV_DUMP.exec(line);
      if (d) hit = { index: d.index, name: 'the whole environment' };
    }
    if (!hit) return;
    const near = file.kind === 'doc' ? net.find((n) => Math.abs(n - i) <= 8) : net[0];
    if (near === undefined) return;
    api.add({ rule: 'secret-path-read', line: i + 1, excerpt: excerptAt(line, hit.index), detail: `reads ${hit.name}; network use at line ${near + 1}` });
  });
}

function checkShippedSettings(file, api) {
  if (!/(?:^|\/)\.claude\/settings(?:\.local)?\.json$/.test(file.rel)) return;
  const json = file.json();
  if (!json || typeof json !== 'object') return;
  const keys = ['permissions', 'hooks', 'env', 'apiKeyHelper', 'statusLine', 'enabledPlugins', 'extraKnownMarketplaces', 'enableAllProjectMcpServers', 'enabledMcpjsonServers', 'defaultMode'].filter((k) => k in json);
  if (!keys.length) return;
  api.add({ rule: 'config-tamper', line: lineOfKey(file.text, keys[0]), excerpt: `${file.rel} sets ${keys.join(', ')}`, detail: 'ships Claude Code project settings that apply when this folder is opened' });
}

function pluginRootFor(state, rel) {
  let dir = path.posix.dirname(rel);
  while (true) {
    const probe = dir === '.' ? '.claude-plugin/plugin.json' : `${dir}/.claude-plugin/plugin.json`;
    if (state.fileSet.has(probe)) return dir;
    if (dir === '.' || dir === '') return '.';
    dir = path.posix.dirname(dir);
  }
}

function scriptRefs(state, cmd, bases) {
  const refs = new Set();
  const re = /(?:\$\{?CLAUDE_PLUGIN_ROOT\}?|\$\{?CLAUDE_PROJECT_DIR\}?|\$\{?CLAUDE_SKILL_DIR\}?)?[\\/]?((?:[\w.@-]+[\\/])*[\w.@-]+\.(?:sh|bash|zsh|js|mjs|cjs|ts|mts|py|rb|pl|ps1|bat|cmd))\b/g;
  for (const m of cmd.matchAll(re)) {
    const ref = m[1].replace(/\\/g, '/').replace(/^\.\//, '');
    for (const base of bases) {
      const rel = path.posix.normalize(base === '.' || base === '' ? ref : `${base}/${ref}`);
      if (state.fileSet.has(rel)) refs.add(rel);
    }
  }
  return [...refs];
}

function* hooksIn(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  const config = obj.hooks && typeof obj.hooks === 'object' && !Array.isArray(obj.hooks) ? obj.hooks : obj;
  for (const [event, groups] of Object.entries(config)) {
    if (!/^[A-Z]/.test(event) || !Array.isArray(groups)) continue;
    for (const g of groups) {
      if (!g || typeof g !== 'object') continue;
      for (const h of Array.isArray(g.hooks) ? g.hooks : [g]) {
        if (!h || typeof h !== 'object') continue;
        yield { event, matcher: typeof g.matcher === 'string' ? g.matcher : '', type: h.type || 'command', command: h.command, url: h.url, prompt: h.prompt };
      }
    }
  }
}

function emitHook(file, api, h, lineNo, pluginRoot) {
  const body = h.command || h.url || h.prompt || '';
  const label = `${h.event}${h.matcher ? ` [${h.matcher}]` : ''}`;
  const hits = api.command(lineNo, String(body), 'hook');
  const high = highOf(hits);
  const finding = api.add({
    rule: 'hooks',
    severity: high.length ? 'high' : 'medium',
    line: lineNo,
    excerpt: `${label}: ${h.type !== 'command' ? `(${h.type}) ` : ''}${body}`,
    detail: high.length ? `escalated: the command matches ${high.join(', ')}` : undefined,
  });
  if (finding && typeof h.command === 'string') {
    const refs = scriptRefs(api.state, h.command, [pluginRoot, path.posix.dirname(file.rel), '.']);
    if (refs.length) api.state.hookRefs.push({ finding, refs });
  }
}

function checkHooks(file, api) {
  const { state } = api;
  const isPluginJson = /(?:^|\/)\.claude-plugin\/plugin\.json$/.test(file.rel);
  const isHooksJson = /(?:^|\/)hooks\/hooks\.json$/.test(file.rel) || state.refs.hooks.has(file.rel);
  const isSettings = /(?:^|\/)\.claude\/settings(?:\.local)?\.json$/.test(file.rel);
  const isMarketplace = /(?:^|\/)\.claude-plugin\/marketplace\.json$/.test(file.rel);

  if (isPluginJson || isHooksJson || isSettings || isMarketplace) {
    const json = file.json();
    if (!json || typeof json !== 'object') return;
    let sources = [];
    let pluginRoot = pluginRootFor(state, file.rel);
    if (isHooksJson) {
      sources = [json];
      pluginRoot = state.refs.hooks.get(file.rel) ?? path.posix.dirname(path.posix.dirname(file.rel));
    } else if (isPluginJson) {
      const v = json.hooks;
      sources = (Array.isArray(v) ? v : [v]).filter((x) => x && typeof x === 'object');
      pluginRoot = path.posix.dirname(path.posix.dirname(file.rel));
    } else if (isSettings) {
      if (json.hooks && typeof json.hooks === 'object') sources = [json.hooks];
      pluginRoot = path.posix.dirname(path.posix.dirname(file.rel));
    } else if (isMarketplace && Array.isArray(json.plugins)) {
      sources = json.plugins.map((p) => p && p.hooks).filter((x) => x && typeof x === 'object');
    }
    for (const src of sources) {
      for (const h of hooksIn(src)) {
        const lineNo = lineOfString(file.text, h.command || h.url || h.prompt, lineOfKey(file.text, h.event));
        emitHook(file, api, h, lineNo, pluginRoot);
      }
    }
    return;
  }

  const fm = file.frontmatter();
  const entry = fm && fm.keys.hooks;
  if (!entry) return;
  const pluginRoot = pluginRootFor(state, file.rel);
  if (entry.value && entry.value.startsWith('{')) {
    const inline = parseJson(entry.value);
    for (const h of hooksIn(inline)) emitHook(file, api, h, entry.line, pluginRoot);
    return;
  }
  // Block YAML: event keys at the first indent, `command:` lines beneath them.
  let event = '';
  let matcher = '';
  let eventIndent = -1;
  let found = false;
  for (const { text, line } of entry.block) {
    const ev = /^(\s+)([A-Z][A-Za-z]+)\s*:\s*$/.exec(text);
    if (ev && (eventIndent === -1 || ev[1].length <= eventIndent)) { eventIndent = ev[1].length; event = ev[2]; matcher = ''; continue; }
    const mt = /^\s*-?\s*matcher\s*:\s*(.+)$/.exec(text);
    if (mt) { matcher = yamlScalar(mt[1]); continue; }
    const cm = /^\s*-?\s*(command|url|prompt)\s*:\s*(.+)$/.exec(text);
    if (cm) {
      found = true;
      const value = yamlScalar(cm[2]);
      emitHook(file, api, { event: event || 'hook', matcher, type: cm[1] === 'command' ? 'command' : cm[1] === 'url' ? 'http' : 'prompt', [cm[1]]: value }, line, pluginRoot);
    }
  }
  if (!found) api.add({ rule: 'hooks', line: entry.line, excerpt: `hooks: ${entry.value || entry.block.map((b) => b.text.trim()).join(' ')}` });
}

function checkInlineExec(file, api) {
  if (file.kind !== 'doc' || !['md', 'mdx', 'markdown'].includes(file.ext)) return;
  let inFence = false;
  let execFence = false;
  file.lines.forEach((line, i) => {
    const fence = /^\s{0,3}(?:```|~~~)(.*)$/.exec(line);
    if (fence) {
      if (!inFence) { inFence = true; execFence = fence[1].trim().startsWith('!'); } else { inFence = false; execFence = false; }
      return;
    }
    const cmds = [];
    if (execFence) cmds.push(line);
    else if (!inFence) for (const m of line.matchAll(/(?:^|[\s(])!`([^`\n]+)`/g)) cmds.push(m[1]);
    for (const cmd of cmds) {
      if (!cmd.trim()) continue;
      const high = highOf(api.command(i + 1, cmd, 'hook'));
      api.add({ rule: 'inline-exec', severity: high.length ? 'high' : 'medium', line: i + 1, excerpt: `!\`${cmd}\``, detail: high.length ? `escalated: the command matches ${high.join(', ')}` : undefined });
    }
  });
}

function serversIn(json, key) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  const v = json[key];
  const obj = v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  const looks = (o) => o && typeof o === 'object' && Object.values(o).length > 0 && Object.values(o).every((s) => s && typeof s === 'object' && ('command' in s || 'url' in s || 'type' in s));
  if (obj) return Object.entries(obj);
  if (looks(json)) return Object.entries(json);
  return [];
}

function checkServers(file, api, kind) {
  if (file.kind !== 'config') return;
  const key = kind === 'mcp' ? 'mcpServers' : 'lspServers';
  const rule = kind === 'mcp' ? 'mcp-server' : 'lsp-server';
  const named = kind === 'mcp' ? /(?:^|\/)\.mcp\.json$/ : /(?:^|\/)\.lsp\.json$/;
  const json = file.json();
  if (!json || typeof json !== 'object') return;
  let servers = [];
  if (named.test(file.rel) || api.state.refs[kind].has(file.rel)) servers = serversIn(json, key);
  else if (json[key] && typeof json[key] === 'object' && !Array.isArray(json[key])) servers = Object.entries(json[key]);
  if (/(?:^|\/)\.claude-plugin\/marketplace\.json$/.test(file.rel) && Array.isArray(json.plugins)) {
    for (const p of json.plugins) if (p && p[key] && typeof p[key] === 'object' && !Array.isArray(p[key])) servers.push(...Object.entries(p[key]));
  }
  for (const [name, s] of servers) {
    if (!s || typeof s !== 'object') continue;
    const lineNo = lineOfKey(file.text, name);
    const args = Array.isArray(s.args) ? s.args.filter((a) => typeof a === 'string') : [];
    const cmd = [typeof s.command === 'string' ? s.command : '', ...args].join(' ').trim();
    const target = cmd || [s.type, s.url].filter((x) => typeof x === 'string').join(' ');
    if (cmd) api.command(lineNo, cmd, 'server');
    if (typeof s.url === 'string') api.command(lineNo, s.url, 'server');
    api.add({ rule, line: lineNo, excerpt: `${name}: ${target || '(no command)'}` });
  }
}

function checkPackageJson(file, api) {
  if (file.base !== 'package.json') return;
  const json = file.json();
  if (!json || typeof json.scripts !== 'object' || !json.scripts) return;
  for (const [name, value] of Object.entries(json.scripts)) {
    if (typeof value !== 'string') continue;
    const lineNo = lineOfKey(file.text, name);
    api.command(lineNo, value, 'script');
    if (['preinstall', 'install', 'postinstall', 'prepare'].includes(name)) api.add({ rule: 'install-script', line: lineNo, excerpt: `${name}: ${value}` });
  }
}

function checkDocLinks(file, api) {
  if (file.kind !== 'doc') return;
  const hosts = new Set();
  let first = 0;
  let firstLine = '';
  let firstIndex = 0;
  file.lines.forEach((line, i) => {
    for (const m of line.matchAll(/\b(?:https?|wss?):\/\/([A-Za-z0-9.-]+(?::\d+)?)/g)) {
      const h = hostOf(m[1]);
      if (NAMESPACE_HOSTS.test(h) || !(h.includes('.') || h === 'localhost')) continue;
      if (!first) { first = i + 1; firstLine = line; firstIndex = m.index; }
      hosts.add(h);
    }
  });
  if (!first) return;
  const list = [...hosts].sort();
  api.add({ rule: 'network-call', severity: 'info', line: first, excerpt: excerptAt(firstLine, firstIndex), detail: `links to ${list.length} host${list.length === 1 ? '' : 's'}: ${list.join(', ')}` });
}

function checkBlankRuns(file, api) {
  let start = -1;
  const flush = (end) => {
    const n = end - start;
    if (start !== -1 && n >= 300) {
      const next = file.lines.slice(end).find((l) => l.trim()) ?? '(end of file)';
      api.add({ rule: 'obfuscation', line: start + 1, excerpt: `[${n} blank lines] then: ${next}`, detail: `padding of ${n} blank lines` });
    }
    start = -1;
  };
  file.lines.forEach((l, i) => {
    if (!l.trim()) { if (start === -1) start = i; } else if (start !== -1) flush(i);
  });
  if (start !== -1) flush(file.lines.length);
}

function toolTokens(entry) {
  let items;
  const v = entry.value;
  if (!v || v === '|' || v === '>') {
    items = entry.block.map((b) => b.text.trim()).filter((t) => t.startsWith('- ')).map((t) => t.slice(2));
  } else {
    items = [];
    let depth = 0;
    let cur = '';
    for (const ch of v.replace(/^\[|\]$/g, '')) {
      if (ch === '(') depth++;
      if (ch === ')') depth = Math.max(0, depth - 1);
      if (depth === 0 && (ch === ',' || /\s/.test(ch))) { if (cur) items.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur) items.push(cur);
  }
  return items.map((t) => unquote(t.trim())).filter(Boolean);
}

const BROAD_TOOL = /^(?:\*|Bash|PowerShell|(?:Bash|PowerShell)\(\s*(?:\*|:\*|\*:\*|\*\*)?\s*\))$/;

function checkBroadTools(file, api) {
  const fm = file.frontmatter();
  if (fm) {
    for (const key of ['allowed-tools', 'allowedTools', 'tools']) {
      const entry = fm.keys[key];
      if (!entry) continue;
      const broad = toolTokens(entry).filter((t) => BROAD_TOOL.test(t));
      if (broad.length) api.add({ rule: 'broad-tools', line: entry.line, excerpt: `${key}: ${entry.value || toolTokens(entry).join(', ')}`, detail: `unrestricted: ${broad.join(', ')}` });
    }
  }
  if (/(?:^|\/)\.claude\/settings(?:\.local)?\.json$/.test(file.rel)) {
    const allow = file.json()?.permissions?.allow;
    if (Array.isArray(allow)) {
      const broad = allow.filter((t) => typeof t === 'string' && BROAD_TOOL.test(t));
      if (broad.length) api.add({ rule: 'broad-tools', line: lineOfKey(file.text, 'allow'), excerpt: `permissions.allow: ${allow.join(', ')}`, detail: `unrestricted: ${broad.join(', ')}` });
    }
  }
}

function checkTyposquat(file, api) {
  const names = [];
  const fm = file.frontmatter();
  if (fm && fm.keys.name) names.push({ name: yamlScalar(fm.keys.name.value), line: fm.keys.name.line });
  if (/(?:^|\/)(?:\.claude-plugin\/(?:plugin|marketplace)\.json|package\.json)$/.test(file.rel)) {
    const json = file.json();
    if (json && typeof json.name === 'string') names.push({ name: json.name, line: lineOfKey(file.text, 'name') });
    if (json && Array.isArray(json.plugins)) {
      for (const p of json.plugins) if (p && typeof p.name === 'string') names.push({ name: p.name, line: lineOfString(file.text, p.name) });
    }
  }
  for (const { name, line } of names) {
    const n = name.toLowerCase().replace(/^@[^/]+\//, '');
    if (n.length < 5) continue;
    for (const known of WELL_KNOWN) {
      const d = editDistance(n, known, 2);
      if (d >= 1 && d <= 2) api.add({ rule: 'typosquat-hint', line, excerpt: `name: ${name}`, detail: `${d} edit${d === 1 ? '' : 's'} from "${known}"` });
    }
  }
}

function postpass(state) {
  for (const { finding, refs } of state.hookRefs) {
    const high = [...new Set(state.findings.filter((f) => refs.includes(f.file) && f.severity === 'high' && f.rule !== 'hooks').map((f) => f.rule))];
    const note = `runs ${refs.join(', ')}`;
    if (high.length) {
      finding.severity = 'high';
      finding.detail = clip(`${finding.detail ? finding.detail + '; ' : ''}escalated: ${note}, which has high findings (${high.join(', ')})`);
    } else if (!finding.detail) finding.detail = clip(note);
  }
}

function report(state, target) {
  const findings = state.findings.sort((a, b) => RANK[b.severity] - RANK[a.severity] || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || a.line - b.line || (a.rule < b.rule ? -1 : 1));
  const counts = { high: 0, medium: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  const floor = counts.high ? 'High' : counts.medium ? 'Medium' : 'Low';
  const out = { target, filesScanned: state.filesScanned, findings, counts, floor, hosts: [...state.hosts].sort() };
  if (Object.keys(state.omitted).length) out.omitted = state.omitted;
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* Output and CLI                                                                             */
/* ------------------------------------------------------------------------------------------ */

export function formatText(r) {
  const out = [`vet-skill scan: ${r.target}`, `${r.filesScanned} files scanned; ${r.counts.high} high, ${r.counts.medium} medium, ${r.counts.info} info`];
  for (const sev of SEVERITIES) {
    const list = r.findings.filter((f) => f.severity === sev);
    if (!list.length) continue;
    out.push('', `${sev.toUpperCase()} (${list.length})`);
    const byRule = new Map();
    for (const f of list) byRule.set(f.rule, [...(byRule.get(f.rule) || []), f]);
    for (const [rule, items] of byRule) {
      out.push(`  ${rule} (${items.length}): ${RULE_BY_ID[rule].why}`);
      const limit = sev === 'info' ? 5 : 12;
      for (const f of items.slice(0, limit)) out.push(`    ${f.file}${f.line ? `:${f.line}` : ''}  ${f.excerpt}${f.detail ? `  [${f.detail}]` : ''}`);
      if (items.length > limit) out.push(`    ... ${items.length - limit} more (use --json)`);
    }
  }
  if (r.hosts.length) out.push('', `hosts (${r.hosts.length}): ${r.hosts.slice(0, 40).join(', ')}${r.hosts.length > 40 ? ', ...' : ''}`);
  if (r.omitted) out.push('', `omitted beyond ${PER_RULE_FILE_CAP} per rule per file: ${Object.entries(r.omitted).map(([k, n]) => `${k} (${n})`).join('; ')}`);
  out.push('', `floor: ${r.floor} (the lowest rating the scout may give)`);
  return out.join('\n') + '\n';
}

const USAGE = 'usage: node scan.mjs <dir> [--json]\n';

export function main(argv) {
  let json = false;
  let dir = null;
  for (const a of argv) {
    if (a === '--json') json = true;
    else if (a === '-h' || a === '--help') { process.stdout.write(USAGE); return 0; }
    else if (a.startsWith('-')) { process.stderr.write(`unknown option: ${a}\n${USAGE}`); return 2; }
    else if (dir === null) dir = a;
    else { process.stderr.write(`one directory only\n${USAGE}`); return 2; }
  }
  if (dir === null) { process.stderr.write(USAGE); return 2; }
  let result;
  try {
    result = scan(dir);
  } catch (err) {
    if (err instanceof UsageError) { process.stderr.write(`${err.message}\n${USAGE}`); return 2; }
    throw err;
  }
  process.stdout.write(json ? JSON.stringify(result, null, 2) + '\n' : formatText(result));
  return 0;
}

const invokedDirectly = (() => {
  try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (invokedDirectly) process.exitCode = main(process.argv.slice(2));

// Minimal, lossless frontmatter editing for SKILL.md files.
// Only top-level keys are touched; the body after the closing `---` is never altered.

export function splitFrontmatter(text) {
  if (!text.startsWith('---\n')) throw new Error('missing frontmatter opening ---');
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) throw new Error('missing frontmatter closing ---');
  return {
    frontmatter: text.slice(4, end + 1), // includes trailing newline of last key
    body: text.slice(end + 5),
  };
}

// Parse top-level keys into ordered blocks: { key, lines[] } (continuation lines stay with their key).
function blocks(frontmatter) {
  const out = [];
  for (const line of frontmatter.split('\n')) {
    if (line === '' && out.length === 0) continue;
    const m = /^([A-Za-z0-9_-]+):/.exec(line);
    if (m) out.push({ key: m[1], lines: [line] });
    else if (out.length) out[out.length - 1].lines.push(line);
  }
  // drop the empty string produced by the trailing newline
  const last = out[out.length - 1];
  if (last && last.lines[last.lines.length - 1] === '') last.lines.pop();
  return out;
}

export function readKey(frontmatter, key) {
  const b = blocks(frontmatter).find((x) => x.key === key);
  if (!b) return undefined;
  const raw = b.lines.join('\n').slice(key.length + 1).trim();
  if (raw.startsWith('"')) return JSON.parse(raw);
  if (raw.startsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
  return raw;
}

// YAML double-quoted scalars accept JSON string escapes.
const quote = (value) => JSON.stringify(value);

export function patchFrontmatter(frontmatter, { remove = [], set = {}, setIfAbsent = {} } = {}) {
  let bs = blocks(frontmatter).filter((b) => !remove.includes(b.key));
  for (const [key, value] of Object.entries(set)) {
    const line = `${key}: ${quote(value)}`;
    const i = bs.findIndex((b) => b.key === key);
    if (i === -1) bs.push({ key, lines: [line] });
    else bs[i] = { key, lines: [line] };
  }
  for (const [key, value] of Object.entries(setIfAbsent)) {
    if (!bs.some((b) => b.key === key)) bs.push({ key, lines: [`${key}: ${value}`] });
  }
  return bs.map((b) => b.lines.join('\n')).join('\n') + '\n';
}

export function joinFrontmatter(frontmatter, body) {
  return `---\n${frontmatter}---\n${body}`;
}

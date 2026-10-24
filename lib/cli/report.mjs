// One line per item, then a final line. Counts drive the summary and the exit code.

const DRY = [
  [/^installed/, 'would install'],
  [/^updated/, 'would update'],
  [/^removed/, 'would remove'],
  [/^re-pinned/, 'would re-pin'],
];

export function createTally(out, { dryRun = false } = {}) {
  const counts = { changed: 0, present: 0, skipped: 0, failed: 0 };
  const rows = [];
  const emit = (id, status, kind) => {
    counts[kind]++;
    rows.push({ id, status, kind });
    out.line(`${id}: ${status}`);
  };
  return {
    counts,
    rows,
    change(id, label) {
      let l = label;
      if (dryRun) for (const [re, sub] of DRY) l = l.replace(re, sub);
      emit(id, l, 'changed');
    },
    present: (id, label) => emit(id, label, 'present'),
    skip: (id, why) => emit(id, `skipped: ${why}`, 'skipped'),
    fail: (id, why) => emit(id, `failed: ${why}`, 'failed'),
  };
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

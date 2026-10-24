// `crew doctor`: what is present, how, and what is off. Exit 1 when crew or a required dependency
// is missing (or preflight fails); warnings never fail. Offline: it reads local state only.

import { CREW_MARKETPLACE, CREW_PLUGIN, OFFICIAL, select } from './context.mjs';
import {
  binaryNote, detect, duplicateText, inventory, mcpNamesOf, preflight, presentLabel,
} from './inventory.mjs';
import { plural } from './report.mjs';
import { describeEntry, impliedVersion, sourceMatches } from './source.mjs';

function row(id, kind, extra = {}) {
  return { id, kind, required: false, present: false, how: null, version: null, vetted: null, label: '', warnings: [], errors: [], ...extra };
}

export function doctor(ctx) {
  const pf = preflight(ctx);
  const rows = [];
  const report = { ok: false, preflight: pf, items: rows, errors: 0, warnings: 0 };

  const finish = () => {
    report.errors = rows.reduce((n, r) => n + r.errors.length, 0) + (pf.ok ? 0 : pf.problems.length);
    report.warnings = rows.reduce((n, r) => n + r.warnings.length, 0);
    report.ok = report.errors === 0;
    for (const r of rows) r.status = r.errors.length ? 'error' : r.warnings.length ? 'warning' : 'ok';
    if (ctx.flags.json) {
      ctx.out.line(JSON.stringify(report, null, 2));
    } else {
      ctx.out.line(pf.ok
        ? `preflight: ok (node ${pf.node}, claude ${pf.claude}, git ${pf.git})`
        : pf.problems.map((p) => `preflight failed: ${p}`).join('\n'));
      for (const r of rows) {
        const notes = [...r.errors.map((e) => `error: ${e}`), ...r.warnings.map((w) => `warning: ${w}`)];
        ctx.out.line(`${r.id}: ${[r.label, ...notes].filter(Boolean).join('; ')}`);
      }
      const counts = `${plural(report.errors, 'error')}, ${plural(report.warnings, 'warning')}`;
      ctx.out.line(report.ok
        ? `doctor: ok (${counts}).`
        : `doctor: problems found (${counts}). Run crew install to fill the gaps.`);
    }
    return report.ok ? 0 : 1;
  };

  if (!pf.claude) return finish();

  const sel = select(ctx);
  let inv;
  try {
    inv = inventory(ctx, { mcpNames: sel.items.filter((i) => i.kind === 'mcp').flatMap(mcpNamesOf) });
  } catch (e) {
    rows.push(row('inventory', 'internal', { label: 'failed', errors: [e.message] }));
    return finish();
  }

  // The official marketplace is where missing dependencies install from.
  const official = inv.marketplaces.find((m) => m.name === OFFICIAL);
  if (!ctx.flags.only) {
    rows.push(row(OFFICIAL, 'marketplace', official
      ? { present: true, how: 'marketplace', label: 'present: marketplace' }
      : { label: 'missing', warnings: ['crew install adds it before installing any missing dependency'] }));
  }

  if (sel.crew) {
    const expectedVersion = impliedVersion(ctx.source, ctx.pkg.version);
    const entry = inv.marketplaces.find((m) => m.name === CREW_MARKETPLACE);
    const plugin = inv.plugins.find((p) => p.id === CREW_PLUGIN);
    const r = row('crew', 'plugin', { required: true, vetted: expectedVersion, source: entry ? describeEntry(entry) : null });
    if (!entry) r.errors.push('crew marketplace missing');
    else if (!sourceMatches(entry, ctx.source)) r.warnings.push(`marketplace pinned to ${describeEntry(entry)}; this package expects ${ctx.source.spec} (run crew update)`);
    if (!plugin) {
      r.label = 'missing';
      r.errors.push(`plugin ${CREW_PLUGIN} not installed`);
    } else {
      Object.assign(r, { present: true, how: 'plugin', version: plugin.version });
      r.label = `present: plugin (${plugin.version})${entry ? ` from ${describeEntry(entry)}` : ''}`;
      if (plugin.version !== expectedVersion) r.warnings.push(`crew ${plugin.version} installed; this package is ${expectedVersion} (run crew update)`);
      if (plugin.enabled === false) r.warnings.push('disabled (claude plugin enable crew@crew)');
    }
    rows.push(r);
  }

  for (const item of sel.items) {
    const det = detect(ctx, inv, item);
    const required = item.required === true;
    const r = row(item.id, item.kind, {
      group: item.group,
      required,
      present: det.present,
      how: det.how,
      version: det.plugin?.version ?? null,
      vetted: item.vetted?.version ?? null,
    });
    if (!det.present) {
      r.label = required ? 'missing (required)' : 'missing (optional extra)';
      if (required) r.errors.push(`not installed as a plugin${item.detect?.looseSkills?.length ? ' or as loose skills' : ''}`);
      else r.warnings.push('not installed; crew install adds it');
    } else {
      r.label = presentLabel(det, item, { withVetted: false });
      const v = det.plugin?.version;
      if (det.how !== 'loose' && det.how !== 'mcp' && v && r.vetted && v !== r.vetted) r.warnings.push(`drift: ${v} installed, vetted ${r.vetted}`);
      if (det.how === 'loose') r.label += ' (version unknown)';
      if (det.duplicate) r.warnings.push(duplicateText(ctx, det));
      if (det.plugin?.enabled === false) r.warnings.push(`disabled (claude plugin enable ${det.plugin.id})`);
    }
    const note = binaryNote(ctx, item);
    if (note) r.warnings.push(note);
    rows.push(r);
  }

  return finish();
}

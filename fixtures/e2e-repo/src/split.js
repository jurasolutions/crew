// Split a bill between people. Money is always integer cents.

export function toCents(amount) {
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error(`not an amount: ${amount}`);
  const [whole, frac = ''] = amount.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export function formatCents(cents) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

// Even split; leftover cents go to the first people in the list, one each.
export function splitEvenly(totalCents, people) {
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new Error('total must be non-negative integer cents');
  if (!Number.isInteger(people) || people < 1) throw new Error('need at least one person');
  const base = Math.floor(totalCents / people);
  const extra = totalCents % people;
  return Array.from({ length: people }, (_, i) => base + (i < extra ? 1 : 0));
}

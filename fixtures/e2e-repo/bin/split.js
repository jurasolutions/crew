#!/usr/bin/env node
import { formatCents, splitEvenly, toCents } from '../src/split.js';

const [amount, people] = process.argv.slice(2);
if (!amount || !people) {
  console.error('usage: split <amount> <people>');
  process.exit(2);
}
const shares = splitEvenly(toCents(amount), Number(people));
shares.forEach((c, i) => console.log(`person ${i + 1}: ${formatCents(c)}`));

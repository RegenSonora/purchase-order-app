// PO numbers are made from the date, the time and the requester's initials, for example
// RS-20261117-1432-PR. Nothing is counted, so the number stays unique across phones and after
// a phone's storage is cleared.

import { PO_PREFIX } from './config';

const two = (n: number) => String(n).padStart(2, '0');

/** "Pat Requester" → "PR". Up to three letters; blank when there is no name. */
export function initials(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/** The PO number for a PO started at `when` (this phone's clock) by `requesterName`. */
export function makePoNumber(when: Date, requesterName: string): string {
  const date = `${when.getFullYear()}${two(when.getMonth() + 1)}${two(when.getDate())}`;
  const time = `${two(when.getHours())}${two(when.getMinutes())}`;
  const who = initials(requesterName);
  return `${PO_PREFIX}-${date}-${time}${who ? `-${who}` : ''}`;
}

/** `base`, or `base-2`, `base-3`... when this phone has already used it. */
export function uniquePoNumber(base: string, taken: string[]): string {
  const used = new Set(taken.map((t) => t.trim().toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  let n = 2;
  while (used.has(`${base}-${n}`.toLowerCase())) n += 1;
  return `${base}-${n}`;
}

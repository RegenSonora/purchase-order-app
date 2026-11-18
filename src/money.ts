// Money is kept as whole cents. Amounts are read from text digit by digit, never through
// floating-point dollars.

/** "$1,234.50" → 123450. Returns null for a blank, a negative, or anything that is not money. */
export function parseCents(text: string): number | null {
  const t = text.replace(/[$,\s]/g, '');
  const m = /^(\d*)(?:\.(\d{0,2}))?$/.exec(t);
  if (!m) return null;
  const whole = m[1] ?? '';
  const frac = m[2] ?? '';
  if (whole === '' && frac === '') return null;
  return Number(whole || '0') * 100 + Number(frac.padEnd(2, '0') || '0');
}

/** "2.5" → 2.5. Returns null for a blank, a negative, or anything that is not a number. */
export function parseQty(text: string): number | null {
  const t = text.replace(/[,\s]/g, '');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return Number(t);
}

/** 123450 → "$1,234.50". */
export function formatCents(cents: number): string {
  const whole = Math.floor(Math.abs(cents) / 100);
  const frac = String(Math.abs(cents) % 100).padStart(2, '0');
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${cents < 0 ? '-' : ''}$${grouped}.${frac}`;
}

import { describe, expect, it } from 'vitest';
import { formatCents, parseCents, parseQty } from '../../src/money';

describe('parseCents', () => {
  it('reads plain and formatted amounts as integer cents', () => {
    expect(parseCents('12')).toBe(1200);
    expect(parseCents('12.5')).toBe(1250);
    expect(parseCents('12.50')).toBe(1250);
    expect(parseCents('$1,234.56')).toBe(123456);
    expect(parseCents(' .99 ')).toBe(99);
    expect(parseCents('0')).toBe(0);
  });

  it('has no float error on amounts like 19.99', () => {
    expect(parseCents('19.99')).toBe(1999);
    expect(parseCents('1.15')).toBe(115);
    expect(parseCents('4.35')).toBe(435);
  });

  it('rejects blanks, negatives, words and more than 2 decimals', () => {
    expect(parseCents('')).toBeNull();
    expect(parseCents('   ')).toBeNull();
    expect(parseCents('-5')).toBeNull();
    expect(parseCents('abc')).toBeNull();
    expect(parseCents('1.234')).toBeNull();
    expect(parseCents('.')).toBeNull();
    expect(parseCents('1.2.3')).toBeNull();
  });
});

describe('parseQty', () => {
  it('reads whole and decimal quantities', () => {
    expect(parseQty('3')).toBe(3);
    expect(parseQty('2.5')).toBe(2.5);
    expect(parseQty('1,000')).toBe(1000);
    expect(parseQty('0')).toBe(0);
  });

  it('rejects blanks, negatives and words', () => {
    expect(parseQty('')).toBeNull();
    expect(parseQty('-1')).toBeNull();
    expect(parseQty('two')).toBeNull();
  });
});

describe('formatCents', () => {
  it('formats as US dollars with separators', () => {
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(123456)).toBe('$1,234.56');
    expect(formatCents(2500000)).toBe('$25,000.00');
    expect(formatCents(100000000)).toBe('$1,000,000.00');
  });
});

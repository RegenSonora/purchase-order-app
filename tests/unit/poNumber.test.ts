import { describe, expect, it } from 'vitest';
import { initials, makePoNumber, uniquePoNumber } from '../../src/poNumber';

describe('initials', () => {
  it('takes the first letter of each word, in capitals', () => {
    expect(initials('Pat Requester')).toBe('PR');
    expect(initials('  chris  ')).toBe('C');
    expect(initials('Mary-Jane O’Neil')).toBe('MJO');
  });

  it('drops accents and anything that is not a letter', () => {
    expect(initials('Élodie Ñández')).toBe('EN');
    expect(initials('J. R. Smith 3rd')).toBe('JRS');
  });

  it('stops at three letters and is blank for no name', () => {
    expect(initials('Ana Maria de la Cruz')).toBe('AMD');
    expect(initials('')).toBe('');
    expect(initials('123')).toBe('');
  });
});

describe('makePoNumber', () => {
  it('is the prefix, the date, the time and the initials', () => {
    expect(makePoNumber(new Date(2026, 10, 17, 14, 32), 'Pat Requester')).toBe(
      'RS-20261117-1432-PR',
    );
  });

  it('pads single-digit months, days, hours and minutes', () => {
    expect(makePoNumber(new Date(2027, 0, 5, 9, 7), 'Chris C')).toBe('RS-20270105-0907-CC');
  });

  it('leaves the initials off until there is a name', () => {
    expect(makePoNumber(new Date(2026, 10, 17, 14, 32), '')).toBe('RS-20261117-1432');
  });
});

describe('uniquePoNumber', () => {
  it('keeps a number nobody has used', () => {
    expect(uniquePoNumber('RS-20261117-1432-PR', ['RS-20261117-1431-PR'])).toBe(
      'RS-20261117-1432-PR',
    );
  });

  it('adds -2, -3 and so on when the same person starts another PO in the same minute', () => {
    expect(uniquePoNumber('RS-20261117-1432-PR', ['RS-20261117-1432-PR'])).toBe(
      'RS-20261117-1432-PR-2',
    );
    expect(
      uniquePoNumber('RS-20261117-1432-PR', ['rs-20261117-1432-pr ', 'RS-20261117-1432-PR-2']),
    ).toBe('RS-20261117-1432-PR-3');
  });
});

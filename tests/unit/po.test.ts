import { describe, expect, it } from 'vitest';
import {
  type PurchaseOrder,
  lineTotalCents,
  newPurchaseOrder,
  pdfFileName,
  poTotalCents,
  thresholdLabel,
  thresholdLevel,
  validate,
} from '../../src/po';

function validPo(): PurchaseOrder {
  const po = newPurchaseOrder({ poNumber: 'RS-2026-0001', today: '2026-11-17' });
  po.vendorName = 'Ace Hardware';
  po.budgetLine = 'Listening sessions';
  po.requestedByName = 'Pat Requester';
  po.items = [{ qty: '2', description: 'Folding tables', unitPrice: '49.99' }];
  return po;
}

describe('line and PO totals', () => {
  it('multiplies quantity by unit price in cents', () => {
    expect(lineTotalCents({ qty: '2', description: 'x', unitPrice: '49.99' })).toBe(9998);
    expect(lineTotalCents({ qty: '3', description: 'x', unitPrice: '19.99' })).toBe(5997);
    expect(lineTotalCents({ qty: '2.5', description: 'x', unitPrice: '10.01' })).toBe(2503);
    expect(lineTotalCents({ qty: '0', description: 'x', unitPrice: '10' })).toBe(0);
  });

  it('has no line total until both quantity and price are filled', () => {
    expect(lineTotalCents({ qty: '', description: 'x', unitPrice: '10' })).toBeNull();
    expect(lineTotalCents({ qty: '2', description: 'x', unitPrice: '' })).toBeNull();
  });

  it('sums the line totals and skips unfinished lines', () => {
    const po = validPo();
    po.items.push({ qty: '1', description: 'Chairs', unitPrice: '100' });
    po.items.push({ qty: '', description: 'Not priced yet', unitPrice: '' });
    expect(poTotalCents(po)).toBe(19998);
  });
});

describe('threshold label (same as the workbook)', () => {
  it('is a micro-purchase up to and including $10,000', () => {
    expect(thresholdLabel(0)).toBe('Micro-purchase');
    expect(thresholdLabel(1_000_000)).toBe('Micro-purchase');
    expect(thresholdLevel(1_000_000)).toBe(0);
  });

  it('needs termination terms over $10,000', () => {
    expect(thresholdLabel(1_000_001)).toBe('Over $10,000: termination terms required');
    expect(thresholdLabel(1_500_000)).toBe('Over $10,000: termination terms required');
  });

  it('needs quotes over $15,000', () => {
    expect(thresholdLabel(1_500_001)).toBe('Over $15,000: quotes required, termination terms');
    expect(thresholdLabel(2_499_999)).toBe('Over $15,000: quotes required, termination terms');
  });

  it('needs quotes or bids and a SAM.gov check at $25,000 and up', () => {
    expect(thresholdLabel(2_500_000)).toBe(
      '$25,000+: quotes or bids, SAM.gov check, termination terms',
    );
    expect(thresholdLevel(2_500_000)).toBe(3);
  });
});

describe('validate', () => {
  it('passes a complete PO', () => {
    expect(validate(validPo())).toEqual([]);
  });

  it('names each missing required field', () => {
    const po = validPo();
    po.poNumber = ' ';
    po.poDate = '';
    po.vendorName = '';
    po.budgetLine = '';
    po.requestedByName = '';
    expect(validate(po).map((p) => p.field)).toEqual([
      'poNumber',
      'poDate',
      'vendorName',
      'budgetLine',
      'requestedByName',
    ]);
  });

  it('rejects dates before January 1, 2025', () => {
    const po = validPo();
    po.poDate = '2024-12-31';
    po.requestedByDate = '2024-06-01';
    po.approvedByDate = '2020-01-01';
    expect(validate(po).map((p) => p.field)).toEqual([
      'poDate',
      'requestedByDate',
      'approvedByDate',
    ]);
  });

  it('needs at least one finished item', () => {
    const po = validPo();
    po.items = [{ qty: '', description: '', unitPrice: '' }];
    expect(validate(po).map((p) => p.field)).toEqual(['items']);
    po.items = [];
    expect(validate(po).map((p) => p.field)).toEqual(['items']);
  });

  it('points at the unfinished parts of a started item and ignores blank rows', () => {
    const po = validPo();
    po.items = [
      { qty: '1', description: 'Good line', unitPrice: '5' },
      { qty: '', description: '', unitPrice: '' },
      { qty: 'x', description: '', unitPrice: '1.999' },
    ];
    expect(validate(po).map((p) => p.field)).toEqual([
      'items.2.description',
      'items.2.qty',
      'items.2.unitPrice',
    ]);
  });

  it('does not require the optional fields', () => {
    const po = validPo();
    po.fundingSource = '';
    po.procurementMethod = '';
    po.approvedByName = '';
    po.approvedByDate = '';
    po.vendorContact = '';
    expect(validate(po)).toEqual([]);
  });
});

describe('pdfFileName', () => {
  it('uses the PO number and vendor, safe for any phone', () => {
    const po = validPo();
    po.vendorName = "Joe's Tools & Supply, LLC";
    expect(pdfFileName(po)).toBe('PO-RS-2026-0001-Joe-s-Tools-Supply-LLC.pdf');
  });

  it('does not double the PO prefix', () => {
    const po = validPo();
    po.poNumber = 'PO-77';
    po.vendorName = '';
    expect(pdfFileName(po)).toBe('PO-77.pdf');
  });
});

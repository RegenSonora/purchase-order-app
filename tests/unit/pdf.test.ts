import { describe, expect, it } from 'vitest';
import { APPROVAL_FOOTNOTE, APPROVED_BY_ROLE, REQUESTED_BY_ROLE, TERMS } from '../../src/config';
import { buildPdf } from '../../src/pdf';
import { type PurchaseOrder, newPurchaseOrder } from '../../src/po';
import { pdfText } from '../pdfText';

function samplePo(): PurchaseOrder {
  const po = newPurchaseOrder({ poNumber: 'RS-2026-0042', today: '2026-11-17' });
  Object.assign(po, {
    vendorName: 'Ace Hardware',
    vendorContact: 'Sam Lee, 520-555-0100',
    vendorAddress: '123 Main St\nSuperior, AZ 85173',
    deliverTo: 'Regenerating Sonora office',
    budgetLine: 'Listening sessions',
    purchaseRequest: 'PR-7',
    fundingSource: 'TISUPP - SAMHSA SUBG via GOYFF / Arizona State University',
    procurementMethod: 'Micro-purchase',
    requestedByName: 'Pat Requester',
    approvedByName: 'Alex Approver',
    approvedByDate: '2026-11-18',
  } satisfies Partial<PurchaseOrder>);
  po.items = [
    { qty: '2', description: 'Folding tables', unitPrice: '49.99' },
    { qty: '', description: '', unitPrice: '' },
    { qty: '10', description: 'Chairs', unitPrice: '$1,200' },
  ];
  return po;
}

describe('buildPdf', () => {
  it('makes a one-page PDF', async () => {
    const bytes = buildPdf(samplePo());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect((await pdfText(bytes)).pages).toBe(1);
  });

  it('prints every field the user filled in', async () => {
    const { text } = await pdfText(buildPdf(samplePo()));
    for (const expected of [
      'PURCHASE ORDER · REGENERATING SONORA · TISUPP',
      'Rules: 2 CFR 200.303, 200.318, 200.327',
      'PO number RS-2026-0042',
      'PO date 11/17/2026',
      'Ace Hardware',
      'Sam Lee, 520-555-0100',
      '123 Main St',
      'Superior, AZ 85173',
      'Regenerating Sonora office',
      'Listening sessions',
      'PR-7',
      'TISUPP - SAMHSA SUBG via GOYFF',
      'Micro-purchase',
      'Pat Requester',
      'Alex Approver',
      '11/18/2026',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('prints item lines, line totals, the PO total and the threshold note', async () => {
    const { text } = await pdfText(buildPdf(samplePo()));
    expect(text).toContain('2 Folding tables $49.99 $99.98');
    expect(text).toContain('10 Chairs $1,200.00 $12,000.00');
    expect(text).toContain('PO total $12,099.98');
    expect(text).toContain('Threshold Over $10,000: termination terms required');
  });

  it('prints the terms, the sign-off roles and the approval note word for word', async () => {
    const { text } = await pdfText(buildPdf(samplePo()));
    for (const wording of [...TERMS, REQUESTED_BY_ROLE, APPROVED_BY_ROLE, APPROVAL_FOOTNOTE]) {
      expect(text).toContain(wording);
    }
  });

  it('copes with long text and characters outside the PDF font', async () => {
    const po = samplePo();
    po.vendorName = 'Café “Niño” – supplies 🙂';
    po.items = Array.from({ length: 10 }, (_, i) => ({
      qty: '1',
      description: `Line ${i + 1}: ${'a long description that has to wrap onto more lines '.repeat(6)}`,
      unitPrice: '1',
    }));
    const { text, pages } = await pdfText(buildPdf(po));
    expect(text).toContain('Café "Niño" - supplies ?');
    expect(text).toContain('Line 10:');
    expect(text).toContain('PO total $10.00');
    expect(pages).toBeGreaterThan(1);
  });
});

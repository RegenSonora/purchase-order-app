// Draws the purchase order as a US Letter PDF, laid out like the "Purchase Order" sheet of the
// workbook: banner, header grid, 10 item rows, totals, terms, sign-off table.

import { jsPDF } from 'jspdf';
import {
  APPROVAL_FOOTNOTE,
  APPROVED_BY_ROLE,
  MAX_ITEMS,
  PDF_BANNER,
  PDF_RULES,
  PDF_TITLE,
  REQUESTED_BY_ROLE,
  TERMS,
} from './config';
import { formatCents, parseCents } from './money';
import {
  type PurchaseOrder,
  formatDate,
  isBlankItem,
  lineTotalCents,
  poTotalCents,
  thresholdLabel,
} from './po';

/** Signature images (PNG data URLs) for phase 2. Left out, the boxes print blank. */
export interface Signatures {
  requestedBy?: string;
  approvedBy?: string;
}

interface Cell {
  text: string;
  w: number;
  bold?: boolean;
  shaded?: boolean;
  align?: 'left' | 'right';
  size?: number;
  /** PNG data URL drawn inside the cell. */
  image?: string;
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 40;
const WIDTH = PAGE_W - MARGIN * 2; // 532
const PAD_X = 5;
const PAD_Y = 4;

const REPLACEMENTS: Record<string, string> = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2026': '...',
  '\u00a0': ' ',
  '\t': ' ',
};

/** The built-in PDF fonts only cover Latin-1, so swap or drop anything else. */
function clean(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2018\u2019\u201c\u201d\u2013\u2014\u2026\u00a0\t]/g, (c) => REPLACEMENTS[c] ?? c)
    .replace(/[^\n\x20-\x7e\u00a1-\u00ff]/g, '?');
}

export function buildPdf(po: PurchaseOrder, signatures: Signatures = {}): ArrayBuffer {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
  doc.setProperties({ title: `Purchase Order ${clean(po.poNumber)}` });
  doc.setLineWidth(0.6);
  doc.setDrawColor(140);
  let y = MARGIN;

  const font = (size: number, bold = false, italic = false) => {
    doc.setFont('helvetica', bold ? 'bold' : italic ? 'italic' : 'normal');
    doc.setFontSize(size);
  };
  const wrap = (text: string, width: number): string[] =>
    clean(text)
      .split('\n')
      .flatMap((line) => doc.splitTextToSize(line, width) as string[]);
  const ensureSpace = (height: number) => {
    if (y + height > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  /** One table row. Cells grow in height to fit the longest wrapped text. */
  const row = (cells: Cell[], minHeight = 20) => {
    const laidOut = cells.map((cell) => {
      const size = cell.size ?? 10;
      font(size, cell.bold);
      return { cell, size, lines: wrap(cell.text, cell.w - PAD_X * 2) };
    });
    const height = Math.max(
      minHeight,
      ...laidOut.map((c) => c.lines.length * c.size * 1.2 + PAD_Y * 2),
    );
    ensureSpace(height);
    let x = MARGIN;
    for (const { cell, size, lines } of laidOut) {
      doc.setFillColor(236, 236, 236);
      doc.rect(x, y, cell.w, height, cell.shaded ? 'FD' : 'S');
      if (cell.image) {
        doc.addImage(cell.image, 'PNG', x + 3, y + 3, cell.w - 6, height - 6);
      }
      font(size, cell.bold);
      doc.setTextColor(0);
      lines.forEach((line, i) => {
        const baseline = y + PAD_Y + size * 0.85 + i * size * 1.2;
        if (cell.align === 'right') {
          doc.text(line, x + cell.w - PAD_X, baseline, { align: 'right' });
        } else {
          doc.text(line, x + PAD_X, baseline);
        }
      });
      x += cell.w;
    }
    y += height;
  };

  const paragraph = (text: string, size: number, gap: number, italic = false) => {
    font(size, false, italic);
    const lines = wrap(text, WIDTH);
    ensureSpace(lines.length * size * 1.25);
    doc.setTextColor(0);
    lines.forEach((line, i) => doc.text(line, MARGIN, y + size * 0.85 + i * size * 1.25));
    y += lines.length * size * 1.25 + gap;
  };

  // Banner and title
  doc.setFillColor(60, 60, 60);
  doc.rect(MARGIN, y, WIDTH, 20, 'F');
  font(9, true);
  doc.setTextColor(255);
  doc.text(clean(PDF_BANNER), MARGIN + PAD_X, y + 13.5);
  y += 20 + 22;
  font(20, true);
  doc.setTextColor(0);
  doc.text(PDF_TITLE, MARGIN, y);
  y += 14;
  font(9);
  doc.setTextColor(90);
  doc.text(PDF_RULES, MARGIN, y);
  y += 12;

  // Header grid: label | value | label | value
  const LABEL = 96;
  const VALUE = (WIDTH - LABEL * 2) / 2;
  const pair = (leftLabel: string, left: string, rightLabel: string, right: string) =>
    row([
      { text: leftLabel, w: LABEL, bold: true, shaded: true, size: 9 },
      { text: left, w: VALUE },
      { text: rightLabel, w: LABEL, bold: true, shaded: true, size: 9 },
      { text: right, w: VALUE },
    ]);
  pair('PO number', po.poNumber, 'PO date', formatDate(po.poDate));
  pair('Vendor name', po.vendorName, 'Vendor contact', po.vendorContact);
  pair('Vendor address', po.vendorAddress, 'Deliver to', po.deliverTo);
  pair('Budget line', po.budgetLine, 'Purchase request #', po.purchaseRequest);
  pair('Funding source / award', po.fundingSource, 'Procurement method', po.procurementMethod);
  y += 10;

  // Items: always at least 10 rows, like the paper form
  const QTY = 50;
  const PRICE = 82;
  const TOTAL = 82;
  const DESC = WIDTH - QTY - PRICE - TOTAL;
  row([
    { text: 'Qty', w: QTY, bold: true, shaded: true, size: 9 },
    { text: 'Description', w: DESC, bold: true, shaded: true, size: 9 },
    { text: 'Unit price', w: PRICE, bold: true, shaded: true, size: 9, align: 'right' },
    { text: 'Line total', w: TOTAL, bold: true, shaded: true, size: 9, align: 'right' },
  ]);
  const items = po.items.filter((item) => !isBlankItem(item));
  for (let i = 0; i < Math.max(MAX_ITEMS, items.length); i += 1) {
    const item = items[i];
    const total = item ? lineTotalCents(item) : null;
    const price = item ? parseCents(item.unitPrice) : null;
    row([
      { text: item?.qty.trim() ?? '', w: QTY },
      { text: item?.description ?? '', w: DESC },
      { text: price === null ? '' : formatCents(price), w: PRICE, align: 'right' },
      { text: total === null ? '' : formatCents(total), w: TOTAL, align: 'right' },
    ]);
  }

  // Totals
  const total = poTotalCents(po);
  row([
    { text: 'PO total', w: WIDTH - TOTAL, bold: true, shaded: true, size: 9, align: 'right' },
    { text: formatCents(total), w: TOTAL, bold: true, align: 'right' },
  ]);
  row([
    { text: 'Threshold', w: LABEL, bold: true, shaded: true, size: 9 },
    { text: thresholdLabel(total), w: WIDTH - LABEL },
  ]);
  y += 12;

  // Terms
  TERMS.forEach((term) => paragraph(term, 9, 4));
  y += 8;

  // Sign-off
  const ROLE = 190;
  const NAME = 130;
  const DATE = 80;
  const SIGNATURE = WIDTH - ROLE - NAME - DATE;
  ensureSpace(20 + 44 * 2 + 16);
  row([
    { text: 'Role', w: ROLE, bold: true, shaded: true, size: 9 },
    { text: 'Name', w: NAME, bold: true, shaded: true, size: 9 },
    { text: 'Signature', w: SIGNATURE, bold: true, shaded: true, size: 9 },
    { text: 'Date', w: DATE, bold: true, shaded: true, size: 9 },
  ]);
  row(
    [
      { text: REQUESTED_BY_ROLE, w: ROLE, size: 9 },
      { text: po.requestedByName, w: NAME },
      { text: '', w: SIGNATURE, image: signatures.requestedBy },
      { text: formatDate(po.requestedByDate), w: DATE },
    ],
    44,
  );
  row(
    [
      { text: APPROVED_BY_ROLE, w: ROLE, size: 9 },
      { text: po.approvedByName, w: NAME },
      { text: '', w: SIGNATURE, image: signatures.approvedBy },
      { text: formatDate(po.approvedByDate), w: DATE },
    ],
    44,
  );
  y += 6;
  paragraph(APPROVAL_FOOTNOTE, 8, 0, true);

  return doc.output('arraybuffer');
}

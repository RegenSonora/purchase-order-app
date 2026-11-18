import { MIN_DATE, THRESHOLDS, THRESHOLD_DEFAULT_LABEL } from './config';
import { parseCents, parseQty } from './money';

/** One line of the order. Values are kept as the user typed them. */
export interface LineItem {
  qty: string;
  description: string;
  unitPrice: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  /** YYYY-MM-DD */
  poDate: string;
  vendorName: string;
  vendorContact: string;
  vendorAddress: string;
  deliverTo: string;
  budgetLine: string;
  purchaseRequest: string;
  fundingSource: string;
  procurementMethod: string;
  items: LineItem[];
  requestedByName: string;
  requestedByDate: string;
  approvedByName: string;
  approvedByDate: string;
  /** Set when the PO was shared or saved as a PDF (UTC timestamp). */
  sentAt?: string;
  /** When this PO was started (UTC timestamp). The automatic PO number is built from it. */
  createdAt?: string;
  /** True while the PO number is the automatic one. Typing a number by hand turns it off. */
  autoNumber?: boolean;
}

export interface Problem {
  /** A PurchaseOrder field name, "items", or "items.<row>.<qty|description|unitPrice>". */
  field: string;
  message: string;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Today's date on this phone, as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export function blankItem(): LineItem {
  return { qty: '', description: '', unitPrice: '' };
}

export function newPurchaseOrder(start: {
  poNumber: string;
  today: string;
  requestedByName?: string;
  deliverTo?: string;
  fundingSource?: string;
}): PurchaseOrder {
  return {
    id: newId(),
    poNumber: start.poNumber,
    poDate: start.today,
    vendorName: '',
    vendorContact: '',
    vendorAddress: '',
    deliverTo: start.deliverTo ?? '',
    budgetLine: '',
    purchaseRequest: '',
    fundingSource: start.fundingSource ?? '',
    procurementMethod: '',
    items: [blankItem()],
    requestedByName: start.requestedByName ?? '',
    requestedByDate: start.today,
    approvedByName: '',
    approvedByDate: '',
  };
}

/** Quantity × unit price in cents, or null until both are filled in correctly. */
export function lineTotalCents(item: LineItem): number | null {
  const qty = parseQty(item.qty);
  const price = parseCents(item.unitPrice);
  if (qty === null || price === null) return null;
  return Math.round(qty * price);
}

export function poTotalCents(po: PurchaseOrder): number {
  return po.items.reduce((sum, item) => sum + (lineTotalCents(item) ?? 0), 0);
}

/** 0 = micro-purchase, then 1, 2, 3 for each threshold crossed. */
export function thresholdLevel(totalCents: number): number {
  const index = THRESHOLDS.findIndex(
    (t) =>
      (t.atLeast !== undefined && totalCents >= t.atLeast) ||
      (t.over !== undefined && totalCents > t.over),
  );
  return index === -1 ? 0 : THRESHOLDS.length - index;
}

export function thresholdLabel(totalCents: number): string {
  const level = thresholdLevel(totalCents);
  return level === 0
    ? THRESHOLD_DEFAULT_LABEL
    : (THRESHOLDS[THRESHOLDS.length - level]?.label ?? THRESHOLD_DEFAULT_LABEL);
}

export function isBlankItem(item: LineItem): boolean {
  return !item.qty.trim() && !item.description.trim() && !item.unitPrice.trim();
}

/** True when nothing a user would mind losing has been entered. */
export function isUntouched(po: PurchaseOrder): boolean {
  return !po.vendorName.trim() && !po.budgetLine.trim() && po.items.every(isBlankItem);
}

/** What stops this PO from being sent, in the order the fields appear on the form. */
export function validate(po: PurchaseOrder): Problem[] {
  const problems: Problem[] = [];
  const add = (field: string, message: string) => problems.push({ field, message });
  const tooEarly = (date: string) => date !== '' && date < MIN_DATE;

  if (!po.poNumber.trim()) add('poNumber', 'Enter a PO number.');
  if (!po.poDate) add('poDate', 'Choose the PO date.');
  else if (tooEarly(po.poDate)) add('poDate', 'The PO date must be January 1, 2025 or later.');
  if (!po.vendorName.trim()) add('vendorName', 'Enter the vendor name.');
  if (!po.budgetLine.trim()) add('budgetLine', 'Choose or type a budget line.');

  let finished = 0;
  let itemProblems = 0;
  po.items.forEach((item, i) => {
    if (isBlankItem(item)) return;
    const before = problems.length;
    if (!item.description.trim()) add(`items.${i}.description`, 'Describe this item.');
    if (parseQty(item.qty) === null) add(`items.${i}.qty`, 'Enter a quantity (0 or more).');
    if (parseCents(item.unitPrice) === null) {
      add(`items.${i}.unitPrice`, 'Enter a unit price, like 12.50.');
    }
    if (problems.length === before) finished += 1;
    else itemProblems += 1;
  });
  if (finished === 0 && itemProblems === 0) {
    add('items', 'Add at least one item with a description, quantity and unit price.');
  }

  if (!po.requestedByName.trim()) {
    add('requestedByName', 'Enter the name of the person requesting this purchase.');
  }
  if (tooEarly(po.requestedByDate)) {
    add('requestedByDate', 'The date must be January 1, 2025 or later.');
  }
  if (tooEarly(po.approvedByDate)) {
    add('approvedByDate', 'The date must be January 1, 2025 or later.');
  }
  return problems;
}

function fileSafe(text: string, max: number): string {
  return text
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
}

/** "PO-RS-2026-0042-Ace-Hardware.pdf" */
export function pdfFileName(po: PurchaseOrder): string {
  const number = fileSafe(po.poNumber, 40) || 'draft';
  const vendor = fileSafe(po.vendorName, 30);
  const start = /^PO-/i.test(number) ? number : `PO-${number}`;
  return `${start}${vendor ? `-${vendor}` : ''}.pdf`;
}

/** "2026-11-17" → "11/17/2026". Blank stays blank. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
}

import { formatCents } from '../money';
import { type PurchaseOrder, formatDate, poTotalCents } from '../po';
import { button, h } from './dom';

export interface HistoryOptions {
  entries: PurchaseOrder[];
  onResend: (po: PurchaseOrder) => void;
  onView: (po: PurchaseOrder) => void;
  onDuplicate: (po: PurchaseOrder) => void;
  onDelete: (po: PurchaseOrder) => void;
}

function sentOn(po: PurchaseOrder): string {
  if (!po.sentAt) return '';
  const when = new Date(po.sentAt);
  return ` · Sent ${when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function renderHistory(root: HTMLElement, options: HistoryOptions): void {
  const heading = h('h2', {}, 'POs sent from this phone');
  if (options.entries.length === 0) {
    root.replaceChildren(
      heading,
      h('p', { class: 'empty' }, 'No POs yet. After you send one, it shows up here.'),
    );
    return;
  }
  root.replaceChildren(
    heading,
    h(
      'p',
      { class: 'hint' },
      'This list is kept only on this phone. Deleting a PO here does not unsend it.',
    ),
    ...options.entries.map((po) =>
      h(
        'article',
        { class: 'card plain entry' },
        h('h3', {}, `${po.poNumber} · ${po.vendorName}`),
        h(
          'p',
          {},
          `${formatCents(poTotalCents(po))} · PO date ${formatDate(po.poDate)}${sentOn(po)}`,
        ),
        h(
          'div',
          { class: 'actions' },
          button('Send again', () => options.onResend(po), {
            'aria-label': `Send again: ${po.poNumber}`,
          }),
          button('View PDF', () => options.onView(po), {
            'aria-label': `View PDF: ${po.poNumber}`,
          }),
          button('Copy to new PO', () => options.onDuplicate(po), {
            'aria-label': `Copy to new PO: ${po.poNumber}`,
          }),
          button('Delete', () => options.onDelete(po), {
            class: 'danger',
            'aria-label': `Delete: ${po.poNumber}`,
          }),
        ),
      ),
    ),
  );
}

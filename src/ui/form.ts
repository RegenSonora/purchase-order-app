import {
  BUDGET_LINES,
  FUNDING_SOURCES,
  MAX_ITEMS,
  MIN_DATE,
  PROCUREMENT_METHODS,
  TEXT_APPROVAL_LIMIT,
} from '../config';
import { formatCents } from '../money';
import {
  type LineItem,
  type Problem,
  type PurchaseOrder,
  blankItem,
  lineTotalCents,
  poTotalCents,
  thresholdLabel,
  thresholdLevel,
} from '../po';
import { type Vendor, loadCustom, loadVendors } from '../storage';
import { button, h } from './dom';

/** The PO fields that hold plain text typed by the user. */
type TextField = Exclude<
  {
    [K in keyof PurchaseOrder]-?: PurchaseOrder[K] extends string ? K : never;
  }[keyof PurchaseOrder],
  'id'
>;

export interface FormOptions {
  po: PurchaseOrder;
  /** Called after every edit. */
  onChange: () => void;
  onSend: () => void;
  onPreview: () => void;
  onClear: () => void;
  /** The automatic PO number for this PO with the given requester name. */
  numberFor: (requesterName: string) => string;
}

export interface FormHandle {
  /** Shows what needs fixing next to each field and moves to the first one. */
  showProblems: (problems: Problem[]) => void;
}

const OTHER = '__other__';

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function renderForm(root: HTMLElement, options: FormOptions): FormHandle {
  const { po } = options;
  const fields = new Map<string, { control: HTMLElement; error: HTMLElement }>();
  const vendors = loadVendors();

  // ----- totals -----
  const totalEl = h('strong', { id: 'po-total' });
  const thresholdEl = h('span', { id: 'threshold', class: 'threshold' });
  const approvalNote = h(
    'p',
    { class: 'note', id: 'approval-note', hidden: true },
    `This PO is over ${formatCents(TEXT_APPROVAL_LIMIT)}. It must be approved by email or signature. A text message is not enough.`,
  );
  const refreshTotals = () => {
    const total = poTotalCents(po);
    totalEl.textContent = formatCents(total);
    thresholdEl.textContent = thresholdLabel(total);
    thresholdEl.classList.toggle('warn', thresholdLevel(total) > 0);
    approvalNote.hidden = total <= TEXT_APPROVAL_LIMIT;
  };
  const changed = () => {
    refreshTotals();
    options.onChange();
  };

  // ----- field builders -----
  const clearError = (name: string) => {
    const entry = fields.get(name);
    if (!entry) return;
    entry.error.hidden = true;
    entry.error.textContent = '';
    entry.control.removeAttribute('aria-invalid');
    entry.control.removeAttribute('aria-describedby');
  };

  const field = (name: string, label: string, control: HTMLElement, hint?: string) => {
    const id = `f-${name.replace(/\./g, '-')}`;
    control.id = id;
    const error = h('p', { class: 'error', id: `${id}-error`, hidden: true });
    fields.set(name, { control, error });
    control.addEventListener('input', () => clearError(name));
    control.addEventListener('change', () => clearError(name));
    return h(
      'div',
      { class: 'field' },
      h('label', { for: id }, label),
      control,
      hint ? h('p', { class: 'hint' }, hint) : null,
      error,
    );
  };

  const text = (
    name: TextField,
    label: string,
    attrs: Record<string, string> = {},
    after?: (input: HTMLInputElement) => void,
    hint?: string,
  ) => {
    const input = h('input', { type: 'text', autocomplete: 'off', ...attrs });
    input.value = po[name];
    input.addEventListener('input', () => {
      po[name] = input.value;
      after?.(input);
      changed();
    });
    return field(name, label, input, hint);
  };

  const area = (name: TextField, label: string) => {
    const input = h('textarea', { rows: 2, autocomplete: 'off' });
    input.value = po[name];
    input.addEventListener('input', () => {
      po[name] = input.value;
      changed();
    });
    return field(name, label, input);
  };

  /** A picker with the usual choices. With `otherLabel`, any other text can be typed in. */
  const choice = (
    name: TextField,
    label: string,
    choices: string[],
    placeholder: string,
    otherLabel?: string,
  ) => {
    const select = h('select', {});
    select.append(h('option', { value: '' }, placeholder));
    for (const c of choices) select.append(h('option', { value: c }, c));
    if (otherLabel) select.append(h('option', { value: OTHER }, 'Other (type it in)'));

    const other = h('input', {
      type: 'text',
      autocomplete: 'off',
      'aria-label': otherLabel,
      placeholder: otherLabel,
      hidden: true,
    });
    const current = po[name];
    if (current && !choices.includes(current) && otherLabel) {
      select.value = OTHER;
      other.hidden = false;
      other.value = current;
    } else {
      select.value = choices.includes(current) ? current : '';
    }
    select.addEventListener('change', () => {
      const typing = select.value === OTHER;
      other.hidden = !typing;
      po[name] = typing ? other.value : select.value;
      if (typing) other.focus();
      changed();
    });
    other.addEventListener('input', () => {
      po[name] = other.value;
      clearError(name);
      changed();
    });
    const wrap = field(name, label, select);
    if (otherLabel) select.after(other);
    return wrap;
  };

  const card = (title: string, ...body: (HTMLElement | null)[]) =>
    h(
      'details',
      { class: 'card', open: true },
      h('summary', {}, title),
      h('div', { class: 'card-body' }, ...body),
    );

  // ----- vendor: picking a saved vendor fills in the contact and address -----
  const vendorList = h('datalist', { id: 'vendor-list' });
  for (const v of vendors) vendorList.append(h('option', { value: v.name }));
  let filledFrom: Vendor | null = null;
  const vendorName = text('vendorName', 'Vendor name', { list: 'vendor-list' }, (input) => {
    const typed = input.value.trim().toLowerCase();
    const match = vendors.find((v) => v.name.toLowerCase() === typed);
    if (!match) return;
    const untouched = (value: string, filled: string | undefined) =>
      value.trim() === '' || value === filled;
    if (
      untouched(po.vendorContact, filledFrom?.contact) &&
      untouched(po.vendorAddress, filledFrom?.address)
    ) {
      po.vendorContact = match.contact;
      po.vendorAddress = match.address;
      filledFrom = match;
      (fields.get('vendorContact')?.control as HTMLInputElement).value = match.contact;
      (fields.get('vendorAddress')?.control as HTMLTextAreaElement).value = match.address;
    }
  });

  // ----- items -----
  const itemsBox = h('div', {});
  const itemsError = h('p', { class: 'error', id: 'items-error', hidden: true });
  const addButton = button(
    '+ Add item',
    () => {
      if (po.items.length >= MAX_ITEMS) return;
      po.items.push(blankItem());
      renderItems();
      changed();
      fields.get(`items.${po.items.length - 1}.description`)?.control.focus();
    },
    { class: 'add-item' },
  );
  const itemsHint = h('p', { class: 'hint' });

  const itemCard = (item: LineItem, index: number) => {
    const total = h('strong', {});
    const refresh = () => {
      const cents = lineTotalCents(item);
      total.textContent = cents === null ? '—' : formatCents(cents);
    };
    const input = (key: keyof LineItem, label: string, attrs: Record<string, string> = {}) => {
      const el =
        key === 'description'
          ? h('textarea', { rows: 2, autocomplete: 'off' })
          : h('input', { type: 'text', autocomplete: 'off', ...attrs });
      el.value = item[key];
      el.addEventListener('input', () => {
        item[key] = el.value;
        itemsError.hidden = true;
        refresh();
        changed();
      });
      return field(`items.${index}.${key}`, label, el);
    };
    refresh();
    return h(
      'fieldset',
      { class: 'item' },
      h('legend', {}, `Item ${index + 1}`),
      input('description', 'Description'),
      h(
        'div',
        { class: 'row' },
        input('qty', 'Qty', { inputmode: 'decimal' }),
        input('unitPrice', 'Unit price', { inputmode: 'decimal', placeholder: '0.00' }),
      ),
      h(
        'div',
        { class: 'item-foot' },
        h('span', {}, 'Line total ', total),
        button(
          'Remove',
          () => {
            po.items.splice(index, 1);
            if (po.items.length === 0) po.items.push(blankItem());
            renderItems();
            changed();
            addButton.focus();
          },
          { class: 'quiet danger', 'aria-label': `Remove item ${index + 1}` },
        ),
      ),
    );
  };

  function renderItems(): void {
    for (const key of [...fields.keys()]) {
      if (key.startsWith('items.')) fields.delete(key);
    }
    itemsBox.replaceChildren(...po.items.map(itemCard));
    const full = po.items.length >= MAX_ITEMS;
    addButton.disabled = full;
    itemsHint.textContent = full ? `A PO holds up to ${MAX_ITEMS} items.` : '';
    itemsHint.hidden = !full;
  }

  // ----- screen -----
  const summary = h('p', { class: 'summary-error', role: 'alert', hidden: true });
  const date = (min = true) => ({ type: 'date', ...(min ? { min: MIN_DATE } : {}) });

  const budgetLines = unique([...loadCustom('budgetLines'), ...BUDGET_LINES]);
  const fundingSources = unique([...loadCustom('fundingSources'), ...FUNDING_SOURCES]);

  root.replaceChildren(
    summary,
    card(
      'Order',
      text(
        'poNumber',
        'PO number',
        { autocapitalize: 'characters' },
        // A number typed by hand is kept as typed.
        () => (po.autoNumber = false),
        'Made from the date, the time and the requester’s initials. You can change it.',
      ),
      text('poDate', 'PO date', date()),
      text(
        'purchaseRequest',
        'Purchase request #',
        {},
        undefined,
        'When applicable. Leave blank if no Purchase Request was done for this purchase.',
      ),
    ),
    card(
      'Vendor',
      vendorName,
      vendorList,
      text('vendorContact', 'Vendor contact'),
      area('vendorAddress', 'Vendor address'),
      area('deliverTo', 'Deliver to'),
    ),
    card(
      'Funding',
      choice(
        'budgetLine',
        'Budget line',
        budgetLines,
        'Choose a budget line',
        'Type the budget line',
      ),
      choice(
        'fundingSource',
        'Funding source / award',
        fundingSources,
        'Choose a funding source',
        'Type the funding source',
      ),
      choice('procurementMethod', 'Procurement method', PROCUREMENT_METHODS, 'Choose a method'),
    ),
    card('Items', itemsError, itemsBox, addButton, itemsHint),
    card(
      'Sign-off',
      h('p', { class: 'hint' }, 'The signature boxes on the PDF are left blank for signing.'),
      h(
        'div',
        { class: 'row' },
        text('requestedByName', 'Requested by', { autocomplete: 'name' }, (input) => {
          // The automatic PO number ends in the requester's initials.
          if (!po.autoNumber) return;
          po.poNumber = options.numberFor(input.value);
          (fields.get('poNumber')?.control as HTMLInputElement).value = po.poNumber;
          clearError('poNumber');
        }),
        text('requestedByDate', 'Date requested', date()),
      ),
      h(
        'div',
        { class: 'row' },
        text('approvedByName', 'Approved by'),
        text('approvedByDate', 'Date approved', date()),
      ),
      approvalNote,
    ),
    h(
      'div',
      { class: 'actions' },
      button('Preview PDF', options.onPreview),
      button('Clear form', options.onClear, { class: 'danger' }),
    ),
    h(
      'div',
      { class: 'bar', role: 'region', 'aria-label': 'PO total and send' },
      h(
        'div',
        { class: 'bar-total' },
        h('span', { class: 'bar-label' }, 'PO total'),
        totalEl,
        thresholdEl,
      ),
      button('Send PO', options.onSend, { class: 'primary', id: 'send' }),
    ),
  );
  renderItems();
  refreshTotals();

  return {
    showProblems(problems) {
      for (const name of fields.keys()) clearError(name);
      itemsError.hidden = true;
      summary.hidden = problems.length === 0;
      if (problems.length === 0) return;
      summary.textContent =
        problems.length === 1
          ? 'One thing needs fixing before this PO can be sent.'
          : `${problems.length} things need fixing before this PO can be sent.`;

      let first: HTMLElement | null = null;
      for (const problem of problems) {
        const entry = fields.get(problem.field);
        const error = entry?.error ?? itemsError;
        const target = entry?.control ?? addButton;
        error.textContent = problem.message;
        error.hidden = false;
        if (entry) {
          entry.control.setAttribute('aria-invalid', 'true');
          entry.control.setAttribute('aria-describedby', error.id);
        }
        target.closest('details')?.setAttribute('open', '');
        first ??= target;
      }
      first?.scrollIntoView({ block: 'center' });
      first?.focus({ preventScroll: true });
    },
  };
}

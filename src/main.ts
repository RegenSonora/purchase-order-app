import './style.css';
import { BUDGET_LINES, FUNDING_SOURCES } from './config';
import { buildPdf } from './pdf';
import {
  type PurchaseOrder,
  isUntouched,
  newId,
  newPurchaseOrder,
  pdfFileName,
  todayIso,
  validate,
} from './po';
import { makePoNumber, uniquePoNumber } from './poNumber';
import { previewPdf, sharePdf } from './share';
import {
  clearDraft,
  clearVendors,
  deleteFromHistory,
  loadDraft,
  loadHistory,
  loadLastPoNumber,
  loadProfile,
  loadVendors,
  rememberCustom,
  rememberVendor,
  saveDraft,
  saveLastPoNumber,
  saveProfile,
  saveToHistory,
} from './storage';
import { type FormHandle, renderForm } from './ui/form';
import { renderHistory } from './ui/history';
import { openSettings } from './ui/settings';

const view = document.getElementById('view') as HTMLElement;
const toastEl = document.getElementById('toast') as HTMLElement;
const historyButton = document.getElementById('nav-history') as HTMLButtonElement;
const settingsButton = document.getElementById('nav-settings') as HTMLButtonElement;

let screen: 'form' | 'history' = 'form';
let form: FormHandle | null = null;
let toastTimer: number | undefined;

function toast(message: string): void {
  toastEl.textContent = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastEl.textContent = ''), 6000);
}

/**
 * The automatic PO number: date and time the PO was started, plus the requester's initials.
 * A number already used on this phone (same person, same minute) gets -2, -3 and so on.
 */
function autoPoNumber(createdAt: string, requesterName: string): string {
  const taken = [...loadHistory().map((p) => p.poNumber), loadLastPoNumber() ?? ''];
  return uniquePoNumber(makePoNumber(new Date(createdAt), requesterName), taken);
}

function freshPo(): PurchaseOrder {
  const profile = loadProfile();
  const createdAt = new Date().toISOString();
  return {
    ...newPurchaseOrder({
      poNumber: autoPoNumber(createdAt, profile.requesterName),
      today: todayIso(),
      requestedByName: profile.requesterName,
      deliverTo: profile.deliverTo,
      fundingSource: FUNDING_SOURCES[0],
    }),
    createdAt,
    autoNumber: true,
  };
}

let po: PurchaseOrder = loadDraft() ?? freshPo();

function showForm(): void {
  screen = 'form';
  historyButton.textContent = 'History';
  form = renderForm(view, {
    po,
    onChange: () => saveDraft(po),
    onSend: () => void sendCurrent(),
    onPreview: () => previewPdf(buildPdf(po), pdfFileName(po)),
    onClear: () => {
      if (!isUntouched(po) && !window.confirm('Clear this PO and start over?')) return;
      startFresh();
    },
    numberFor: (requesterName) =>
      autoPoNumber(po.createdAt ?? new Date().toISOString(), requesterName),
  });
}

function startFresh(): void {
  clearDraft();
  po = freshPo();
  showForm();
  window.scrollTo(0, 0);
}

function showHistory(): void {
  screen = 'history';
  form = null;
  historyButton.textContent = 'Back to PO';
  renderHistory(view, {
    entries: loadHistory(),
    onResend: (entry) => void resend(entry),
    onView: (entry) => previewPdf(buildPdf(entry), pdfFileName(entry)),
    onDuplicate: (entry) => {
      if (!isUntouched(po) && !window.confirm('This replaces the PO you are working on. Go on?')) {
        return;
      }
      const today = todayIso();
      const createdAt = new Date().toISOString();
      po = {
        ...structuredClone(entry),
        id: newId(),
        poNumber: autoPoNumber(createdAt, entry.requestedByName),
        createdAt,
        autoNumber: true,
        poDate: today,
        requestedByDate: today,
        approvedByDate: '',
        sentAt: undefined,
      };
      saveDraft(po);
      showForm();
      window.scrollTo(0, 0);
      toast(`Copied ${entry.poNumber} into a new PO.`);
    },
    onDelete: (entry) => {
      if (!window.confirm(`Delete ${entry.poNumber} from this phone? This cannot be undone.`)) {
        return;
      }
      deleteFromHistory(entry.id);
      showHistory();
      toast(`${entry.poNumber} deleted from this phone.`);
    },
  });
  window.scrollTo(0, 0);
}

function doneMessage(result: 'shared' | 'downloaded', poNumber: string): string {
  return result === 'shared'
    ? `PO ${poNumber} sent.`
    : `PO ${poNumber} saved as a PDF in your downloads. Attach it to an email to send it.`;
}

async function sendCurrent(): Promise<void> {
  const problems = validate(po);
  form?.showProblems(problems);
  if (problems.length > 0) return;

  // No waiting before the share call: phones only allow sharing straight after a tap.
  const sending = po;
  const result = await sharePdf(buildPdf(sending), pdfFileName(sending));
  if (result === 'cancelled') {
    toast('Not sent. Your PO is still here.');
    return;
  }

  saveToHistory({ ...sending, sentAt: new Date().toISOString() });
  rememberVendor({
    name: sending.vendorName,
    contact: sending.vendorContact,
    address: sending.vendorAddress,
  });
  rememberCustom('budgetLines', sending.budgetLine, BUDGET_LINES);
  rememberCustom('fundingSources', sending.fundingSource, FUNDING_SOURCES);
  saveProfile({
    requesterName: sending.requestedByName.trim(),
    deliverTo: sending.deliverTo.trim() || loadProfile().deliverTo,
  });
  saveLastPoNumber(sending.poNumber.trim());
  startFresh();
  toast(doneMessage(result, sending.poNumber));
}

async function resend(entry: PurchaseOrder): Promise<void> {
  const result = await sharePdf(buildPdf(entry), pdfFileName(entry));
  if (result === 'cancelled') {
    toast('Not sent.');
    return;
  }
  saveToHistory({ ...entry, sentAt: new Date().toISOString() });
  showHistory();
  toast(doneMessage(result, entry.poNumber));
}

historyButton.addEventListener('click', () => (screen === 'form' ? showHistory() : showForm()));

settingsButton.addEventListener('click', () => {
  openSettings({
    profile: loadProfile(),
    vendorCount: loadVendors().length,
    onClearVendors: () => {
      clearVendors();
      if (screen === 'form') showForm();
    },
    onSave: (profile) => {
      saveProfile(profile);
      if (!po.requestedByName.trim() && profile.requesterName) {
        po.requestedByName = profile.requesterName;
        if (po.autoNumber && po.createdAt) {
          po.poNumber = autoPoNumber(po.createdAt, profile.requesterName);
        }
      }
      if (!po.deliverTo.trim()) po.deliverTo = profile.deliverTo;
      saveDraft(po);
      if (screen === 'form') showForm();
      toast('Settings saved.');
    },
  });
});

showForm();

// Lets the app open with no signal once it has been opened online. Only on the hosted page.
if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:') {
  void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}

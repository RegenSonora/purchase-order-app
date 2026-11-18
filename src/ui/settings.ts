import type { Profile } from '../storage';
import { button, h } from './dom';

export interface SettingsOptions {
  profile: Profile;
  vendorCount: number;
  onSave: (profile: Profile) => void;
  onClearVendors: () => void;
}

export function openSettings(options: SettingsOptions): void {
  const input = (id: string, label: string, value: string, hint: string) => {
    const el = h('input', { type: 'text', id, autocomplete: 'off' });
    el.value = value;
    return {
      el,
      wrap: h(
        'div',
        { class: 'field' },
        h('label', { for: id }, label),
        el,
        h('p', { class: 'hint' }, hint),
      ),
    };
  };
  const name = input(
    's-name',
    'Your name',
    options.profile.requesterName,
    'Filled in as "Requested by" on each new PO. Your initials go on the end of the PO number.',
  );
  const deliver = input(
    's-deliver',
    'Usual delivery address',
    options.profile.deliverTo,
    'Filled in as "Deliver to" on each new PO.',
  );

  const dialog = h('dialog', { 'aria-labelledby': 'settings-title' });
  const close = () => dialog.close();
  const clearVendors = button(
    options.vendorCount === 0 ? 'No saved vendors' : `Clear saved vendors (${options.vendorCount})`,
    () => {
      if (!window.confirm('Forget every saved vendor on this phone?')) return;
      options.onClearVendors();
      clearVendors.textContent = 'No saved vendors';
      clearVendors.disabled = true;
    },
    { class: 'danger', disabled: options.vendorCount === 0 },
  );

  dialog.append(
    h('h2', { id: 'settings-title' }, 'Settings'),
    name.wrap,
    deliver.wrap,
    h('div', { class: 'actions' }, clearVendors),
    h(
      'div',
      { class: 'actions' },
      button('Cancel', close),
      button(
        'Save',
        () => {
          options.onSave({
            requesterName: name.el.value.trim(),
            deliverTo: deliver.el.value.trim(),
          });
          close();
        },
        { class: 'primary' },
      ),
    ),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

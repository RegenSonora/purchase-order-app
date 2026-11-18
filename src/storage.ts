// Everything the phone remembers lives in this browser's localStorage. Nothing is sent anywhere.
// Storage can be missing or blocked (private windows), so every call falls back to memory.

import type { PurchaseOrder } from './po';

export interface Vendor {
  name: string;
  contact: string;
  address: string;
}

export interface Profile {
  requesterName: string;
  deliverTo: string;
}

const PREFIX = 'po-app:';
const memory = new Map<string, string>();

function read<T>(key: string, fallback: T): T {
  let raw: string | null;
  try {
    raw = localStorage.getItem(PREFIX + key);
  } catch {
    raw = memory.get(key) ?? null;
  }
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(PREFIX + key, raw);
  } catch {
    memory.set(key, raw);
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    memory.delete(key);
  }
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The PO being filled in
export const loadDraft = () => read<PurchaseOrder | null>('draft', null);
export const saveDraft = (po: PurchaseOrder) => write('draft', po);
export const clearDraft = () => remove('draft');

// Past POs, newest first
export const loadHistory = () => read<PurchaseOrder[]>('history', []);

export function saveToHistory(po: PurchaseOrder): void {
  write('history', [po, ...loadHistory().filter((p) => p.id !== po.id)]);
}

export function deleteFromHistory(id: string): void {
  write(
    'history',
    loadHistory().filter((p) => p.id !== id),
  );
}

// Vendors
export const loadVendors = () => read<Vendor[]>('vendors', []);

export function rememberVendor(vendor: Vendor): void {
  if (!vendor.name.trim()) return;
  const others = loadVendors().filter((v) => !same(v.name, vendor.name));
  write('vendors', [{ ...vendor, name: vendor.name.trim() }, ...others]);
}

export const clearVendors = () => remove('vendors');

// Requester profile
export const loadProfile = () => read<Profile>('profile', { requesterName: '', deliverTo: '' });
export const saveProfile = (profile: Profile) => write('profile', profile);

// Budget lines and funding sources the user typed in
export type CustomList = 'budgetLines' | 'fundingSources';
export const loadCustom = (list: CustomList) => read<string[]>(list, []);

export function rememberCustom(list: CustomList, value: string, builtIn: string[]): void {
  const v = value.trim();
  if (!v || builtIn.some((b) => same(b, v))) return;
  write(list, [v, ...loadCustom(list).filter((c) => !same(c, v))]);
}

// The last PO number sent from this phone, kept even if that PO is deleted from History, so a
// PO started in the same minute does not reuse it.
export const loadLastPoNumber = () => read<string | null>('lastPoNumber', null);
export const saveLastPoNumber = (value: string) => write('lastPoNumber', value);

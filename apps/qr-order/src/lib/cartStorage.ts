import type { QrCartState } from '../types';

export function buildQrCartStorageKey(qrToken: string, tableId: string) {
  return `qr-order-cart:${qrToken}:${tableId}`;
}

export function loadStoredCart(key: string): QrCartState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as QrCartState;
  } catch {
    return null;
  }
}

export function saveStoredCart(key: string, value: QrCartState) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function clearStoredCart(key: string) {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(key);
}

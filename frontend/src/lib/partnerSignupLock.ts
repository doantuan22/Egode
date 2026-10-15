import { useSyncExternalStore } from 'react';

/**
 * Client-only flag: a visitor who just registered with the "partner" intent is kept on the
 * application page until they submit it or cancel. Nothing is stored server-side; the account
 * stays an ordinary customer account either way.
 */
const STORAGE_KEY = 'egode:partner-signup-lock';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

let current = read();

function write(value: boolean) {
  current = value;
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, '1');
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the in-memory flag still works for this page load.
  }
  listeners.forEach((listener) => listener());
}

export const partnerSignupLock = {
  isActive: () => current,
  activate: () => write(true),
  release: () => write(false),
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePartnerSignupLock(): boolean {
  return useSyncExternalStore(subscribe, partnerSignupLock.isActive, () => false);
}

import { useSyncExternalStore } from 'react';

/** Cờ phía client giữ khách vừa đăng ký đối tác ở trang hồ sơ */
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
    // Bộ nhớ có thể không dùng được nên dùng cờ trong bộ nhớ
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

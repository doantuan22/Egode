import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from './useDebouncedValue';

const positiveInt = (raw: string | null) => {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value >= 1 ? value : 1;
};

/** Giữ bộ lọc và trang của danh sách trên URL */
export function useListParams<K extends string>(defaults: Record<K, string>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const latest = useRef(searchParams);
  latest.current = searchParams;
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const write = useCallback((mutate: (params: URLSearchParams) => void, replace: boolean) => {
    const next = new URLSearchParams(latest.current);
    mutate(next);
    latest.current = next;
    setSearchParams(next, { replace });
  }, [setSearchParams]);

  const setValue = useCallback((key: K, value: string) => {
    write((params) => {
      if (value === defaultsRef.current[key]) params.delete(key);
      else params.set(key, value);
    }, true);
  }, [write]);

  const setPage = useCallback((next: number | ((page: number) => number)) => {
    const current = positiveInt(latest.current.get('page'));
    const target = Math.max(1, typeof next === 'function' ? next(current) : next);
    write((params) => {
      if (target === 1) params.delete('page');
      else params.set('page', String(target));
    }, target === 1);
  }, [write]);

  const reset = useCallback(() => {
    write((params) => {
      Object.keys(defaultsRef.current).forEach((key) => params.delete(key));
      params.delete('page');
    }, true);
  }, [write]);

  const values = Object.fromEntries(
    Object.entries<string>(defaults).map(([key, fallback]) => [key, searchParams.get(key) ?? fallback])
  ) as Record<K, string>;

  return { values, page: positiveInt(searchParams.get('page')), setValue, setPage, reset };
}

/** Ô tìm kiếm ghi lên URL sau khi người dùng dừng gõ */
export function useUrlSearchInput(urlValue: string, commit: (value: string) => void, delayMs = 350) {
  const [input, setInput] = useState(urlValue);
  const debounced = useDebouncedValue(input.trim(), delayMs);
  const lastCommitted = useRef(urlValue);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  // Văn bản đã gõ sang URL
  useEffect(() => {
    if (debounced === lastCommitted.current) return;
    lastCommitted.current = debounced;
    commitRef.current(debounced);
  }, [debounced]);

  // URL đổi từ bên ngoài thì cập nhật ô nhập, bỏ qua lần ghi của chính nó
  useEffect(() => {
    if (urlValue === lastCommitted.current) return;
    lastCommitted.current = urlValue;
    setInput(urlValue);
  }, [urlValue]);

  const update = useCallback((value: string) => {
    setInput(value);
    if (value.trim() === '' && lastCommitted.current !== '') {
      lastCommitted.current = '';
      commitRef.current('');
    }
  }, []);

  return [input, update] as const;
}

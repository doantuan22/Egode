import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useListParams, useUrlSearchInput } from './useListParams';

const DEFAULTS = { search: '', status: '', method: '' };

const setup = (initial = '/admin/x') =>
  renderHook(
    () => ({ list: useListParams(DEFAULTS), location: useLocation(), navigate: useNavigate() }),
    { wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter> }
  );

const url = (result: ReturnType<typeof setup>['result']) => result.current.location.pathname + result.current.location.search;

describe('useListParams', () => {
  it('uses the defaults and page 1 when the URL has no list parameters', () => {
    const { result } = setup();
    expect(result.current.list.values).toEqual(DEFAULTS);
    expect(result.current.list.page).toBe(1);
  });

  it('reads values and the page from the URL, ignoring an invalid page', () => {
    expect(setup('/admin/x?status=Thất%20bại&page=3').result.current.list).toMatchObject({ values: { ...DEFAULTS, status: 'Thất bại' }, page: 3 });
    expect(setup('/admin/x?page=abc').result.current.list.page).toBe(1);
    expect(setup('/admin/x?page=-2').result.current.list.page).toBe(1);
  });

  it('writes a value to the URL and removes it again when it goes back to the default', () => {
    const { result } = setup('/admin/x?other=keep');

    act(() => result.current.list.setValue('status', 'Thành công'));
    expect(url(result)).toBe('/admin/x?other=keep&status=Th%C3%A0nh+c%C3%B4ng');

    act(() => result.current.list.setValue('status', ''));
    expect(url(result)).toBe('/admin/x?other=keep');
  });

  it('keeps every change when several are made in the same event (filter change followed by page reset)', () => {
    const { result } = setup('/admin/x?page=4');

    act(() => {
      result.current.list.setValue('status', 'A');
      result.current.list.setValue('method', 'B');
      result.current.list.setPage(1);
    });

    expect(result.current.location.search).toBe('?status=A&method=B');
  });

  it('accepts an updater for the page and never goes below 1', () => {
    const { result } = setup();

    act(() => result.current.list.setPage((page) => page + 1));
    expect(result.current.list.page).toBe(2);
    act(() => result.current.list.setPage((page) => page - 5));
    expect(result.current.list.page).toBe(1);
    expect(result.current.location.search).toBe('');
  });

  it('adds a history entry for paging forward (Back returns to the previous page) but not for filters', () => {
    const { result } = setup('/admin/x');

    act(() => result.current.list.setValue('status', 'A'));
    act(() => result.current.list.setPage(2));
    expect(result.current.location.search).toBe('?status=A&page=2');

    act(() => result.current.navigate(-1));
    expect(result.current.location.search).toBe('?status=A');
  });

  it('reset removes only the list parameters and the page', () => {
    const { result } = setup('/admin/x?status=A&method=B&page=3&other=keep');

    act(() => result.current.list.reset());

    expect(result.current.location.search).toBe('?other=keep');
  });
});

describe('useUrlSearchInput', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setupSearch = (initial = '/admin/x') =>
    renderHook(
      () => {
        const list = useListParams(DEFAULTS);
        const [input, setInput] = useUrlSearchInput(list.values.search, (value) => list.setValue('search', value));
        return { list, input, setInput, location: useLocation(), navigate: useNavigate() };
      },
      { wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter> }
    );

  it('starts from the URL value', () => {
    expect(setupSearch('/admin/x?search=abc').result.current.input).toBe('abc');
  });

  it('writes the typed text to the URL only after the user pauses', () => {
    const { result } = setupSearch();

    act(() => result.current.setInput('ha'));
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.location.search).toBe('');

    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.location.search).toBe('?search=ha');
  });

  it('does not overwrite text the user kept typing while the previous value was being committed', () => {
    const { result } = setupSearch();

    act(() => result.current.setInput('ha'));
    act(() => { vi.advanceTimersByTime(400); });
    act(() => result.current.setInput('han'));
    act(() => { vi.advanceTimersByTime(10); });

    expect(result.current.input).toBe('han');
  });

  it('follows the URL when it changes from outside (browser Back)', () => {
    const { result } = setupSearch('/admin/x?search=abc');

    act(() => result.current.navigate('/admin/x?search=xyz'));

    expect(result.current.input).toBe('xyz');
  });

  it('clearing the box removes the filter immediately, without waiting for the pause', () => {
    const { result } = setupSearch('/admin/x?search=abc');

    act(() => result.current.setInput(''));

    expect(result.current.location.search).toBe('');
  });
});

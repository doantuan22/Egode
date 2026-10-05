import { describe, expect, it, vi } from 'vitest';
import { applyServerFieldErrors, errorMessage, fieldErrorsOf, joinIssueMessages, parseFieldIssues } from './apiErrors';
import { ApiError } from '../services/apiClient';

describe('parseFieldIssues', () => {
  it('keeps well-formed { field, message } entries and drops everything else', () => {
    expect(parseFieldIssues([{ field: 'Email', message: 'Sai định dạng' }, { field: 1, message: 'x' }, { message: 'no field' }, null, 'text', { field: 'a', message: '' }])).toEqual([{ field: 'Email', message: 'Sai định dạng' }]);
    expect(parseFieldIssues(undefined)).toEqual([]);
    expect(parseFieldIssues({ field: 'a', message: 'b' })).toEqual([]);
  });
});

describe('joinIssueMessages / fieldErrorsOf / errorMessage', () => {
  const error = new ApiError('x', 400, [{ field: 'Email', message: 'A' }, { field: 'Email', message: 'B' }, { field: 'MatKhau', message: 'A' }], 'VALIDATION_ERROR');

  it('joins distinct messages for a banner', () => {
    expect(joinIssueMessages(error.details)).toBe('A. B');
    expect(joinIssueMessages([])).toBeNull();
  });

  it('keeps the FIRST message per field', () => {
    expect(fieldErrorsOf(error)).toEqual({ Email: 'A', MatKhau: 'A' });
    expect(fieldErrorsOf(new Error('boom'))).toEqual({});
    expect(fieldErrorsOf('not an error')).toEqual({});
  });

  it('errorMessage: the server message of an ApiError, the fallback for anything else (never a raw object)', () => {
    expect(errorMessage(new ApiError('Hết phòng', 409), 'fallback')).toBe('Hết phòng');
    expect(errorMessage(new Error('stack trace text'), 'Có lỗi xảy ra')).toBe('Có lỗi xảy ra');
    expect(errorMessage({ message: 'raw' }, 'Có lỗi xảy ra')).toBe('Có lỗi xảy ra');
    expect(errorMessage(undefined, 'Có lỗi xảy ra')).toBe('Có lỗi xảy ra');
  });
});

describe('applyServerFieldErrors', () => {
  const validation = new ApiError('x', 400, [
    { field: 'Email', message: 'Email không đúng định dạng' },
    { field: 'rooms.0.soLuong', message: 'Phải từ 1' },
    { field: 'KhongCoTrongForm', message: 'bỏ qua' },
  ], 'VALIDATION_ERROR');

  it('sets the error on every known field (nested paths map to their top-level input), focusing the first', () => {
    const setError = vi.fn();
    const applied = applyServerFieldErrors(validation, setError, ['Email', 'rooms']);

    expect(applied).toBe(true);
    expect(setError).toHaveBeenCalledTimes(2);
    expect(setError).toHaveBeenNthCalledWith(1, 'Email', { type: 'server', message: 'Email không đúng định dạng' }, { shouldFocus: true });
    expect(setError).toHaveBeenNthCalledWith(2, 'rooms', { type: 'server', message: 'Phải từ 1' }, { shouldFocus: false });
  });

  it('returns false and sets nothing when the error has no field the form knows (so the banner must carry it)', () => {
    const setError = vi.fn();
    expect(applyServerFieldErrors(validation, setError, ['MatKhau'])).toBe(false);
    expect(applyServerFieldErrors(new ApiError('Hết phòng', 409), setError, ['Email'])).toBe(false);
    expect(applyServerFieldErrors(new Error('network'), setError, ['Email'])).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});

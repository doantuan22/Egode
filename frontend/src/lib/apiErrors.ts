import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

/** Dạng lỗi chuẩn của API và các hàm đọc lỗi */
export interface FieldIssue {
  field: string;
  message: string;
}

/** Các mục field và message trong details */
export function parseFieldIssues(details: unknown): FieldIssue[] {
  if (!Array.isArray(details)) return [];
  const issues: FieldIssue[] = [];
  for (const item of details) {
    if (!item || typeof item !== 'object') continue;
    const { field, message } = item as { field?: unknown; message?: unknown };
    if (typeof field === 'string' && typeof message === 'string' && message) issues.push({ field, message });
  }
  return issues;
}

/** Các thông báo khác nhau trong details, nối thành một dòng */
export function joinIssueMessages(details: unknown): string | null {
  const messages = [...new Set(parseFieldIssues(details).map((issue) => issue.message))];
  return messages.length > 0 ? messages.join('. ') : null;
}

const isApiError = (error: unknown): error is Error & { statusCode: number; details?: unknown; code?: string } =>
  error instanceof Error && error.name === 'ApiError';

/** Một thông báo cho mỗi trường */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  const byField: Record<string, string> = {};
  if (!isApiError(error)) return byField;
  for (const issue of parseFieldIssues(error.details)) byField[issue.field] ??= issue.message;
  return byField;
}

/** Văn bản an toàn để hiển thị cho mọi lỗi */
export function errorMessage(error: unknown, fallback: string): string {
  return isApiError(error) && error.message ? error.message : fallback;
}

/** Đưa lỗi của server vào các ô nhập tương ứng của form */
export function applyServerFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, knownFields: readonly string[]): boolean {
  let applied = 0;
  for (const [field, message] of Object.entries(fieldErrorsOf(error))) {
    const input = field.split('.')[0];
    if (!knownFields.includes(input)) continue;
    setError(input as Path<T>, { type: 'server', message }, { shouldFocus: applied === 0 });
    applied += 1;
  }
  return applied > 0;
}

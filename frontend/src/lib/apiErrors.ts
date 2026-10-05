import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

/**
 * The error contract of the API (backend/src/common/errors/error-codes.ts):
 *   { success:false, message, code, details? }   — details: [{ field, message }] for validation.
 * Everything that reads an error body or an ApiError goes through here, so no screen ever shows a raw object.
 */
export interface FieldIssue {
  field: string;
  message: string;
}

/** The [{ field, message }] entries of a `details` value; anything that does not look like one is dropped. */
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

/** The distinct messages of a `details` list joined for a banner, or null when it has none. */
export function joinIssueMessages(details: unknown): string | null {
  const messages = [...new Set(parseFieldIssues(details).map((issue) => issue.message))];
  return messages.length > 0 ? messages.join('. ') : null;
}

const isApiError = (error: unknown): error is Error & { statusCode: number; details?: unknown; code?: string } =>
  error instanceof Error && error.name === 'ApiError';

/** One message per field (the first the server gave for it). */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  const byField: Record<string, string> = {};
  if (!isApiError(error)) return byField;
  for (const issue of parseFieldIssues(error.details)) byField[issue.field] ??= issue.message;
  return byField;
}

/** Text safe to show for any thrown value: the server's message for an ApiError, otherwise the caller's fallback. */
export function errorMessage(error: unknown, fallback: string): string {
  return isApiError(error) && error.message ? error.message : fallback;
}

/**
 * Puts the server's field errors on the matching inputs of a react-hook-form form. Only fields the form really
 * has (`knownFields`, matched on the part before the first dot) are mapped; the first one gets focus.
 * Returns true when at least one error landed on an input — the caller can then skip its generic banner.
 */
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

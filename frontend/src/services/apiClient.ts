import { ApiResponse } from '../types/api';
import { AuthResult } from '../types/auth';
import { getAccessToken, useAuthStore } from '../lib/authStore';
import { clearUserCache } from '../lib/queryClient';
import { fieldErrorsOf, joinIssueMessages } from '../lib/apiErrors';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  public statusCode: number;
  /** Server error `details` as sent (for validation: [{ field, message }]). */
  public details?: unknown;
  /** Server error `code` (VALIDATION_ERROR, NOT_FOUND, CONFLICT, ...); branch on this, not on the message. */
  public code?: string;

  constructor(message: string, statusCode = 500, details?: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
  }

  /** Server messages per request field, ready to put on form inputs. */
  get fieldErrors(): Record<string, string> {
    return fieldErrorsOf(this);
  }
}

const buildUrl = (endpoint: string) =>
  `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

// Concurrent 401s must share a single in-flight refresh instead of each
// firing their own — otherwise every refresh call would rotate the cookie
// and race the others out.
let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = (await res.json()) as ApiResponse<{ accessToken: string }>;
        return body.data?.accessToken ?? null;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

export const refreshSession = async (): Promise<boolean> => {
  const token = await refreshAccessToken();
  if (!token) return false;
  useAuthStore.getState().setAccessToken(token);
  return true;
};

interface ApiClientOptions extends RequestInit {
  /** Internal — prevents infinite refresh-retry loops. */
  _retried?: boolean;
}

export async function apiClient<T, TResponse extends ApiResponse<T> = ApiResponse<T>>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<TResponse> {
  const url = buildUrl(endpoint);
  const token = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data: TResponse = await response.json().catch(() => ({
    success: false,
    message: 'Failed to parse response JSON',
  }));

  if (response.status === 401 && !options._retried && !endpoint.startsWith('/auth/')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      useAuthStore.getState().setAccessToken(newToken);
      return apiClient<T, TResponse>(endpoint, { ...options, _retried: true });
    }
    // The session is gone for good: also drop this user's cached data so it cannot leak to whoever signs in next.
    clearUserCache();
    useAuthStore.getState().expireSession();
  }

  if (!response.ok || !data.success) {
    // Error contract: { message, code, details }. Validation lists each problem in `details`; the banner text is
    // those messages (more useful than a generic "invalid data"), and the same list drives the per-field errors.
    const message = (data.code === 'VALIDATION_ERROR' ? joinIssueMessages(data.details) : null) ?? (data.message || 'Request failed');
    throw new ApiError(message, response.status, data.details, data.code);
  }

  return data;
}

/** Login/register both return { account, accessToken } and set the access token in the store. */
export const applyAuthResult = (result: AuthResult): void => {
  useAuthStore.getState().setAccessToken(result.accessToken);
};

import { ApiResponse } from '../types/api';
import { AuthResult } from '../types/auth';
import { getAccessToken, useAuthStore } from '../lib/authStore';
import { clearUserCache } from '../lib/queryClient';
import { fieldErrorsOf, joinIssueMessages } from '../lib/apiErrors';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  public statusCode: number;
  /** Chi tiết lỗi từ server */
  public details?: unknown;
  /** Mã lỗi của server */
  public code?: string;

  constructor(message: string, statusCode = 500, details?: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
  }

  /** Thông báo theo từng trường */
  get fieldErrors(): Record<string, string> {
    return fieldErrorsOf(this);
  }
}

/** Các endpoint xác thực không refresh khi gặp 401 */
const NO_REFRESH_ENDPOINTS = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/forgot-password', '/auth/reset-password']);

const buildUrl = (endpoint: string) =>
  `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

// Nhiều 401 cùng lúc dùng chung một lần refresh
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
  /** Ngăn vòng lặp refresh */
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
    // Request tới nhầm máy chủ web thay vì API
    message: `Máy chủ API không trả về JSON (HTTP ${response.status}). Kiểm tra cấu hình VITE_API_BASE_URL / proxy tới API.`,
  }));

  if (response.status === 401 && !options._retried && !NO_REFRESH_ENDPOINTS.has(endpoint.split('?')[0])) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      useAuthStore.getState().setAccessToken(newToken);
      return apiClient<T, TResponse>(endpoint, { ...options, _retried: true });
    }
    // Phiên đã mất nên xóa cả dữ liệu cache của người dùng
    clearUserCache();
    useAuthStore.getState().expireSession();
  }

  if (!response.ok || !data.success) {
    // Lỗi xác thực liệt kê từng vấn đề trong details
    const message = (data.code === 'VALIDATION_ERROR' ? joinIssueMessages(data.details) : null) ?? (data.message || 'Request failed');
    throw new ApiError(message, response.status, data.details, data.code);
  }

  return data;
}

/** Đăng nhập và đăng ký trả về tài khoản và access token */
export const applyAuthResult = (result: AuthResult): void => {
  useAuthStore.getState().setAccessToken(result.accessToken);
};

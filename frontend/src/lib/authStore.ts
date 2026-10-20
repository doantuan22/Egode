import { create } from 'zustand';
import { decodeAccessToken } from './jwt';

interface AuthState {
  accessToken: string | null;
  role: string | null;
  /** Đang chờ lần refresh đầu khi mở ứng dụng */
  isBootstrapping: boolean;
  /** Phiên kết thúc do refresh thất bại */
  sessionExpired: boolean;
  setAccessToken: (token: string | null) => void;
  clear: () => void;
  /** Được gọi khi 401 vẫn còn sau khi refresh */
  expireSession: () => void;
  acknowledgeSessionExpired: () => void;
  finishBootstrap: () => void;
}

/** Trạng thái đăng nhập phía client, access token chỉ giữ trong bộ nhớ */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  role: null,
  isBootstrapping: true,
  sessionExpired: false,
  setAccessToken: (token) =>
    set({ accessToken: token, role: token ? (decodeAccessToken(token)?.role ?? null) : null, sessionExpired: false }),
  clear: () => set({ accessToken: null, role: null, sessionExpired: false }),
  expireSession: () => set({ accessToken: null, role: null, sessionExpired: true }),
  acknowledgeSessionExpired: () => set({ sessionExpired: false }),
  finishBootstrap: () => set({ isBootstrapping: false }),
}));

export const getAccessToken = (): string | null => useAuthStore.getState().accessToken;

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as authApi from './api';
import { applyAuthResult } from '../../services/apiClient';
import { useAuthStore } from '../../lib/authStore';
import { clearUserCache } from '../../lib/queryClient';
import type {
  RegisterPayload,
  LoginPayload,
  UpdateProfilePayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  ChangePasswordPayload,
} from '../../types/auth';

export const meQueryKey = ['auth', 'me'] as const;

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

  return useQuery({
    queryKey: meQueryKey,
    queryFn: authApi.getMe,
    enabled: !isBootstrapping && !!accessToken,
    retry: false,
    staleTime: 1000 * 60,
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: (result) => {
      clearUserCache(queryClient);
      applyAuthResult(result);
      queryClient.setQueryData(meQueryKey, result.account);
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: (result) => {
      // Drop anything cached for a previous session before seeding the new account.
      clearUserCache(queryClient);
      applyAuthResult(result);
      queryClient.setQueryData(meQueryKey, result.account);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clear();
      // Every feature area caches per-user data (bookings, support, admin, owner...); public catalogue data stays.
      clearUserCache(queryClient);
    },
  });
}

/**
 * Signs the user out and resolves once the local session and user cache are gone. It never
 * rejects: if the server request fails the local sign-out has still happened (useLogout clears
 * it in onSettled), so callers can always navigate away afterwards.
 */
export function useSignOut() {
  const { mutateAsync, isPending } = useLogout();
  const signOut = () => mutateAsync().then(() => undefined, () => undefined);
  return { signOut, isPending };
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (payload: ForgotPasswordPayload) => authApi.forgotPassword(payload) });
}

export function useResetPassword() {
  return useMutation({ mutationFn: (payload: ResetPasswordPayload) => authApi.resetPassword(payload) });
}

/** Changes the signed-in user's password; this device keeps its session through the new access token the server returns. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => authApi.changePassword(payload),
    onSuccess: ({ accessToken }) => {
      useAuthStore.getState().setAccessToken(accessToken);
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => authApi.updateMe(payload),
    onSuccess: (account) => {
      queryClient.setQueryData(meQueryKey, account);
    },
  });
}

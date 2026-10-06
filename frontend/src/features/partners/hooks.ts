import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as partnersApi from './api';
import type { ApplyPartnerPayload } from '../../types/auth';

const myApplicationKey = ['partners', 'me'] as const;
const adminListKey = (status?: string, page = 1, limit = 10) => ['admin', 'partner-applications', status, page, limit] as const;
const adminDetailKey = (id: number) => ['admin', 'partner-applications', 'detail', id] as const;

export function useMyPartnerApplication() {
  return useQuery({ queryKey: myApplicationKey, queryFn: partnersApi.getMyPartnerApplication });
}

export function useApplyPartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ApplyPartnerPayload) => partnersApi.applyPartner(payload),
    onSuccess: (application) => queryClient.setQueryData(myApplicationKey, application),
  });
}

export function useAdminPartnerApplications(status?: string, page = 1, limit = 10) {
  return useQuery({
    queryKey: adminListKey(status, page, limit),
    queryFn: () => partnersApi.listPartnerApplications(status, page, limit),
  });
}

export function useAdminPartnerApplication(id: number | null) {
  return useQuery({ queryKey: adminDetailKey(id ?? -1), queryFn: () => partnersApi.getPartnerApplication(id as number), enabled: id !== null });
}

export function useApprovePartnerApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => partnersApi.approvePartnerApplication(id),
    onSuccess: (application) => {
      queryClient.setQueryData(adminDetailKey(application.MaHoSoDoiTac), application);
      queryClient.invalidateQueries({ queryKey: ['admin', 'partner-applications'] });
    },
  });
}

export function useRejectPartnerApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => partnersApi.rejectPartnerApplication(id, reason),
    onSuccess: (application) => {
      queryClient.setQueryData(adminDetailKey(application.MaHoSoDoiTac), application);
      queryClient.invalidateQueries({ queryKey: ['admin', 'partner-applications'] });
    },
  });
}

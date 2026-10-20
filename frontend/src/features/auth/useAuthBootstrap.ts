import { useEffect, useRef } from 'react';
import { useAuthStore } from '../../lib/authStore';
import { refreshSession } from '../../services/apiClient';

/** Lần đầu mở trang, đổi cookie refresh lấy access token để giữ phiên */
export function useAuthBootstrap(): void {
  const ran = useRef(false);
  const finishBootstrap = useAuthStore((s) => s.finishBootstrap);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    refreshSession()
      .catch(() => false)
      .finally(() => finishBootstrap());
  }, [finishBootstrap]);
}

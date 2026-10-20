import { createContext, useContext } from 'react';

/** Bật khi ở trong trang quản trị để Select và DateField tự vẽ danh sách */
export const DashboardUiContext = createContext(false);

export const useDashboardUi = (): boolean => useContext(DashboardUiContext);

import { createContext, useContext } from 'react';

/**
 * True inside the admin / hotel-owner dashboards. `Select` and `DateField` then draw their own dropdown list and
 * calendar (the browser's native ones cannot be styled), while keeping the real `<select>` / `<input type="date">`
 * in the DOM as the form control. Everywhere else they stay the plain native elements.
 */
export const DashboardUiContext = createContext(false);

export const useDashboardUi = (): boolean => useContext(DashboardUiContext);

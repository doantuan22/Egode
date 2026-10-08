import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardNavigation, DashboardTopbar } from './DashboardNavigation';
import { ROLE_NAMES } from '../../lib/roles';
import { useUiStore } from '../../lib/store';
import { renderWithProviders } from '../../test/testUtils';

const stubViewport = (isMobile: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isMobile && query.includes('max-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

beforeEach(() => useUiStore.setState({ isSidebarOpen: false }));
afterEach(() => vi.unstubAllGlobals());

describe('DashboardTopbar', () => {
  it('has no search box or notification bell, which do nothing yet', () => {
    renderWithProviders(<DashboardTopbar role={ROLE_NAMES.ADMIN} />);

    expect(screen.queryByRole('textbox', { name: 'Tìm kiếm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thông báo' })).not.toBeInTheDocument();
  });

  it('keeps the partner menu toggle because the sidebar can become a drawer', () => {
    renderWithProviders(<DashboardTopbar role={ROLE_NAMES.PARTNER} />);

    expect(screen.getByRole('button', { name: 'Mở menu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Đối tác/ })).toHaveAttribute('href', '/owner/profile');
  });

  it('does not show a redundant menu toggle or theme switch in the admin topbar', () => {
    renderWithProviders(<DashboardTopbar role={ROLE_NAMES.ADMIN} />);

    expect(screen.queryByRole('button', { name: 'Mở menu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /giao diện/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Quản trị viên/ })).toHaveAttribute('href', '/admin/profile');
  });
});

describe('DashboardNavigation on a small screen (the sidebar is an off-canvas drawer)', () => {
  beforeEach(() => stubViewport(true));

  it('is unreachable by keyboard and screen readers while closed', () => {
    renderWithProviders(<DashboardNavigation role={ROLE_NAMES.ADMIN} />);
    expect(document.querySelector('aside')).toHaveAttribute('inert');
  });

  it('becomes a modal dialog when opened, and Escape closes it', async () => {
    renderWithProviders(<DashboardNavigation role={ROLE_NAMES.ADMIN} />);

    act(() => useUiStore.getState().setSidebarOpen(true));

    const drawer = screen.getByRole('dialog', { name: /Điều hướng Quản trị/ });
    expect(drawer).not.toHaveAttribute('inert');
    expect(drawer).toHaveAttribute('aria-modal', 'true');

    await userEvent.setup().keyboard('{Escape}');
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
  });

  it('moves focus into the drawer when it opens', async () => {
    renderWithProviders(<DashboardNavigation role={ROLE_NAMES.ADMIN} />);

    act(() => useUiStore.getState().setSidebarOpen(true));

    await vi.waitFor(() => expect(document.querySelector('aside')?.contains(document.activeElement)).toBe(true));
  });
});

describe('DashboardNavigation on a wide screen (the sidebar is always visible)', () => {
  beforeEach(() => stubViewport(false));

  it('stays a plain navigation landmark, always reachable, and Escape does not affect it', async () => {
    renderWithProviders(<DashboardNavigation role={ROLE_NAMES.ADMIN} />);
    const sidebar = document.querySelector('aside');

    expect(sidebar).not.toHaveAttribute('inert');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => useUiStore.getState().setSidebarOpen(true));
    await userEvent.setup().keyboard('{Escape}');
    expect(useUiStore.getState().isSidebarOpen).toBe(true);
    expect(document.body.style.overflow).toBe('');
  });
});

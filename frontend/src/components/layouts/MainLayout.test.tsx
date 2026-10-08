import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import MainLayout from './MainLayout';
import { useAuthStore } from '../../lib/authStore';
import { renderWithProviders } from '../../test/testUtils';

beforeEach(() => useAuthStore.setState({ accessToken: null, role: null, isBootstrapping: false }));

function renderPublicPage() {
  return renderWithProviders(
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<div>nội dung</div>} />
      </Route>
    </Routes>
  );
}

describe('MainLayout footer', () => {
  it('only links to pages that exist', () => {
    renderPublicPage();
    const footer = screen.getByRole('contentinfo');

    const hrefs = within(footer).getAllByRole('link').map((link) => link.getAttribute('href'));

    expect(hrefs.length).toBeGreaterThan(0);
    // No "#" placeholders and no link that just points back at the home page.
    expect(hrefs.every((href) => ['/support', '/partner/apply', '/login'].includes(href ?? ''))).toBe(true);
  });

  it('does not show links to pages that do not exist yet', () => {
    renderPublicPage();
    const footer = screen.getByRole('contentinfo');

    ['Về chúng tôi', 'Tuyển dụng', 'Báo chí', 'Blog', 'Chính sách bảo mật', 'Điều khoản sử dụng', 'Liên hệ', 'Giải pháp doanh nghiệp'].forEach((label) => {
      expect(within(footer).queryByText(label)).not.toBeInTheDocument();
    });
  });

  it('carries the real Egode logo, not a placeholder letter', () => {
    renderPublicPage();
    const footer = screen.getByRole('contentinfo');

    expect(footer.querySelector('img')).toHaveAttribute('src', '/egode_logo.png');
    expect(within(footer).queryByText(/^E$/)).not.toBeInTheDocument();
  });

  it('shows the current year in the copyright line', () => {
    renderPublicPage();
    expect(within(screen.getByRole('contentinfo')).getByText(new RegExp(`© ${new Date().getFullYear()} Egode`))).toBeInTheDocument();
  });
});

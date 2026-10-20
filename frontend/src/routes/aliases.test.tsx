import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ROUTE_ALIASES, aliasRoutes } from './aliases';

function Where() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="where">{`${pathname}${search}${hash}`}</div>;
}

function visit(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        {aliasRoutes()}
        {/* Route kết quả thanh toán thật phải thắng alias động */}
        <Route path="/payment/result" element={<Where />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
  const where = screen.getByTestId('where').textContent;
  cleanup();
  return where;
}

describe('route aliases', () => {
  it.each([
    ['/home', '/'],
    ['/search-results', '/hotels'],
    ['/account-profile', '/profile'],
    ['/register-partner', '/partner/apply'],
    ['/my-bookings', '/bookings'],
    ['/payment-result', '/payment/result'],
    ['/support-request', '/support'],
    ['/admin/onboarding', '/admin/partner-applications'],
    ['/admin/operations', '/admin'],
    ['/booking/5/room', '/bookings/5'],
    ['/booking/5/confirm', '/bookings/5'],
    ['/booking/5/payment', '/bookings/5'],
    ['/payment/5', '/bookings/5'],
    ['/write-review/5', '/bookings/5#danh-gia'],
  ])('%s redirects to %s', (from, to) => {
    expect(visit(from)).toBe(to);
  });

  it('keeps the query string, which the payment gateway callback and search filters rely on', () => {
    expect(visit('/payment-result?bookingId=42&status=success')).toBe('/payment/result?bookingId=42&status=success');
    expect(visit('/search-results?location=Hu%E1%BA%BF&guests=2')).toBe('/hotels?location=Hu%E1%BA%BF&guests=2');
  });

  it('fills route parameters into the target path', () => {
    expect(visit('/hotel-detail/7?checkIn=2030-01-01')).toBe('/hotels/7?checkIn=2030-01-01');
    expect(visit('/booking-detail/9')).toBe('/bookings/9');
  });

  it('keeps the hash of the incoming URL when the alias does not define its own', () => {
    expect(visit('/my-bookings#abc')).toBe('/bookings#abc');
  });

  it('does not swallow the real payment result URL (/payment/:id is dynamic, /payment/result is not)', () => {
    expect(visit('/payment/result?bookingId=42&status=success')).toBe('/payment/result?bookingId=42&status=success');
  });

  it('has no alias that points at another alias, and no duplicate source path', () => {
    const sources = ROUTE_ALIASES.map(([from]) => from);
    expect(new Set(sources).size).toBe(sources.length);
    ROUTE_ALIASES.forEach(([, to]) => expect(sources).not.toContain(to.split('#')[0]));
  });
});

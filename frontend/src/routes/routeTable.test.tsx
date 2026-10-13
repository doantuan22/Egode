import { isValidElement, type ReactElement } from 'react';
import { createRoutesFromChildren, type RouteObject } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { adminRoutes } from './adminRoutes';
import { customerRoutes } from './customerRoutes';
import { ownerRoutes } from './ownerRoutes';
import { publicRoutes } from './publicRoutes';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { GuestOnlyRoute } from '../components/auth/GuestOnlyRoute';
import { ROLE_NAMES } from '../lib/roles';

const routesOf = (fragment: ReactElement) => createRoutesFromChildren(fragment);
const pathsOf = (nodes: RouteObject[]): string[] => nodes.flatMap((node) => [...(node.path ? [node.path] : []), ...pathsOf(node.children ?? [])]);

/** The guard that wraps a route group: its component and (for ProtectedRoute) the roles it allows. */
const guardOf = (node: RouteObject) => {
  const element = node.element;
  if (!isValidElement(element)) return null;
  return { type: element.type, allowedRoles: (element.props as { allowedRoles?: string[] }).allowedRoles };
};

describe('route table', () => {
  it('has no path declared twice across public, customer, owner and admin routes', () => {
    const all = [publicRoutes, customerRoutes, ownerRoutes, adminRoutes].flatMap((fragment) => pathsOf(routesOf(fragment)));
    const duplicates = all.filter((path, index) => all.indexOf(path) !== index);

    expect(duplicates).toEqual([]);
  });

  it('keeps the routes each area is known for', () => {
    expect(pathsOf(routesOf(publicRoutes))).toEqual(expect.arrayContaining(['/', '/login', '/register', '/forgot-password', '/reset-password', '/hotels', '/hotels/:id']));
    expect(pathsOf(routesOf(customerRoutes))).toEqual(expect.arrayContaining(['/profile', '/bookings', '/bookings/:id', '/payment/result', '/support', '/partner/apply']));
    expect(pathsOf(routesOf(ownerRoutes))).toEqual(expect.arrayContaining(['/owner/overview', '/owner/hotels', '/owner/room-types', '/owner/inventory-pricing', '/owner/bookings', '/owner/revenue', '/owner/reports', '/owner/profile']));
    expect(pathsOf(routesOf(adminRoutes))).toEqual(expect.arrayContaining(['/admin', '/admin/profile', '/admin/accounts', '/admin/hotels', '/admin/bookings', '/admin/bookings/:id', '/admin/payments', '/admin/promotions', '/admin/analytics']));
  });

  it('puts every customer route behind a sign-in, with no role restriction', () => {
    const [group] = routesOf(customerRoutes);
    expect(guardOf(group)).toEqual({ type: ProtectedRoute, allowedRoles: undefined });
    expect(pathsOf([group]).length).toBeGreaterThan(3);
  });

  it('puts every owner route behind the "Chủ khách sạn" role and every admin route behind the admin role', () => {
    const [owner] = routesOf(ownerRoutes);
    const [admin] = routesOf(adminRoutes);

    expect(guardOf(owner)).toEqual({ type: ProtectedRoute, allowedRoles: [ROLE_NAMES.PARTNER] });
    expect(guardOf(admin)).toEqual({ type: ProtectedRoute, allowedRoles: [ROLE_NAMES.ADMIN] });
    expect(routesOf(ownerRoutes)).toHaveLength(1);
    expect(routesOf(adminRoutes)).toHaveLength(1);
  });

  it('keeps sign-in, register and forgot-password behind the guest-only guard, and reset-password outside it', () => {
    const nodes = routesOf(publicRoutes);
    const guest = nodes.find((node) => guardOf(node)?.type === GuestOnlyRoute)!;

    expect(pathsOf([guest]).sort()).toEqual(['/forgot-password', '/login', '/register']);
    expect(pathsOf(nodes.filter((node) => node !== guest))).toContain('/reset-password');
  });
});

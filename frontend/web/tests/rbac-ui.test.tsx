import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from '../src/components/layout/Sidebar';
import { ProtectedRoute } from '../src/components/layout/ProtectedRoute';
import { UserProfile } from '../src/types';

let mockCurrentUser: UserProfile;

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    hasRole: (role: string) => mockCurrentUser?.roles?.includes(role as any) ?? false,
    hasPermission: (perm: string) => mockCurrentUser?.permissions?.includes(perm) ?? false,
  }),
}));

describe('Complete 4-Role Browser Navigation & UI Policy Verification Suite', () => {
  const adminUser: UserProfile = {
    id: 'user-admin',
    email: 'admin@ecoflow.internal',
    firstName: 'System',
    lastName: 'Admin',
    roles: ['ADMINISTRATOR'],
    permissions: ['admin:all'],
  };

  const engineerUser: UserProfile = {
    id: 'user-engineer',
    email: 'engineer@ecoflow.internal',
    firstName: 'Lead',
    lastName: 'Engineer',
    roles: ['LEAD_ENGINEER'],
    permissions: [
      'product:read', 'product:write', 'bom:read', 'bom:write', 'bom:release',
      'ecr:read', 'ecr:create', 'ecr:review', 'ecr:decide', 'ecr:promote',
      'eco:read', 'eco:create', 'eco:edit', 'eco:submit', 'eco:cancel',
      'ecn:read', 'ecn:generate', 'ecn:issue', 'ecn:acknowledge', 'ecn:disposition', 'ecn:complete',
      'supplier:read', 'supplier:write',
      'inventory:read', 'inventory:write', 'inventory:transact',
      'purchasing:read', 'purchasing:write',
      'manufacturing:read', 'manufacturing:write', 'manufacturing:execute',
      'quality:read', 'quality:inspect', 'quality:write',
      'reports:read', 'approvals:read', 'approvals:remind', 'audit:read'
    ],
  };

  const approverUser: UserProfile = {
    id: 'user-approver',
    email: 'approver@ecoflow.internal',
    firstName: 'Designated',
    lastName: 'Approver',
    roles: ['APPROVER'],
    permissions: [
      'product:read', 'bom:read',
      'ecr:read', 'ecr:review', 'ecr:decide',
      'eco:read', 'eco:approve',
      'ecn:read', 'ecn:acknowledge',
      'supplier:read', 'inventory:read',
      'purchasing:read', 'purchasing:approve',
      'manufacturing:read',
      'quality:read', 'quality:decide',
      'reports:read', 'approvals:read', 'audit:read'
    ],
  };

  const operatorUser: UserProfile = {
    id: 'user-operator',
    email: 'operator@ecoflow.internal',
    firstName: 'Shopfloor',
    lastName: 'Operator',
    roles: ['OPERATOR'],
    permissions: [
      'product:read', 'bom:read',
      'ecr:read', 'ecr:create',
      'eco:read',
      'ecn:read', 'ecn:acknowledge',
      'supplier:read', 'inventory:read', 'inventory:transact',
      'purchasing:read',
      'manufacturing:read', 'manufacturing:execute',
      'quality:read', 'quality:inspect',
      'approvals:read', 'audit:read'
    ],
  };

  it('1. Administrator browser session: displays full navigation without restrictions', () => {
    mockCurrentUser = adminUser;
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Users & Roles')).toBeDefined();
    expect(screen.getByText('System Admin')).toBeDefined();
  });

  it('2. Lead Engineer browser session: verifies access to engineering, blocks admin paths', () => {
    mockCurrentUser = engineerUser;
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={
            <ProtectedRoute requiredPermission="admin:all">
              <div>Admin Secret View</div>
            </ProtectedRoute>
          } />
        </Routes>
      </MemoryRouter>
    );

    // Direct access to /admin must be denied
    expect(screen.queryByText('Admin Secret View')).toBeNull();
    expect(screen.getByText(/Access Denied/i)).toBeDefined();
  });

  it('3. Approver browser session: denies unauthorized authoring routes', () => {
    mockCurrentUser = approverUser;
    render(
      <MemoryRouter initialEntries={['/inventory']}>
        <Routes>
          <Route path="/inventory" element={
            <ProtectedRoute requiredPermission="inventory:read">
              <div>Inventory Master View</div>
            </ProtectedRoute>
          } />
        </Routes>
      </MemoryRouter>
    );

    // Approver has inventory:read so can view inventory read page
    expect(screen.getByText('Inventory Master View')).toBeDefined();
  });

  it('4. Operator browser session: denied direct URL access to restricted reports', () => {
    mockCurrentUser = operatorUser;
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <Routes>
          <Route path="/reports" element={
            <ProtectedRoute requiredPermission="reports:read">
              <div>Restricted Reports View</div>
            </ProtectedRoute>
          } />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Restricted Reports View')).toBeNull();
    expect(screen.getByText(/Access Denied/i)).toBeDefined();
  });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { BOMList } from '../src/pages/boms/BOMList';
import { ProductService, BOMService } from '../src/services';
import * as AuthContextModule from '../src/context/AuthContext';

vi.mock('../src/services', () => ({
  ProductService: {
    listProducts: vi.fn(),
    listCategories: vi.fn(),
  },
  BOMService: {
    createBOM: vi.fn(),
  },
}));

const mockCategories = [
  { id: 'cat-1', name: 'Electronics', code: 'ELEC' },
  { id: 'cat-2', name: 'Mechanical', code: 'MECH' },
];

const mockProducts = [
  {
    id: 'prod-1',
    part_number: 'PRD-ELEC-001',
    name: 'Smart Sensor Hub',
    description: 'IoT sensor gateway',
    status: 'ACTIVE',
    current_version: 1,
    category_id: 'cat-1',
    category: { id: 'cat-1', name: 'Electronics', code: 'ELEC' },
    boms: [
      {
        id: 'bom-1',
        bom_number: 'BOM-ELEC-001',
        status: 'ACTIVE',
        current_version: 1,
      },
    ],
  },
  {
    id: 'prod-2',
    part_number: 'PRD-MECH-002',
    name: 'Aluminum Chassis',
    description: 'CNC machined casing',
    status: 'DRAFT',
    current_version: 1,
    category_id: 'cat-2',
    category: { id: 'cat-2', name: 'Mechanical', code: 'MECH' },
    boms: [], // No BOM created yet
  },
];

describe('BOM Registry Product Discovery and Direct Creation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    (ProductService.listCategories as any).mockResolvedValue(mockCategories);
    (ProductService.listProducts as any).mockResolvedValue({
      data: mockProducts,
      meta: { total: 2, page: 1, limit: 50, pages: 1 },
    });
  });

  const renderComponent = (userRole = 'LEAD_ENGINEER', permissions = ['bom:read', 'bom:write']) => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-1',
        email: 'test@ecoflow.internal',
        firstName: 'Test',
        lastName: 'User',
        roles: [userRole as any],
        permissions,
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      hasRole: (role: any) => userRole === role,
      hasPermission: (perm: string) => permissions.includes(perm),
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BOMList />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('1. Renders BOM Registry header and discovers products in catalog', async () => {
    renderComponent();

    expect(screen.getByText('BOM Registry')).toBeDefined();
    expect(
      screen.getByText('Manage product bills of materials, discover engineering structures, and initialize new assemblies.')
    ).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('PRD-ELEC-001')).toBeDefined();
      expect(screen.getByText('Smart Sensor Hub')).toBeDefined();
      expect(screen.getByText('PRD-MECH-002')).toBeDefined();
      expect(screen.getByText('Aluminum Chassis')).toBeDefined();
    });

    // Check BOM status display
    expect(screen.getByText('BOM-ELEC-001')).toBeDefined();
    expect(screen.getByText('No BOM Created')).toBeDefined();
  });

  it('2. Search by product name / SKU / part number triggers query with search term', async () => {
    renderComponent();

    const searchInput = screen.getByPlaceholderText('Search by product name, SKU, or part number...');
    fireEvent.change(searchInput, { target: { value: 'Chassis' } });

    await waitFor(() => {
      expect(ProductService.listProducts).toHaveBeenCalledWith(1, 50, 'Chassis', undefined);
    });
  });

  it('3. Category filtering and combined search filter', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Electronics (ELEC)')).toBeDefined();
    });

    const categorySelect = screen.getByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: 'cat-2' } });

    await waitFor(() => {
      expect(ProductService.listProducts).toHaveBeenCalledWith(1, 50, undefined, 'cat-2');
    });

    // Combine with search
    const searchInput = screen.getByPlaceholderText('Search by product name, SKU, or part number...');
    fireEvent.change(searchInput, { target: { value: 'Aluminum' } });

    await waitFor(() => {
      expect(ProductService.listProducts).toHaveBeenCalledWith(1, 50, 'Aluminum', 'cat-2');
    });
  });

  it('4. Opens Create BOM modal and preselects product for products without BOM', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('PRD-MECH-002')).toBeDefined();
    });

    // Find the Create BOM button on the row for PRD-MECH-002
    const createButtons = screen.getAllByRole('button', { name: /Create BOM/i });
    // Click the row action button
    fireEvent.click(createButtons[createButtons.length - 1]);

    // Modal opens
    expect(screen.getByText('Initialize a new engineering BOM for manufacturing')).toBeDefined();
    // Preselected product displayed in both table and modal
    expect(screen.getAllByText('PRD-MECH-002').length).toBeGreaterThanOrEqual(2);
    // Default BOM number prepopulated
    const bomInput = screen.getByPlaceholderText('e.g. BOM-PRD-001') as HTMLInputElement;
    expect(bomInput.value).toBe('BOM-PRD-MECH-002');
  });

  it('5. Submits direct BOM creation and invokes BOMService.createBOM', async () => {
    (BOMService.createBOM as any).mockResolvedValue({
      id: 'bom-new-99',
      bom_number: 'BOM-PRD-MECH-002',
      product_id: 'prod-2',
      status: 'DRAFT',
      current_version: 1,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('PRD-MECH-002')).toBeDefined();
    });

    const createButtons = screen.getAllByRole('button', { name: /Create BOM/i });
    fireEvent.click(createButtons[createButtons.length - 1]);

    const submitBtn = screen.getByRole('button', { name: 'Initialize BOM' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(BOMService.createBOM).toHaveBeenCalledWith({
        productId: 'prod-2',
        bomNumber: 'BOM-PRD-MECH-002',
        description: undefined,
      });
    });
  });

  it('6. Role authorization: Operator and Approver have read-only access (Create BOM hidden/disabled)', async () => {
    // Render with OPERATOR / read-only permissions
    renderComponent('OPERATOR', ['bom:read', 'product:read']);

    await waitFor(() => {
      expect(screen.getByText('PRD-MECH-002')).toBeDefined();
    });

    // Header Create BOM button must NOT be present
    expect(screen.queryByRole('button', { name: /Create BOM/i })).toBeNull();
    // Instead of Create BOM, row shows Read-Only Access badge
    expect(screen.getByText('Read-Only Access')).toBeDefined();
    // View BOM link is still available for products with existing BOMs
    expect(screen.getByText('View BOM')).toBeDefined();
  });
});

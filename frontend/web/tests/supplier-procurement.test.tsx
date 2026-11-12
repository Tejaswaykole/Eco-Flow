import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuppliersList } from '../src/pages/suppliers/SuppliersList';
import { SupplierService, ProductService } from '../src/services';
import * as AuthContextModule from '../src/context/AuthContext';
import { Supplier, ProductCategory, Product, UserProfile } from '../src/types';

vi.mock('../src/services', () => ({
  SupplierService: {
    getDashboardStats: vi.fn(),
    listSuppliers: vi.fn(),
    getSupplier: vi.fn(),
    createSupplier: vi.fn(),
    updateSupplier: vi.fn(),
    addSupplierProduct: vi.fn(),
    bulkMapProducts: vi.fn(),
    updateSupplierProduct: vi.fn(),
    removeSupplierProduct: vi.fn(),
    getProductSuppliersComparison: vi.fn(),
    previewImport: vi.fn(),
    commitImport: vi.fn(),
    exportData: vi.fn(),
    listRFQs: vi.fn(),
    createRFQ: vi.fn(),
    createQuotation: vi.fn(),
    negotiateQuotation: vi.fn(),
    convertQuotationToPO: vi.fn(),
    getSupplierPerformance: vi.fn(),
  },
  ProductService: {
    listProducts: vi.fn(),
    listCategories: vi.fn(),
  },
}));

describe('SuppliersList Component & Sourcing Workflows', () => {
  let queryClient: QueryClient;

  const mockAdminUser = {
    id: 'user-admin-1',
    email: 'admin@ecoflow.test',
    firstName: 'Admin',
    lastName: 'User',
    roles: ['ADMINISTRATOR'],
    permissions: ['supplier:read', 'supplier:write', 'purchasing:write'],
  };

  const mockStats = {
    totalSuppliers: 12,
    activeSuppliers: 10,
    inactiveSuppliers: 2,
    totalMappedProducts: 34,
    totalPurchaseOrders: 18,
    completedPurchaseOrders: 14,
    repeatSuppliers: 6,
    pendingRFQs: 2,
    pendingQuotations: 5,
    activeNegotiations: 3,
  };

  const mockSuppliers = [
    {
      id: 'sup-1',
      supplier_code: 'SUP-001',
      name: 'Apex Semiconductor Systems',
      contact_name: 'John Doe',
      email: 'john@apex.test',
      phone: '+91-9876543210',
      address: 'Bangalore, India',
      status: 'ACTIVE',
      rating: 4.8,
      created_at: new Date().toISOString(),
      mappedProductCount: 2,
      mappedProducts: [
        {
          id: 'sp-1',
          productId: 'prod-1',
          productName: 'Smart LED Controller v1',
          partNumber: 'PRD-SMT-001',
          categoryName: 'Electronics',
          supplierPartNumber: 'VND-001',
          unitPrice: 325,
          currency: 'INR',
          leadTimeDays: 7,
          minimumOrderQty: 10,
          isPreferred: true,
          status: 'ACTIVE',
        },
      ],
      historicalPurchaseOrderCount: 4,
      completedPurchaseOrderCount: 4,
      repeatPurchaseCount: 3,
      avgLeadTimeDays: 7,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    vi.mocked(SupplierService.getDashboardStats).mockResolvedValue(mockStats);
    vi.mocked(SupplierService.listSuppliers).mockResolvedValue({
      success: true,
      suppliers: mockSuppliers as unknown as Supplier[],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    vi.mocked(SupplierService.listRFQs).mockResolvedValue([]);
    vi.mocked(ProductService.listCategories).mockResolvedValue([
      { id: 'cat-1', name: 'Electronics', code: 'ELEC', created_at: '', updated_at: '' } as ProductCategory,
      { id: 'cat-2', name: 'Mechanical', code: 'MECH', created_at: '', updated_at: '' } as ProductCategory,
    ]);
    vi.mocked(ProductService.listProducts).mockResolvedValue({
      success: true,
      data: [{ id: 'prod-1', name: 'Smart LED Controller v1', part_number: 'PRD-SMT-001' }] as Product[],
      pagination: { total: 1, page: 1, limit: 100, totalPages: 1 },
    });
  });

  const renderComponent = (customUser = mockAdminUser) => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: customUser as unknown as UserProfile,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
      hasRole: (r: any) => customUser.roles.includes(r),
      hasPermission: (p: string) => customUser.permissions.includes(p),
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <SuppliersList />
      </QueryClientProvider>
    );
  };

  it('renders Phase 1 dashboard statistics and supplier list', async () => {
    renderComponent();

    expect(await screen.findByText('Supplier Management & Sourcing')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined(); // totalSuppliers
    expect(screen.getByText('34')).toBeDefined(); // mapped catalogue
    expect(screen.getByText('Apex Semiconductor Systems')).toBeDefined();
    expect(screen.getByText('SUP-001')).toBeDefined();
  });

  it('filters suppliers by product category and search string', async () => {
    renderComponent();

    const searchInput = await screen.findByPlaceholderText(/Search by supplier name, code, contact/i);
    fireEvent.change(searchInput, { target: { value: 'Apex' } });

    expect(SupplierService.listSuppliers).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Apex' })
    );

    const comboboxes = screen.getAllByRole('combobox');
    const categorySelect = comboboxes[0];
    fireEvent.change(categorySelect, { target: { value: 'cat-1' } });

    expect(SupplierService.listSuppliers).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-1' })
    );
  });

  it('renders View Profile drawer with multi-tab workspace', async () => {
    vi.mocked(SupplierService.getSupplier).mockResolvedValue({
      id: 'sup-1',
      name: 'Apex Semiconductor Systems',
      supplier_code: 'SUP-001',
      status: 'ACTIVE',
      created_at: '',
      updated_at: '',
      products: [],
      purchase_orders: [],
      quotations: [],
    } as unknown as Supplier);

    renderComponent();

    const viewProfileBtn = await screen.findByRole('button', { name: /View Profile/i });
    fireEvent.click(viewProfileBtn);

    expect(await screen.findByText('Products & Parts (2)')).toBeDefined();
    expect(screen.getByText('Quotations & Bargaining')).toBeDefined();
    expect(screen.getByText('Performance & Analytics')).toBeDefined();
    expect(screen.getByText('Import & Export')).toBeDefined();
  });

  it('enforces RBAC permissions by hiding write controls for Operator', async () => {
    const operatorUser = {
      id: 'user-op-1',
      email: 'operator@ecoflow.test',
      firstName: 'Shop',
      lastName: 'Operator',
      roles: ['OPERATOR'],
      permissions: ['supplier:read'], // Read-only
    };

    renderComponent(operatorUser);

    expect(await screen.findByText('Apex Semiconductor Systems')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Register Supplier/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Create RFQ/i })).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ECNList } from '../src/pages/ecns/ECNList';
import { ECNDetail } from '../src/pages/ecns/ECNDetail';
import { ECNService, ProductService } from '../src/services';

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'lead-engineer-id',
      email: 'lead.engineer@ecoflow.internal',
      firstName: 'Lead',
      lastName: 'Engineer',
      roles: ['LEAD_ENGINEER', 'APPROVER'],
      permissions: ['ecn:generate', 'ecn:read', 'ecn:issue', 'ecn:acknowledge', 'ecn:disposition', 'ecn:complete'],
    },
    isAuthenticated: true,
    hasRole: (role: string) => ['LEAD_ENGINEER', 'APPROVER', 'ADMINISTRATOR'].includes(role),
    hasPermission: (_perm: string) => true,
  }),
}));

const mockEcnList = [
  {
    id: 'ecn-1',
    ecn_number: 'ECN-20261111-0001',
    title: '[ECN] Frame bolt torque redesign',
    status: 'ISSUED',
    effective_date: '2026-12-01T00:00:00Z',
    eco: { id: 'eco-1', eco_number: 'ECO-2026-001' },
    product: { id: 'prod-1', name: 'Main Chassis', part_number: 'CHS-100' },
    distributions: [
      { id: 'dist-1', department: 'ENGINEERING', acknowledgement_status: 'ACKNOWLEDGED' },
      { id: 'dist-2', department: 'QUALITY', acknowledgement_status: 'PENDING' },
    ],
    dispositions: [
      { id: 'disp-1', disposition_type: 'REWORK' },
    ],
  },
  {
    id: 'ecn-2',
    ecn_number: 'ECN-20261111-0002',
    title: '[ECN] Power Capacitor Second Sourcing',
    status: 'DRAFT',
    effective_date: '2026-12-15T00:00:00Z',
    eco: { id: 'eco-2', eco_number: 'ECO-2026-002' },
    product: { id: 'prod-2', name: 'Power Module', part_number: 'PWR-02' },
    distributions: [
      { id: 'dist-3', department: 'PROCUREMENT', acknowledgement_status: 'PENDING' },
    ],
    dispositions: [],
  },
];

const mockEcnDetailIssued = {
  id: 'ecn-detail-1',
  ecn_number: 'ECN-20261111-0001',
  title: '[ECN] Frame bolt torque redesign',
  status: 'ISSUED',
  effective_date: '2026-12-01T00:00:00Z',
  change_summary: 'Upgraded fastener grade from 4.8 to 8.8 and modified torque target to 55Nm',
  reason_for_change: 'Prevent joint shearing under continuous thermal vibration',
  issued_at: '2026-11-10T12:00:00Z',
  created_at: '2026-11-10T11:00:00Z',
  creator: { id: 'lead-engineer-id', first_name: 'Lead', last_name: 'Engineer', email: 'lead@ecoflow.internal' },
  eco: {
    id: 'eco-1',
    eco_number: 'ECO-2026-001',
    title: 'Chassis Bolt Strength Upgrade',
    status: 'APPROVED',
  },
  product: {
    id: 'prod-1',
    name: 'Main Chassis Assembly',
    part_number: 'CHS-100',
    current_version: 3,
  },
  version_release: {
    id: 'rel-1',
    product_version_id: 'pver-1',
    bom_version_id: 'bver-1',
    product_version: { id: 'pver-1', version_number: 3 },
    bom_version: { id: 'bver-1', version_number: 2 },
  },
  distributions: [
    {
      id: 'dist-quality-1',
      ecn_id: 'ecn-detail-1',
      department: 'QUALITY',
      acknowledgement_status: 'PENDING',
      comments: null,
      acknowledged_at: null,
    },
    {
      id: 'dist-prod-1',
      ecn_id: 'ecn-detail-1',
      department: 'PRODUCTION',
      acknowledgement_status: 'ACKNOWLEDGED',
      comments: 'Work instructions and assembly line calibrated.',
      acknowledged_at: '2026-11-10T14:00:00Z',
      acknowledged_by: 'lead-engineer-id',
      acknowledger: { id: 'lead-engineer-id', first_name: 'Lead', last_name: 'Engineer' },
    },
  ],
  dispositions: [
    {
      id: 'disp-1',
      ecn_id: 'ecn-detail-1',
      part_number: 'BOLT-M5-20',
      disposition_type: 'SCRAP',
      quantity: 500,
      instructions: 'Quarantine and scrap existing grade 4.8 inventory at warehouse',
      responsible_department: 'INVENTORY',
      created_at: '2026-11-10T12:30:00Z',
    },
  ],
};

function renderWithClient(ui: React.ReactElement, initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Frontend Engineering Change Notice (ECN) Test Suite (Milestone 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(ProductService, 'listProducts').mockResolvedValue({ data: [] } as any);
  });

  it('TC-FE-ECN-01: Renders ECN List page with change notice records and department distribution chips', async () => {
    vi.spyOn(ECNService, 'listECNs').mockResolvedValue({
      data: mockEcnList as any,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    } as any);

    renderWithClient(
      <Routes>
        <Route path="/ecns" element={<ECNList />} />
      </Routes>,
      '/ecns'
    );

    await waitFor(() => {
      expect(screen.getByText('ECN-20261111-0001')).toBeDefined();
      expect(screen.getByText('[ECN] Frame bolt torque redesign')).toBeDefined();
      expect(screen.getByText('ECN-20261111-0002')).toBeDefined();
    });
  });

  it('TC-FE-ECN-02: Renders ECN Detail page with release traceability and distribution tracking', async () => {
    vi.spyOn(ECNService, 'getECN').mockResolvedValue(mockEcnDetailIssued as any);

    renderWithClient(
      <Routes>
        <Route path="/ecns/:id" element={<ECNDetail />} />
      </Routes>,
      '/ecns/ecn-detail-1'
    );

    await waitFor(() => {
      expect(screen.getByText('ECN-20261111-0001')).toBeDefined();
      expect(screen.getByText('[ECN] Frame bolt torque redesign')).toBeDefined();
    });

    // Verify Traceability Cards
    expect(screen.getByText('ECO-2026-001')).toBeDefined();
    expect(screen.getByText(/v3/)).toBeDefined(); // Product Version
    expect(screen.getByText(/v2/)).toBeDefined(); // BOM Version

    // Verify Department Distribution Rows
    expect(screen.getByText('QUALITY')).toBeDefined();
    expect(screen.getByText('PRODUCTION')).toBeDefined();
    expect(screen.getByText('"Work instructions and assembly line calibrated."')).toBeDefined();

    // Verify Material Disposition Table
    expect(screen.getByText('BOLT-M5-20')).toBeDefined();
    expect(screen.getByText('SCRAP')).toBeDefined();
    expect(screen.getByText(/Qty: 500/)).toBeDefined();
  });

  it('TC-FE-ECN-03: Department acknowledgement signoff flow calls acknowledgeDistribution', async () => {
    vi.spyOn(ECNService, 'getECN').mockResolvedValue(mockEcnDetailIssued as any);
    const ackSpy = vi.spyOn(ECNService, 'acknowledgeDistribution').mockResolvedValue({
      id: 'dist-quality-1',
      acknowledgement_status: 'ACKNOWLEDGED',
    } as any);

    renderWithClient(
      <Routes>
        <Route path="/ecns/:id" element={<ECNDetail />} />
      </Routes>,
      '/ecns/ecn-detail-1'
    );

    await waitFor(() => {
      expect(screen.getByText('ECN-20261111-0001')).toBeDefined();
    });

    // Find and click the Acknowledge button for QUALITY department
    const ackButtons = screen.getAllByRole('button', { name: /Acknowledge/i });
    expect(ackButtons.length).toBeGreaterThan(0);
    fireEvent.click(ackButtons[0]);

    // Modal appears
    await waitFor(() => {
      expect(screen.getByText('Acknowledge Notice Receipt')).toBeDefined();
    });

    // Enter acknowledgement comments
    const commentInput = screen.getByPlaceholderText(/Reviewed line tooling/i);
    fireEvent.change(commentInput, {
      target: { value: 'Receiving inspection gauge updated to 8.8 grade specifications.' },
    });

    // Confirm Signoff
    const confirmBtn = screen.getByRole('button', { name: /Confirm Sign-Off/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(ackSpy).toHaveBeenCalledWith(
        'ecn-detail-1',
        'dist-quality-1',
        'Receiving inspection gauge updated to 8.8 grade specifications.'
      );
    });
  });

  it('TC-FE-ECN-04: Add material disposition modal calls addDisposition', async () => {
    vi.spyOn(ECNService, 'getECN').mockResolvedValue(mockEcnDetailIssued as any);
    const addDispSpy = vi.spyOn(ECNService, 'addDisposition').mockResolvedValue({
      id: 'disp-2',
      disposition_type: 'REWORK',
    } as any);

    renderWithClient(
      <Routes>
        <Route path="/ecns/:id" element={<ECNDetail />} />
      </Routes>,
      '/ecns/ecn-detail-1'
    );

    await waitFor(() => {
      expect(screen.getByText('ECN-20261111-0001')).toBeDefined();
    });

    // Click Add Disposition button
    const addBtn = screen.getByRole('button', { name: /Add Disposition/i });
    fireEvent.click(addBtn);

    // Modal appears
    await waitFor(() => {
      expect(screen.getByText('Add Material Disposition')).toBeDefined();
    });

    // Fill form
    const partInput = screen.getByPlaceholderText('e.g. BRKT-CHS-001');
    fireEvent.change(partInput, { target: { value: 'BRK-500' } });

    const instructionsInput = screen.getByPlaceholderText(/Detailed instructions for line quarantine/i);
    fireEvent.change(instructionsInput, { target: { value: 'Re-drill clearance hole to 6.2mm' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Record Disposition/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(addDispSpy).toHaveBeenCalledWith(
        'ecn-detail-1',
        expect.objectContaining({
          partNumber: 'BRK-500',
          instructions: 'Re-drill clearance hole to 6.2mm',
        })
      );
    });
  });

  it('TC-FE-ECN-05: Marking ECN completed invokes completeECN', async () => {
    vi.spyOn(ECNService, 'getECN').mockResolvedValue(mockEcnDetailIssued as any);
    const completeSpy = vi.spyOn(ECNService, 'completeECN').mockResolvedValue({
      ...mockEcnDetailIssued,
      status: 'COMPLETED',
    } as any);

    renderWithClient(
      <Routes>
        <Route path="/ecns/:id" element={<ECNDetail />} />
      </Routes>,
      '/ecns/ecn-detail-1'
    );

    await waitFor(() => {
      expect(screen.getByText('ECN-20261111-0001')).toBeDefined();
    });

    const completeBtn = screen.getByRole('button', { name: /Mark Completed/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith('ecn-detail-1');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ECRList } from '../src/pages/ecrs/ECRList';
import { ECRDetail } from '../src/pages/ecrs/ECRDetail';
import { ECRService, ProductService, BOMService } from '../src/services';

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'engineer-user-id',
      email: 'lead.engineer@ecoflow.internal',
      firstName: 'Lead',
      lastName: 'Engineer',
      roles: ['LEAD_ENGINEER'],
      permissions: ['ecr:create', 'ecr:read', 'ecr:review', 'ecr:decide', 'ecr:promote'],
    },
    isAuthenticated: true,
    hasRole: (role: string) => role === 'LEAD_ENGINEER' || role === 'ADMINISTRATOR',
    hasPermission: (perm: string) => ['ecr:create', 'ecr:read', 'ecr:review', 'ecr:decide', 'ecr:promote'].includes(perm),
  }),
}));

const mockEcrList = [
  {
    id: 'ecr-1',
    ecr_number: 'ECR-20261110-0001',
    title: 'Frame bolt thread stripping',
    description: 'Stripping occurs under 40Nm assembly torque at Station 2',
    request_type: 'DEFECT',
    priority: 'HIGH',
    status: 'SUBMITTED',
    product: { part_number: 'CHS-100', name: 'Main Chassis' },
    submitter: { first_name: 'Bob', last_name: 'Operator', email: 'bob@ecoflow.internal' },
    submitted_at: '2026-11-10T08:00:00Z',
  },
  {
    id: 'ecr-2',
    ecr_number: 'ECR-20261110-0002',
    title: 'Alternate capacitor second-sourcing',
    description: 'Component shortage on primary 100uF tantalum',
    request_type: 'IMPROVEMENT',
    priority: 'MEDIUM',
    status: 'ACCEPTED',
    product: { part_number: 'PCB-PWR-01', name: 'Power Board' },
    submitter: { first_name: 'Alice', last_name: 'Procurement', email: 'alice@ecoflow.internal' },
    submitted_at: '2026-11-10T09:00:00Z',
  },
];

const mockEcrSubmitted = {
  id: 'ecr-detail-1',
  ecr_number: 'ECR-20261110-0001',
  title: 'Frame bolt thread stripping',
  description: 'Stripping occurs under 40Nm assembly torque at Station 2',
  request_type: 'DEFECT',
  priority: 'HIGH',
  status: 'SUBMITTED',
  product_id: 'prod-1',
  bom_id: 'bom-1',
  affected_part_number: 'BOLT-M5-20',
  suggested_solution: 'Change grade from 4.8 to 8.8 high tensile steel',
  submitted_by: 'operator-1',
  submitted_at: '2026-11-10T08:00:00Z',
  submitter: { id: 'operator-1', first_name: 'Bob', last_name: 'Operator', email: 'bob@ecoflow.internal' },
  product: { id: 'prod-1', name: 'Main Chassis', part_number: 'CHS-100' },
  bom: { id: 'bom-1', bom_number: 'BOM-CHS-100' },
};

const mockEcrUnderReview = {
  ...mockEcrSubmitted,
  id: 'ecr-detail-2',
  status: 'UNDER_REVIEW',
  assigned_to: 'engineer-user-id',
  assignee: { id: 'engineer-user-id', first_name: 'Lead', last_name: 'Engineer', email: 'lead@ecoflow.internal' },
  reviewed_at: '2026-11-10T09:30:00Z',
  review_comments: 'Investigating line torque wrench calibration data.',
};

const mockEcrAccepted = {
  ...mockEcrSubmitted,
  id: 'ecr-detail-3',
  status: 'ACCEPTED',
  reviewed_at: '2026-11-10T10:00:00Z',
  review_comments: 'Confirmed torque failure. Approved for ECO promotion.',
};

const mockEcrPromoted = {
  ...mockEcrSubmitted,
  id: 'ecr-detail-4',
  status: 'PROMOTED',
  promoted_eco_id: 'eco-promoted-1',
  promoted_eco: {
    id: 'eco-promoted-1',
    eco_number: 'ECO-20261110-4001',
    status: 'DRAFT',
  },
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Frontend ECR User Experience Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-FE-ECR-01: Renders ECR List with requests, badges, and filters', async () => {
    vi.spyOn(ECRService, 'listECRs').mockResolvedValue({
      data: mockEcrList as any,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    } as any);

    renderWithClient(
      <MemoryRouter initialEntries={['/ecrs']}>
        <Routes>
          <Route path="/ecrs" element={<ECRList />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('ECR-20261110-0001')).toBeDefined();
      expect(screen.getByText('Frame bolt thread stripping')).toBeDefined();
      expect(screen.getByText('ECR-20261110-0002')).toBeDefined();
    });

    expect(screen.getByText('Submit Request')).toBeDefined();
    expect(screen.getByPlaceholderText(/Search title, ECR #, part.../)).toBeDefined();
  });

  it('TC-FE-ECR-02: Submit Request modal validates input and submits new change request', async () => {
    vi.spyOn(ECRService, 'listECRs').mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } } as any);
    vi.spyOn(ProductService, 'listProducts').mockResolvedValue({ data: [] } as any);
    vi.spyOn(BOMService, 'listBOMs').mockResolvedValue({ data: [] } as any);
    const createSpy = vi.spyOn(ECRService, 'createECR').mockResolvedValue({ id: 'new-ecr-id' } as any);

    renderWithClient(
      <MemoryRouter initialEntries={['/ecrs']}>
        <Routes>
          <Route path="/ecrs" element={<ECRList />} />
        </Routes>
      </MemoryRouter>
    );

    // Open submit modal
    const submitBtns = await screen.findAllByRole('button', { name: /Submit Request/i });
    fireEvent.click(submitBtns[0]);

    // Check modal contents
    expect(screen.getByText('Submit Engineering Change Request')).toBeDefined();
    expect(screen.getByText(/Attachments Restricted \(Coming Soon\)/i)).toBeDefined();

    // Fill form
    const titleInput = screen.getByPlaceholderText(/Chassis bracket bolt clearance interference/i);
    const descInput = screen.getByPlaceholderText(/Detailed explanation of the issue encountered on the line/i);

    fireEvent.change(titleInput, { target: { value: 'Solder bridge defect on IC2' } });
    fireEvent.change(descInput, { target: { value: 'Bridging observed across pins 14-16 during reflow inspection' } });

    // Submit form
    const formSubmitBtn = screen.getByRole('button', { name: 'Confirm Submission' });
    fireEvent.click(formSubmitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Solder bridge defect on IC2',
          description: 'Bridging observed across pins 14-16 during reflow inspection',
          requestType: 'DEFECT',
        })
      );
    });
  });

  it('TC-FE-ECR-03: ECR Detail renders problem description and hardware context', async () => {
    vi.spyOn(ECRService, 'getECR').mockResolvedValue(mockEcrSubmitted as any);

    renderWithClient(
      <MemoryRouter initialEntries={['/ecrs/ecr-detail-1']}>
        <Routes>
          <Route path="/ecrs/:id" element={<ECRDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('ECR-20261110-0001')).toBeDefined();
      expect(screen.getByText('Stripping occurs under 40Nm assembly torque at Station 2')).toBeDefined();
      expect(screen.getByText('BOLT-M5-20')).toBeDefined();
      expect(screen.getByText('CHS-100 — Main Chassis')).toBeDefined();
    });
  });

  it('TC-FE-ECR-04: Reviewer action controls: Start Review transitions from SUBMITTED to UNDER_REVIEW', async () => {
    vi.spyOn(ECRService, 'getECR').mockResolvedValue(mockEcrSubmitted as any);
    const startReviewSpy = vi.spyOn(ECRService, 'startReview').mockResolvedValue({
      ...mockEcrSubmitted,
      status: 'UNDER_REVIEW',
    } as any);

    renderWithClient(
      <MemoryRouter initialEntries={['/ecrs/ecr-detail-1']}>
        <Routes>
          <Route path="/ecrs/:id" element={<ECRDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Start Formal Review')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Start Formal Review'));

    // Confirmation modal appears
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm Start Review/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirm Start Review/i }));

    await waitFor(() => {
      expect(startReviewSpy).toHaveBeenCalledWith('ecr-detail-1', undefined);
    });
  });

  it('TC-FE-ECR-05: Reviewer action controls: Accept and Request Info buttons appear on UNDER_REVIEW', async () => {
    vi.spyOn(ECRService, 'getECR').mockResolvedValue(mockEcrUnderReview as any);
    const acceptSpy = vi.spyOn(ECRService, 'acceptECR').mockResolvedValue({
      ...mockEcrUnderReview,
      status: 'ACCEPTED',
    } as any);

    renderWithClient(
      <MemoryRouter initialEntries={['/ecrs/ecr-detail-2']}>
        <Routes>
          <Route path="/ecrs/:id" element={<ECRDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Accept Change Request')).toBeDefined();
      expect(screen.getByText('Request More Information')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Accept Change Request'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm Acceptance/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirm Acceptance/i }));

    await waitFor(() => {
      expect(acceptSpy).toHaveBeenCalledWith('ecr-detail-2', undefined);
    });
  });

  it('TC-FE-ECR-06: Promote to ECO action on ACCEPTED status calls promoteToECO', async () => {
    vi.spyOn(ECRService, 'getECR').mockResolvedValue(mockEcrAccepted as any);
    vi.spyOn(ProductService, 'listProducts').mockResolvedValue({ data: [] } as any);
    vi.spyOn(BOMService, 'listBOMs').mockResolvedValue({ data: [] } as any);
    const promoteSpy = vi.spyOn(ECRService, 'promoteToECO').mockResolvedValue({
      eco: { id: 'eco-created-99' },
      ecr: { ...mockEcrAccepted, status: 'PROMOTED' },
    } as any);

    renderWithClient(
      <MemoryRouter initialEntries={['/ecrs/ecr-detail-3']}>
        <Routes>
          <Route path="/ecrs/:id" element={<ECRDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // Promote button appears in header and sidebar
    const promoteBtns = await screen.findAllByText('Promote to ECO');
    expect(promoteBtns.length).toBeGreaterThan(0);
    fireEvent.click(promoteBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Promote ECR to Change Order (ECO)')).toBeDefined();
    });

    const confirmBtn = screen.getByRole('button', { name: /Promote & Open ECO/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(promoteSpy).toHaveBeenCalledWith(
        'ecr-detail-3',
        expect.objectContaining({
          ecoNumber: expect.stringContaining('ECO-'),
          productId: 'prod-1',
          bomId: 'bom-1',
        })
      );
    });
  });

  it('TC-FE-ECR-07: Promoted ECR renders linked ECO card with navigation link', async () => {
    vi.spyOn(ECRService, 'getECR').mockResolvedValue(mockEcrPromoted as any);

    renderWithClient(
      <MemoryRouter initialEntries={['/ecrs/ecr-detail-4']}>
        <Routes>
          <Route path="/ecrs/:id" element={<ECRDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Promoted to Engineering Change Order')).toBeDefined();
      expect(screen.getByText('ECO-20261110-4001')).toBeDefined();
      expect(screen.getByText('Open ECO Workspace')).toBeDefined();
    });
  });
});

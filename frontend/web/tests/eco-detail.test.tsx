import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ECODetail } from '../src/pages/ecos/ECODetail';
import { ECOService } from '../src/services';

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'author-user-id',
      email: 'lead.engineer@ecoflow.internal',
      firstName: 'Lead',
      lastName: 'Engineer',
      roles: ['LEAD_ENGINEER'],
      permissions: ['eco:edit', 'eco:submit'],
    },
    isAuthenticated: true,
    hasRole: (role: string) => role === 'LEAD_ENGINEER',
    hasPermission: (perm: string) => perm === 'eco:edit',
  }),
}));

const mockEcoChangesRequested = {
  id: 'eco-test-1',
  eco_number: 'ECO-2026-0001',
  title: 'Chassis Stiffener Enhancement',
  description: 'Reinforce mounting brackets for vibration resistance',
  priority: 'HIGH',
  status: 'CHANGES_REQUESTED',
  active_revision_no: 1,
  created_by: 'author-user-id',
  created_at: '2026-11-08T00:00:00Z',
  updated_at: '2026-11-09T00:00:00Z',
  product: {
    part_number: 'PRD-CHASSIS-01',
    current_version: 1,
  },
  eco_revisions: [
    {
      eco_id: 'eco-test-1',
      revision_number: 1,
      status: 'CHANGES_REQUESTED',
      change_summary: 'Initial revision proposing bracket thickness change',
      created_at: '2026-11-08T00:00:00Z',
      changes: [
        {
          id: 'change-1',
          revision_number: 1,
          change_type: 'SPECIFICATION_CHANGE',
          change_target: 'COMPONENT',
          field_name: 'BRACKET-THICKNESS',
          old_value: '2.0mm',
          new_value: '3.5mm',
        },
      ],
      approval: {
        id: 'appr-1',
        revision_number: 1,
        decision: 'CHANGES_REQUESTED',
        comments: 'Thickness of 3.5mm exceeds maximum allowable frame tolerance. Please adjust to 2.8mm.',
        created_at: '2026-11-09T00:00:00Z',
        approver: {
          first_name: 'Jane',
          last_name: 'Approver',
          email: 'jane@ecoflow.internal',
        },
      },
    },
  ],
};

const mockEcoMultiRevisionDraft = {
  id: 'eco-test-2',
  eco_number: 'ECO-2026-0002',
  title: 'Multi-Revision Gearbox',
  priority: 'MEDIUM',
  status: 'DRAFT',
  active_revision_no: 2,
  created_by: 'author-user-id',
  created_at: '2026-11-08T00:00:00Z',
  updated_at: '2026-11-10T00:00:00Z',
  product: {
    part_number: 'PRD-GEARBOX-01',
    current_version: 2,
  },
  eco_revisions: [
    {
      eco_id: 'eco-test-2',
      revision_number: 2,
      status: 'DRAFT',
      change_summary: 'Revision 2 - Adjusted to 2.8mm bracket thickness',
      created_at: '2026-11-10T00:00:00Z',
      changes: [
        {
          id: 'change-2-cloned',
          revision_number: 2,
          change_type: 'SPECIFICATION_CHANGE',
          change_target: 'COMPONENT',
          field_name: 'BRACKET-THICKNESS',
          old_value: '2.0mm',
          new_value: '2.8mm',
        },
      ],
    },
    {
      eco_id: 'eco-test-2',
      revision_number: 1,
      status: 'CHANGES_REQUESTED',
      change_summary: 'Initial revision proposing 3.5mm thickness',
      created_at: '2026-11-08T00:00:00Z',
      changes: [
        {
          id: 'change-1-historical',
          revision_number: 1,
          change_type: 'SPECIFICATION_CHANGE',
          change_target: 'COMPONENT',
          field_name: 'BRACKET-THICKNESS',
          old_value: '2.0mm',
          new_value: '3.5mm',
        },
      ],
      approval: {
        id: 'appr-1',
        revision_number: 1,
        decision: 'CHANGES_REQUESTED',
        comments: 'Please revise thickness to 2.8mm',
        created_at: '2026-11-09T00:00:00Z',
        approver: {
          first_name: 'Jane',
          last_name: 'Approver',
        },
      },
    },
  ],
};

function renderECODetail(ecoId: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/ecos/${ecoId}`]}>
        <Routes>
          <Route path="/ecos/:id" element={<ECODetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ECODetail Component - Milestone 2 Frontend Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-FE-01: Displays Reviewer Feedback Banner when active revision is in CHANGES_REQUESTED', async () => {
    vi.spyOn(ECOService, 'getECO').mockResolvedValue(mockEcoChangesRequested as any);

    renderECODetail('eco-test-1');

    await waitFor(() => {
      expect(screen.getByText('Reviewer Feedback — Changes Requested')).toBeDefined();
    });

    // Reviewer feedback comments are rendered (may appear in both feedback banner and signoff trail)
    expect(
      screen.getAllByText(/Thickness of 3.5mm exceeds maximum allowable frame tolerance/).length
    ).toBeGreaterThan(0);

    // Reviewer name is displayed
    expect(screen.getAllByText(/Jane Approver/).length).toBeGreaterThan(0);

    // Action button to Create Revision 2 is visible
    const createRevBtns = screen.getAllByRole('button', { name: /Create Revision 2/i });
    expect(createRevBtns.length).toBeGreaterThan(0);
  });

  it('TC-FE-02: Renders Create Revision modal when clicking Create Revision N+1 action', async () => {
    vi.spyOn(ECOService, 'getECO').mockResolvedValue(mockEcoChangesRequested as any);

    renderECODetail('eco-test-1');

    await waitFor(() => {
      expect(screen.getByText('Reviewer Feedback — Changes Requested')).toBeDefined();
    });

    const createRevBtn = screen.getAllByRole('button', { name: /Create Revision 2/i })[0];
    fireEvent.click(createRevBtn);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText('Initialize iterative change draft')).toBeDefined();
      expect(screen.getByPlaceholderText(/Revision 2 - Addressed reviewer feedback/)).toBeDefined();
    });
  });

  it('TC-FE-03: Displays Edit and Delete buttons for change items in active DRAFT revision', async () => {
    vi.spyOn(ECOService, 'getECO').mockResolvedValue(mockEcoMultiRevisionDraft as any);

    renderECODetail('eco-test-2');

    await waitFor(() => {
      expect(screen.getByText('Revision 2 Change Items')).toBeDefined();
    });

    // Actions header is present in draft table
    expect(screen.getByText('Actions')).toBeDefined();

    // Edit button (Pencil) and Delete button (Trash) titles are present
    expect(screen.getByTitle('Edit Change Item')).toBeDefined();
    expect(screen.getByTitle('Delete Change Item')).toBeDefined();
  });

  it('TC-FE-04: Historical revision switching renders read-only banner and hides editing controls', async () => {
    vi.spyOn(ECOService, 'getECO').mockResolvedValue(mockEcoMultiRevisionDraft as any);

    renderECODetail('eco-test-2');

    await waitFor(() => {
      expect(screen.getByText('All Revisions (2)')).toBeDefined();
    });

    // Click on Revision 1 in revision history list
    const rev1Btn = screen.getByRole('button', { name: /Initial revision proposing 3.5mm thickness/ });
    fireEvent.click(rev1Btn);

    // Notice appears
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Switch to Active Revision/i })).toBeDefined();
    });
    expect(screen.getByText(/Historical Revision 1/)).toBeDefined();

    // Actions column and Edit/Delete buttons are hidden for historical revision
    expect(screen.queryByText('Actions')).toBeNull();
    expect(screen.queryByTitle('Edit Change Item')).toBeNull();
    expect(screen.queryByTitle('Delete Change Item')).toBeNull();
  });

  it('TC-FE-05: Renders loading state while fetching ECO', () => {
    vi.spyOn(ECOService, 'getECO').mockReturnValue(new Promise(() => {})); // Never resolves

    renderECODetail('eco-test-loading');

    expect(screen.getByText('Loading ECO workspace...')).toBeDefined();
  });
});

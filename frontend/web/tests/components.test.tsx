import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StatusBadge, PriorityBadge } from '../src/components/ui/Badges';
import { StatCard } from '../src/components/ui/Cards';
import { Button } from '../src/components/ui/Button';
import { formatCurrency, formatDate } from '../src/lib/utils';

describe('ECOFlow Web Components & Utilities Suite', () => {
  it('formats currency correctly with two decimal places', () => {
    expect(formatCurrency(12.5)).toBe('$12.50');
    expect(formatCurrency('100.99')).toBe('$100.99');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(null)).toBe('$0.00');
  });

  it('formats dates consistently', () => {
    const formatted = formatDate('2026-11-07T00:00:00.000Z');
    expect(formatted).toContain('2026');
    expect(formatDate(null)).toBe('—');
  });

  it('renders StatusBadge with normalized labels', () => {
    render(<StatusBadge status="UNDER_REVIEW" />);
    expect(screen.getByText('UNDER REVIEW')).toBeDefined();
  });

  it('renders PriorityBadge with correct styling text', () => {
    render(<PriorityBadge priority="CRITICAL" />);
    expect(screen.getByText('CRITICAL')).toBeDefined();
  });

  it('renders StatCard with value and label', () => {
    render(<StatCard title="Active ECOs" value={42} description="Awaiting signoff" />);
    expect(screen.getByText('Active ECOs')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('Awaiting signoff')).toBeDefined();
  });

  it('renders Button with loading state disabled', () => {
    render(
      <Button isLoading disabled={false}>
        Save Changes
      </Button>
    );
    const btn = screen.getByRole('button');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });
});

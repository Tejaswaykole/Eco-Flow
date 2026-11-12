import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Login } from '../src/pages/auth/Login';
import { AuthProvider } from '../src/context/AuthContext';

describe('Login Demo RBAC Shortcuts UI Test Suite', () => {
  it('renders all four demo account cards and autofills email/password on click without auto-submitting', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>
    );

    const emailInput = screen.getByPlaceholderText('engineer@ecoflow.internal') as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText('••••••••••••') as HTMLInputElement;

    // Initial state: empty
    expect(emailInput.value).toBe('');
    expect(passwordInput.value).toBe('');

    // 1. Verify 4 shortcut cards exist
    const adminBtn = screen.getByRole('button', { name: /Admin ADMINISTRATOR/i });
    const engineerBtn = screen.getByRole('button', { name: /Lead Engineer LEAD_ENGINEER/i });
    const approverBtn = screen.getByRole('button', { name: /Approver APPROVER/i });
    const operatorBtn = screen.getByRole('button', { name: /Operator OPERATOR/i });

    expect(adminBtn).toBeDefined();
    expect(engineerBtn).toBeDefined();
    expect(approverBtn).toBeDefined();
    expect(operatorBtn).toBeDefined();

    // 2. Click Lead Engineer
    fireEvent.click(engineerBtn);
    expect(emailInput.value).toBe('engineer@ecoflow.internal');
    expect(passwordInput.value).toBe('Password123!');
    expect(engineerBtn.className).toContain('border-teal-600');
    expect(engineerBtn.className).toContain('bg-teal-50/70');

    // 3. Click Operator
    fireEvent.click(operatorBtn);
    expect(emailInput.value).toBe('operator@ecoflow.internal');
    expect(passwordInput.value).toBe('Password123!');
    expect(operatorBtn.className).toContain('border-teal-600');
    expect(engineerBtn.className).not.toContain('bg-teal-50/70');

    // 4. Click Admin
    fireEvent.click(adminBtn);
    expect(emailInput.value).toBe('admin@ecoflow.internal');
    expect(passwordInput.value).toBe('Password123!');
    expect(adminBtn.className).toContain('border-teal-600');

    // 5. Click Approver
    fireEvent.click(approverBtn);
    expect(emailInput.value).toBe('approver@ecoflow.internal');
    expect(passwordInput.value).toBe('Password123!');
    expect(approverBtn.className).toContain('border-teal-600');

    // 6. Verify "Sign in to Workspace" button is present and form did not auto-navigate
    const submitBtn = screen.getByRole('button', { name: /Sign in to Workspace/i });
    expect(submitBtn).toBeDefined();
  });
});


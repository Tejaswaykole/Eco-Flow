import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import '../src/lib/utils';
import { ProductService, UserService, AuthService } from '../src/services';
import { apiClient } from '../src/lib/api';

describe('Frontend API Integration & Connectivity Fixes Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe('Product Status & Update Service', () => {
    it('calls PATCH /products/:id with updated status and payload', async () => {
      const mockProduct = {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Updated Controller',
        description: 'New revision description',
        status: 'ACTIVE',
      };

      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: {
          success: true,
          data: mockProduct,
        },
      });

      const result = await ProductService.updateProduct(mockProduct.id, {
        name: 'Updated Controller',
        description: 'New revision description',
        status: 'ACTIVE',
      });

      expect(patchSpy).toHaveBeenCalledWith(
        `/products/${mockProduct.id}`,
        {
          name: 'Updated Controller',
          description: 'New revision description',
          status: 'ACTIVE',
        }
      );
      expect(result.status).toBe('ACTIVE');
    });

    it('supports ARCHIVED status in product update', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: {
          success: true,
          data: { id: 'test-id', status: 'ARCHIVED' },
        },
      });

      const res = await ProductService.updateProduct('test-id', { status: 'ARCHIVED' });
      expect(patchSpy).toHaveBeenCalledWith('/products/test-id', { status: 'ARCHIVED' });
      expect(res.status).toBe('ARCHIVED');
    });
  });

  describe('User Service Completion', () => {
    it('fetches single user details via getUserById', async () => {
      const mockUserDetail = {
        id: 'user-uuid-1234',
        email: 'lead.engineer@ecoflow.local',
        first_name: 'Lead',
        last_name: 'Engineer',
        status: 'ACTIVE',
        created_at: '2026-11-07T00:00:00.000Z',
        user_roles: [
          {
            id: 'role-link-1',
            is_primary: true,
            role: {
              id: 'role-uuid-1',
              name: 'LEAD_ENGINEER',
              description: 'Lead engineering approvals and BOM design',
            },
          },
        ],
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: mockUserDetail,
        },
      });

      const user = await UserService.getUserById('user-uuid-1234');
      expect(getSpy).toHaveBeenCalledWith('/users/user-uuid-1234');
      expect(user.email).toBe('lead.engineer@ecoflow.local');
      expect(user.user_roles[0].role.name).toBe('LEAD_ENGINEER');
    });
  });

  describe('Registration Response Typing', () => {
    it('returns structured register payload from backend without inventing tokens', async () => {
      const mockRegisterResult = {
        id: 'new-user-id',
        email: 'operator@ecoflow.local',
        firstName: 'Shop',
        lastName: 'Floor',
        status: 'PENDING',
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: {
          success: true,
          data: mockRegisterResult,
        },
      });

      const response = await AuthService.register({
        email: 'operator@ecoflow.local',
        password: 'Password123!',
        firstName: 'Shop',
        lastName: 'Floor',
      });

      expect(postSpy).toHaveBeenCalledWith('/auth/register', {
        email: 'operator@ecoflow.local',
        password: 'Password123!',
        firstName: 'Shop',
        lastName: 'Floor',
      });
      expect(response.id).toBe('new-user-id');
      expect(response.status).toBe('PENDING');
    });
  });

  describe('BigInt Serialization', () => {
    it('serializes BigInt into standard numbers or strings in JSON without throwing', () => {
      // Test global BigInt toJSON prototype behavior
      const testObj = {
        file_name: 'assembly_cad.step',
        file_size: BigInt(10485760), // 10MB
        large_id: BigInt(9007199254740991), // MAX_SAFE_INTEGER
      };

      const jsonStr = JSON.stringify(testObj);
      expect(jsonStr).toContain('"file_size":10485760');
      const parsed = JSON.parse(jsonStr);
      expect(parsed.file_size).toBe(10485760);
    });
  });

  describe('Session Expiry Interception & Notification Dispatch', () => {
    it('dispatches ecoflow:auth:session_expired custom event on refresh failure', async () => {
      sessionStorage.setItem('ecoflow_access_token', 'expired-token');
      sessionStorage.setItem('ecoflow_refresh_token', 'invalid-refresh-token');

      const eventListener = vi.fn();
      window.addEventListener('ecoflow:auth:session_expired', eventListener);

      // Mock axios.post to fail on refresh endpoint
      vi.spyOn(axios, 'post').mockRejectedValueOnce({
        response: { status: 401, data: { message: 'Refresh token invalid' } },
      });

      // Simulate a 401 response from an authenticated endpoint
      try {
        await apiClient.interceptors.response.handlers[0].rejected({
          config: {
            url: '/products',
            headers: {},
          },
          response: {
            status: 401,
          },
        });
      } catch (err) {
        // Expected rejection
      }

      expect(eventListener).toHaveBeenCalled();
      expect(sessionStorage.getItem('ecoflow_access_token')).toBeNull();
      expect(sessionStorage.getItem('ecoflow_refresh_token')).toBeNull();

      window.removeEventListener('ecoflow:auth:session_expired', eventListener);
    });
  });
});

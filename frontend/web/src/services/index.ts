import { apiClient, ApiResponse } from '../lib/api';
import { UserProfile, Product, ProductCategory, BOM, ECO, AuditLog } from '../types';

export const AuthService = {
  async login(credentials: { email: string; password: string }) {
    const res = await apiClient.post<ApiResponse<{ accessToken: string; refreshToken: string; user: UserProfile }>>(
      '/auth/login',
      credentials
    );
    return res.data.data;
  },

  async register(data: { email: string; password: string; firstName: string; lastName: string }) {
    const res = await apiClient.post<ApiResponse<UserProfile>>('/auth/register', data);
    return res.data.data;
  },

  async getMe() {
    const res = await apiClient.get<ApiResponse<UserProfile>>('/auth/me');
    return res.data.data;
  },

  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      sessionStorage.removeItem('ecoflow_access_token');
      sessionStorage.removeItem('ecoflow_refresh_token');
    }
  },

  async logoutAll() {
    try {
      await apiClient.post('/auth/logout-all');
    } finally {
      sessionStorage.removeItem('ecoflow_access_token');
      sessionStorage.removeItem('ecoflow_refresh_token');
    }
  },
};

export const ProductService = {
  async listProducts(page = 1, limit = 20, search?: string) {
    const res = await apiClient.get<ApiResponse<Product[]>>('/products', {
      params: { page, limit, search },
    });
    return res.data;
  },

  async getProduct(id: string) {
    const res = await apiClient.get<ApiResponse<Product>>(`/products/${id}`);
    return res.data.data;
  },

  async createProduct(payload: { partNumber: string; name: string; description?: string; categoryId: string }) {
    const res = await apiClient.post<ApiResponse<Product>>('/products', payload);
    return res.data.data;
  },

  async listCategories() {
    const res = await apiClient.get<ApiResponse<ProductCategory[]>>('/products/categories');
    return res.data.data;
  },

  async createCategory(payload: { name: string; code: string; description?: string }) {
    const res = await apiClient.post<ApiResponse<ProductCategory>>('/products/categories', payload);
    return res.data.data;
  },
};

export const BOMService = {
  async getBOM(id: string) {
    const res = await apiClient.get<ApiResponse<BOM>>(`/boms/${id}`);
    return res.data.data;
  },

  async createBOM(payload: { productId: string; bomNumber: string; description?: string }) {
    const res = await apiClient.post<ApiResponse<BOM>>('/boms', payload);
    return res.data.data;
  },

  async addComponent(
    bomId: string,
    payload: {
      partNumber: string;
      name: string;
      componentType: string;
      quantity: number;
      unitCost: number;
      unitOfMeasure?: string;
      materialType?: string;
      notes?: string;
    }
  ) {
    const res = await apiClient.post<ApiResponse<any>>(`/boms/${bomId}/components`, payload);
    return res.data.data;
  },
};

export const ECOService = {
  async listECOs(page = 1, limit = 20, status?: string) {
    const res = await apiClient.get<ApiResponse<ECO[]>>('/ecos', {
      params: { page, limit, status },
    });
    return res.data;
  },

  async getECO(id: string) {
    const res = await apiClient.get<ApiResponse<ECO>>(`/ecos/${id}`);
    return res.data.data;
  },

  async createECO(
    payload: {
      productId: string;
      bomId: string;
      ecoNumber: string;
      title: string;
      description?: string;
      priority?: string;
      changeSummary?: string;
    },
    idempotencyKey?: string
  ) {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined;
    const res = await apiClient.post<ApiResponse<ECO>>('/ecos', payload, { headers });
    return res.data.data;
  },

  async addChange(
    ecoId: string,
    payload: {
      changeType: string;
      changeTarget: string;
      fieldName: string;
      oldValue?: string;
      newValue?: string;
      description?: string;
    }
  ) {
    const res = await apiClient.post<ApiResponse<any>>(`/ecos/${ecoId}/changes`, payload);
    return res.data.data;
  },

  async submitECO(ecoId: string) {
    const res = await apiClient.post<ApiResponse<ECO>>(`/ecos/${ecoId}/submit`);
    return res.data.data;
  },

  async reviewECO(
    ecoId: string,
    payload: {
      decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
      comments?: string;
      overrideReason?: string;
    }
  ) {
    const res = await apiClient.post<ApiResponse<any>>(`/ecos/${ecoId}/review`, payload);
    return res.data.data;
  },
};

export const UserService = {
  async listUsers(page = 1, limit = 20) {
    const res = await apiClient.get<ApiResponse<any[]>>('/users', {
      params: { page, limit },
    });
    return res.data;
  },
};

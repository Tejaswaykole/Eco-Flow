import { apiClient, ApiResponse } from '../lib/api';
import { UserProfile, RegisterResponse, UserDetail, Product, ProductCategory, ProductStatus, BOM, ECO, ECR, ECN, AuditLog } from '../types';

export const AuthService = {
  async login(credentials: { email: string; password: string }) {
    const res = await apiClient.post<ApiResponse<{ accessToken: string; refreshToken: string; user: UserProfile }>>(
      '/auth/login',
      credentials
    );
    return res.data.data;
  },

  async register(data: { email: string; password: string; firstName: string; lastName: string }) {
    const res = await apiClient.post<ApiResponse<RegisterResponse>>('/auth/register', data);
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

  async updateProduct(id: string, payload: { name?: string; description?: string; status?: ProductStatus }) {
    const res = await apiClient.patch<ApiResponse<Product>>(`/products/${id}`, payload);
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

  async updateCategory(id: string, payload: { name?: string; description?: string; status?: string }) {
    const res = await apiClient.patch<ApiResponse<ProductCategory>>(`/products/categories/${id}`, payload);
    return res.data.data;
  },
};

export const BOMService = {
  async listBOMs(page = 1, limit = 50) {
    const res = await apiClient.get<ApiResponse<BOM[]>>('/boms', {
      params: { page, limit },
    });
    return res.data;
  },

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
      subAssemblyBomId?: string;
      subAssemblyVersion?: number;
      isCostOverridden?: boolean;
      costOverrideReason?: string;
    }
  ) {
    const res = await apiClient.post<ApiResponse<any>>(`/boms/${bomId}/components`, payload);
    return res.data.data;
  },

  async updateComponent(
    bomId: string,
    componentId: string,
    payload: {
      partNumber?: string;
      name?: string;
      componentType?: string;
      quantity?: number;
      unitCost?: number;
      unitOfMeasure?: string;
      materialType?: string;
      notes?: string;
      subAssemblyBomId?: string | null;
      subAssemblyVersion?: number | null;
      isCostOverridden?: boolean;
      costOverrideReason?: string | null;
    }
  ) {
    const res = await apiClient.patch<ApiResponse<any>>(`/boms/${bomId}/components/${componentId}`, payload);
    return res.data.data;
  },

  async removeComponent(bomId: string, componentId: string) {
    const res = await apiClient.delete<ApiResponse<any>>(`/boms/${bomId}/components/${componentId}`);
    return res.data.data;
  },

  async getBOMHistory(bomId: string) {
    const res = await apiClient.get<ApiResponse<any[]>>(`/boms/${bomId}/history`);
    return res.data.data;
  },

  async getBOMTree(bomId: string) {
    const res = await apiClient.get<ApiResponse<any>>(`/boms/${bomId}/tree`);
    return res.data.data;
  },

  async getBOMExploded(bomId: string) {
    const res = await apiClient.get<ApiResponse<any>>(`/boms/${bomId}/exploded`);
    return res.data.data;
  },

  async getBOMWhereUsed(bomId: string) {
    const res = await apiClient.get<ApiResponse<any[]>>(`/boms/${bomId}/where-used`);
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

  async updateChange(
    ecoId: string,
    changeId: string,
    payload: {
      changeType?: string;
      changeTarget?: string;
      fieldName?: string;
      oldValue?: string;
      newValue?: string;
      impactType?: string;
      justification?: string;
    }
  ) {
    const res = await apiClient.patch<ApiResponse<any>>(`/ecos/${ecoId}/changes/${changeId}`, payload);
    return res.data.data;
  },

  async removeChange(ecoId: string, changeId: string) {
    const res = await apiClient.delete<ApiResponse<any>>(`/ecos/${ecoId}/changes/${changeId}`);
    return res.data.data;
  },

  async createRevision(ecoId: string, payload?: { changeSummary?: string }) {
    const res = await apiClient.post<ApiResponse<any>>(`/ecos/${ecoId}/revisions`, payload || {});
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

  async getUserById(id: string) {
    const res = await apiClient.get<ApiResponse<UserDetail>>(`/users/${id}`);
    return res.data.data;
  },
};

export const ECRService = {
  async listECRs(
    page = 1,
    limit = 20,
    filters?: {
      status?: string;
      requestType?: string;
      priority?: string;
      search?: string;
      myRequests?: boolean;
    }
  ) {
    const res = await apiClient.get<ApiResponse<ECR[]>>('/ecrs', {
      params: { page, limit, ...filters },
    });
    return res.data;
  },

  async getECR(id: string) {
    const res = await apiClient.get<ApiResponse<ECR>>(`/ecrs/${id}`);
    return res.data.data;
  },

  async createECR(payload: {
    title: string;
    description: string;
    requestType: string;
    priority?: string;
    productId?: string | null;
    bomId?: string | null;
    affectedPartNumber?: string | null;
    suggestedSolution?: string | null;
  }) {
    const res = await apiClient.post<ApiResponse<ECR>>('/ecrs', payload);
    return res.data.data;
  },

  async assignECR(id: string, assignedTo: string) {
    const res = await apiClient.post<ApiResponse<ECR>>(`/ecrs/${id}/assign`, { assignedTo });
    return res.data.data;
  },

  async startReview(id: string, comments?: string) {
    const res = await apiClient.post<ApiResponse<ECR>>(`/ecrs/${id}/start-review`, { comments });
    return res.data.data;
  },

  async requestInformation(id: string, comments: string) {
    const res = await apiClient.post<ApiResponse<ECR>>(`/ecrs/${id}/request-information`, { comments });
    return res.data.data;
  },

  async resubmitECR(id: string, payload: { comments?: string; description?: string; suggestedSolution?: string }) {
    const res = await apiClient.post<ApiResponse<ECR>>(`/ecrs/${id}/resubmit`, payload);
    return res.data.data;
  },

  async acceptECR(id: string, reviewComments?: string) {
    const res = await apiClient.post<ApiResponse<ECR>>(`/ecrs/${id}/accept`, { reviewComments });
    return res.data.data;
  },

  async rejectECR(id: string, rejectionReason: string) {
    const res = await apiClient.post<ApiResponse<ECR>>(`/ecrs/${id}/reject`, { rejectionReason });
    return res.data.data;
  },

  async promoteToECO(id: string, payload: { ecoNumber: string; productId?: string; bomId?: string; changeSummary?: string }) {
    const res = await apiClient.post<ApiResponse<{ eco: any; ecr: ECR }>>(`/ecrs/${id}/promote-to-eco`, payload);
    return res.data.data;
  },
};

export const ECNService = {
  async listECNs(page = 1, limit = 20, filters?: { status?: string; department?: string; search?: string }) {
    const res = await apiClient.get<ApiResponse<ECN[]>>('/ecns', {
      params: { page, limit, ...filters },
    });
    return res.data;
  },

  async getECN(id: string) {
    const res = await apiClient.get<ApiResponse<ECN>>(`/ecns/${id}`);
    return res.data.data;
  },

  async generateECN(
    ecoId: string,
    payload: {
      effectiveDate: string;
      targetDepartments: string[];
      changeSummary?: string;
      reasonForChange?: string;
      initialDispositions?: any[];
    }
  ) {
    const res = await apiClient.post<ApiResponse<ECN>>(`/ecos/${ecoId}/generate-ecn`, payload);
    return res.data.data;
  },

  async issueECN(id: string, payload?: { effectiveDate?: string; targetDepartments?: string[]; notes?: string }) {
    const res = await apiClient.post<ApiResponse<ECN>>(`/ecns/${id}/issue`, payload || {});
    return res.data.data;
  },

  async completeECN(id: string, payload?: { notes?: string }) {
    const res = await apiClient.post<ApiResponse<ECN>>(`/ecns/${id}/complete`, payload || {});
    return res.data.data;
  },

  async cancelECN(id: string, cancellationReason: string) {
    const res = await apiClient.post<ApiResponse<ECN>>(`/ecns/${id}/cancel`, { cancellationReason });
    return res.data.data;
  },

  async acknowledgeDistribution(ecnId: string, distributionId: string, comments?: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/ecns/${ecnId}/distributions/${distributionId}/acknowledge`, {
      comments,
    });
    return res.data.data;
  },

  async addDisposition(
    ecnId: string,
    payload: {
      productId?: string | null;
      partNumber?: string | null;
      dispositionType: string;
      quantity?: number | null;
      instructions: string;
      responsibleDepartment: string;
    }
  ) {
    const res = await apiClient.post<ApiResponse<any>>(`/ecns/${ecnId}/dispositions`, payload);
    return res.data.data;
  },
};


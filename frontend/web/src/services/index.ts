import { apiClient, ApiResponse } from '../lib/api';
import {
  UserProfile,
  RegisterResponse,
  UserDetail,
  Product,
  ProductCategory,
  ProductStatus,
  BOM,
  ECO,
  ECR,
  ECN,
  AuditLog,
  Supplier,
  SupplierProduct,
  SupplierDashboardStats,
  RFQ,
  SupplierQuotation,
  NegotiationEvent,
  SupplierPerformanceAnalytics,
  Warehouse,
  InventoryItem,
  InventoryTransaction,
  PurchaseOrder,
  WorkOrder,
  QualityInspection,
  QualityNonConformance,
} from '../types';

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
  async listProducts(page = 1, limit = 20, search?: string, categoryId?: string) {
    const res = await apiClient.get<ApiResponse<Product[]>>('/products', {
      params: { page, limit, search: search || undefined, categoryId: categoryId || undefined },
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

  async releaseBOM(id: string) {
    const res = await apiClient.post<ApiResponse<BOM>>(`/boms/${id}/release`);
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

export const SupplierService = {
  async getDashboardStats() {
    const res = await apiClient.get<ApiResponse<SupplierDashboardStats>>('/suppliers/dashboard-stats');
    return res.data.data;
  },

  async listSuppliers(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    categoryId?: string;
  }) {
    const res = await apiClient.get<{
      success: boolean;
      suppliers: Supplier[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/suppliers', { params });
    return res.data;
  },

  async getSupplier(id: string) {
    const res = await apiClient.get<ApiResponse<Supplier>>(`/suppliers/${id}`);
    return res.data.data;
  },

  async createSupplier(payload: {
    supplierCode?: string;
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    rating?: number;
  }) {
    const res = await apiClient.post<ApiResponse<Supplier>>('/suppliers', payload);
    return res.data.data;
  },

  async updateSupplier(id: string, payload: Partial<Supplier>) {
    const res = await apiClient.patch<ApiResponse<Supplier>>(`/suppliers/${id}`, payload);
    return res.data.data;
  },

  async addSupplierProduct(
    supplierId: string,
    payload: {
      productId: string;
      supplierPartNumber?: string;
      leadTimeDays?: number;
      unitPrice: number;
      minimumOrderQty?: number;
      currency?: string;
      isPreferred?: boolean;
      status?: string;
      validUntil?: string | null;
    }
  ) {
    const res = await apiClient.post<ApiResponse<SupplierProduct>>(`/suppliers/${supplierId}/products`, payload);
    return res.data.data;
  },

  async bulkMapProducts(
    supplierId: string,
    payload: {
      mappings: {
        productId: string;
        supplierPartNumber?: string;
        leadTimeDays?: number;
        unitPrice: number;
        minimumOrderQty?: number;
        currency?: string;
        isPreferred?: boolean;
        status?: string;
        validUntil?: string | null;
      }[];
    }
  ) {
    const res = await apiClient.post<ApiResponse<SupplierProduct[]>>(`/suppliers/${supplierId}/products/bulk`, payload);
    return res.data.data;
  },

  async updateSupplierProduct(
    supplierId: string,
    productId: string,
    payload: {
      supplierPartNumber?: string | null;
      leadTimeDays?: number;
      unitPrice?: number;
      minimumOrderQty?: number;
      currency?: string;
      isPreferred?: boolean;
      status?: string;
      validUntil?: string | null;
    }
  ) {
    const res = await apiClient.patch<ApiResponse<SupplierProduct>>(`/suppliers/${supplierId}/products/${productId}`, payload);
    return res.data.data;
  },

  async removeSupplierProduct(supplierId: string, productId: string) {
    const res = await apiClient.delete<{ success: boolean }>(`/suppliers/${supplierId}/products/${productId}`);
    return res.data;
  },

  async getProductSuppliersComparison(productId: string) {
    const res = await apiClient.get<ApiResponse<{
      product: { id: string; part_number: string; name: string; category: string };
      suppliers: {
        supplierId: string;
        supplierCode: string;
        supplierName: string;
        supplierStatus: string;
        supplierRating: number | null;
        supplierPartNumber: string | null;
        unitPrice: number;
        currency: string;
        leadTimeDays: number;
        minimumOrderQty: number;
        isPreferred: boolean;
        status: string;
        validUntil: string | null;
        purchaseOrderCount: number;
        completedPurchaseOrderCount: number;
      }[];
    }>>(`/suppliers/products/${productId}/comparison`);
    return res.data.data;
  },

  async previewImport(supplierId: string, payload: { rows: any[]; columnMapping?: Record<string, string> }) {
    const res = await apiClient.post<ApiResponse<any>>(`/suppliers/${supplierId}/import-preview`, payload);
    return res.data.data;
  },

  async commitImport(supplierId: string, payload: { rows: any[] }) {
    const res = await apiClient.post<ApiResponse<{ success: boolean; importedCount: number }>>(`/suppliers/${supplierId}/import-commit`, payload);
    return res.data.data;
  },

  async exportData(params: { type: string; format?: 'json' | 'csv'; supplierId?: string; categoryId?: string; search?: string }) {
    if (params.format === 'csv') {
      const res = await apiClient.get('/suppliers/export', { params, responseType: 'blob' });
      return res.data;
    }
    const res = await apiClient.get<ApiResponse<any[]>>('/suppliers/export', { params });
    return res.data.data;
  },

  async listRFQs() {
    const res = await apiClient.get<ApiResponse<RFQ[]>>('/suppliers/rfqs/list');
    return res.data.data;
  },

  async createRFQ(payload: {
    title: string;
    submissionDate?: string;
    deadlineDate?: string | null;
    deliveryDate?: string | null;
    notes?: string;
    supplierIds: string[];
    items: { productId: string; quantityRequired: number; notes?: string }[];
  }) {
    const res = await apiClient.post<ApiResponse<RFQ>>('/suppliers/rfqs', payload);
    return res.data.data;
  },

  async createQuotation(payload: {
    rfqId?: string | null;
    supplierId: string;
    productId: string;
    supplierPartNumber?: string;
    offeredQuantity: number;
    unitPrice: number;
    currency?: string;
    taxAmount?: number;
    shippingAmount?: number;
    leadTimeDays?: number;
    minimumOrderQuantity?: number;
    validUntil?: string | null;
    termsConditions?: string;
    status?: string;
  }) {
    const res = await apiClient.post<ApiResponse<SupplierQuotation>>('/suppliers/quotations', payload);
    return res.data.data;
  },

  async negotiateQuotation(
    quotationId: string,
    payload: {
      eventType: 'COUNTER_OFFER' | 'REVISED_OFFER' | 'ACCEPTED' | 'REJECTED';
      counterPrice: number;
      currency?: string;
      message: string;
    }
  ) {
    const res = await apiClient.post<ApiResponse<{ event: NegotiationEvent; quotation: SupplierQuotation }>>(
      `/suppliers/quotations/${quotationId}/negotiate`,
      payload
    );
    return res.data.data;
  },

  async convertQuotationToPO(quotationId: string) {
    const res = await apiClient.post<ApiResponse<PurchaseOrder>>(`/suppliers/quotations/${quotationId}/convert-to-po`);
    return res.data.data;
  },

  async getSupplierPerformance(supplierId: string) {
    const res = await apiClient.get<ApiResponse<SupplierPerformanceAnalytics>>(`/suppliers/${supplierId}/performance`);
    return res.data.data;
  },
};

export const InventoryService = {
  async listWarehouses() {
    const res = await apiClient.get<ApiResponse<Warehouse[]>>('/inventory/warehouses');
    return res.data.data;
  },

  async createWarehouse(payload: { code: string; name: string; location?: string }) {
    const res = await apiClient.post<ApiResponse<Warehouse>>('/inventory/warehouses', payload);
    return res.data.data;
  },

  async listItems(params?: { warehouseId?: string; productId?: string }) {
    const res = await apiClient.get<ApiResponse<InventoryItem[]>>('/inventory/items', { params });
    return res.data.data;
  },

  async getItem(id: string) {
    const res = await apiClient.get<ApiResponse<InventoryItem>>(`/inventory/items/${id}`);
    return res.data.data;
  },

  async createTransaction(payload: {
    itemId: string;
    type: string;
    quantity: number;
    unitCost?: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
  }) {
    const res = await apiClient.post<ApiResponse<InventoryTransaction>>('/inventory/transactions', payload);
    return res.data.data;
  },

  async listTransactions(params?: { itemId?: string; type?: string }) {
    const res = await apiClient.get<ApiResponse<InventoryTransaction[]>>('/inventory/transactions', { params });
    return res.data.data;
  },
};

export const PurchasingService = {
  async listOrders(params?: { supplierId?: string; status?: string }) {
    const res = await apiClient.get<ApiResponse<PurchaseOrder[]>>('/purchasing/orders', { params });
    return res.data.data;
  },

  async getOrder(id: string) {
    const res = await apiClient.get<ApiResponse<PurchaseOrder>>(`/purchasing/orders/${id}`);
    return res.data.data;
  },

  async createOrder(payload: {
    supplierId: string;
    expectedDeliveryDate?: string;
    notes?: string;
    lines: Array<{
      productId: string;
      quantityOrdered: number;
      unitPrice: number;
      unitOfMeasure?: string;
    }>;
  }) {
    const res = await apiClient.post<ApiResponse<PurchaseOrder>>('/purchasing/orders', payload);
    return res.data.data;
  },

  async submitOrder(id: string) {
    const res = await apiClient.post<ApiResponse<PurchaseOrder>>(`/purchasing/orders/${id}/submit`);
    return res.data.data;
  },

  async approveOrder(id: string) {
    const res = await apiClient.post<ApiResponse<PurchaseOrder>>(`/purchasing/orders/${id}/approve`);
    return res.data.data;
  },

  async receiveGoods(
    id: string,
    payload: {
      warehouseId: string;
      items: Array<{
        lineId: string;
        quantityReceived: number;
        unitCost?: number;
      }>;
    }
  ) {
    const res = await apiClient.post<ApiResponse<PurchaseOrder>>(`/purchasing/orders/${id}/receive`, payload);
    return res.data.data;
  },
};

export const ManufacturingService = {
  async listWorkOrders(params?: { productId?: string; status?: string }) {
    const res = await apiClient.get<ApiResponse<WorkOrder[]>>('/manufacturing/orders', { params });
    return res.data.data;
  },

  async getWorkOrder(id: string) {
    const res = await apiClient.get<ApiResponse<WorkOrder>>(`/manufacturing/orders/${id}`);
    return res.data.data;
  },

  async createWorkOrder(payload: {
    productId: string;
    bomId: string;
    bomVersionId?: string;
    targetQuantity: number;
    notes?: string;
  }) {
    const res = await apiClient.post<ApiResponse<WorkOrder>>('/manufacturing/orders', payload);
    return res.data.data;
  },

  async startWorkOrder(id: string) {
    const res = await apiClient.post<ApiResponse<WorkOrder>>(`/manufacturing/orders/${id}/start`);
    return res.data.data;
  },

  async consumeMaterial(
    id: string,
    payload: {
      allocationId: string;
      warehouseId: string;
      quantityConsumed: number;
    }
  ) {
    const res = await apiClient.post<ApiResponse<any>>(`/manufacturing/orders/${id}/consume`, payload);
    return res.data.data;
  },

  async completeWorkOrder(
    id: string,
    payload: {
      completedQuantity: number;
      rejectedQuantity?: number;
      warehouseId?: string;
      notes?: string;
    }
  ) {
    const res = await apiClient.post<ApiResponse<WorkOrder>>(`/manufacturing/orders/${id}/complete`, payload);
    return res.data.data;
  },
};

export const QualityService = {
  async listInspections(params?: { type?: string; status?: string; productId?: string }) {
    const res = await apiClient.get<ApiResponse<QualityInspection[]>>('/quality/inspections', { params });
    return res.data.data;
  },

  async getInspection(id: string) {
    const res = await apiClient.get<ApiResponse<QualityInspection>>(`/quality/inspections/${id}`);
    return res.data.data;
  },

  async createInspection(payload: {
    type: string;
    productId: string;
    bomId?: string;
    workOrderId?: string;
    poId?: string;
    sampleSize?: number;
    notes?: string;
  }) {
    const res = await apiClient.post<ApiResponse<QualityInspection>>('/quality/inspections', payload);
    return res.data.data;
  },

  async recordResult(
    id: string,
    payload: {
      passedQuantity: number;
      failedQuantity: number;
      status: string;
      notes?: string;
    }
  ) {
    const res = await apiClient.post<ApiResponse<QualityInspection>>(`/quality/inspections/${id}/result`, payload);
    return res.data.data;
  },

  async listNCRs(params?: { status?: string; severity?: string }) {
    const res = await apiClient.get<ApiResponse<QualityNonConformance[]>>('/quality/ncrs', { params });
    return res.data.data;
  },

  async getNCR(id: string) {
    const res = await apiClient.get<ApiResponse<QualityNonConformance>>(`/quality/ncrs/${id}`);
    return res.data.data;
  },

  async createNCR(payload: {
    inspectionId?: string;
    productId: string;
    severity: string;
    title: string;
    description: string;
    assignedTo?: string;
  }) {
    const res = await apiClient.post<ApiResponse<QualityNonConformance>>('/quality/ncrs', payload);
    return res.data.data;
  },

  async updateNCR(
    id: string,
    payload: {
      status?: string;
      rootCause?: string;
      disposition?: string;
      capaPlan?: string;
      assignedTo?: string;
    }
  ) {
    const res = await apiClient.patch<ApiResponse<QualityNonConformance>>(`/quality/ncrs/${id}`, payload);
    return res.data.data;
  },
};

export const NotificationService = {
  async listNotifications() {
    const res = await apiClient.get<ApiResponse<any[]>>('/notifications');
    return res.data;
  },

  async getUnreadCount() {
    const res = await apiClient.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
    return res.data.data.count;
  },

  async markAsRead(id: string) {
    const res = await apiClient.patch<ApiResponse<any>>(`/notifications/${id}/read`);
    return res.data.data;
  },

  async markAllAsRead() {
    const res = await apiClient.post<ApiResponse<any>>('/notifications/mark-all-read');
    return res.data.data;
  },

  async dismissNotification(id: string) {
    const res = await apiClient.delete<ApiResponse<any>>(`/notifications/${id}`);
    return res.data.data;
  },
};

export const ApprovalsWorkflowService = {
  async listPending(domain?: string, overdue?: boolean) {
    const res = await apiClient.get<ApiResponse<any[]>>('/approvals/pending', {
      params: { domain, overdue: overdue ? 'true' : undefined },
    });
    return res.data;
  },

  async getStats() {
    const res = await apiClient.get<ApiResponse<any>>('/approvals/stats');
    return res.data.data;
  },

  async sendReminders() {
    const res = await apiClient.post<ApiResponse<any>>('/approvals/remind');
    return res.data.data;
  },
};

export const ActivityService = {
  async listActivities(params?: any) {
    const res = await apiClient.get<ApiResponse<any[]>>('/activity-timeline', { params });
    return res.data;
  },

  async getEntityTimeline(entityType: string, entityId: string) {
    const res = await apiClient.get<ApiResponse<any[]>>(`/activity-timeline/${entityType}/${entityId}`);
    return res.data;
  },
};

export const DashboardService = {
  async getMetrics() {
    const res = await apiClient.get<ApiResponse<any>>('/dashboard/metrics');
    return res.data.data;
  },
};

export const ReportsService = {
  async getEngineeringReport() {
    const res = await apiClient.get<ApiResponse<any>>('/reports/engineering');
    return res.data.data;
  },

  async getInventoryReport() {
    const res = await apiClient.get<ApiResponse<any>>('/reports/inventory');
    return res.data.data;
  },

  async getPurchasingReport() {
    const res = await apiClient.get<ApiResponse<any>>('/reports/purchasing');
    return res.data.data;
  },

  async getManufacturingReport() {
    const res = await apiClient.get<ApiResponse<any>>('/reports/manufacturing');
    return res.data.data;
  },

  async getQualityReport() {
    const res = await apiClient.get<ApiResponse<any>>('/reports/quality');
    return res.data.data;
  },

  async exportCSV(type: string) {
    const res = await apiClient.get(`/reports/export?type=${type}`, {
      responseType: 'blob',
    });
    return res.data;
  },
};

export const AdminService = {
  async listUsers(params?: any) {
    const res = await apiClient.get<ApiResponse<any[]>>('/admin/users', { params });
    return res.data;
  },

  async createUser(payload: any) {
    const res = await apiClient.post<ApiResponse<any>>('/admin/users', payload);
    return res.data.data;
  },

  async updateUserStatus(id: string, status: string) {
    const res = await apiClient.patch<ApiResponse<any>>(`/admin/users/${id}/status`, { status });
    return res.data.data;
  },

  async updateUserRoles(id: string, roleIds: string[]) {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/users/${id}/roles`, { roleIds });
    return res.data.data;
  },

  async listRoles() {
    const res = await apiClient.get<ApiResponse<any[]>>('/admin/roles');
    return res.data.data;
  },

  async listPermissions() {
    const res = await apiClient.get<ApiResponse<any[]>>('/admin/permissions');
    return res.data.data;
  },

  async listAuditLogs(params?: any) {
    const res = await apiClient.get<ApiResponse<any[]>>('/admin/audit-logs', { params });
    return res.data;
  },

  async getSystemHealth() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/system-health');
    return res.data.data;
  },
};


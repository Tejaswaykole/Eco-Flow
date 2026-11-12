export type RoleName = 'ADMINISTRATOR' | 'LEAD_ENGINEER' | 'APPROVER' | 'OPERATOR';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
  permissions: string[];
}

export interface RegisterResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
}

export interface UserDetail {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  created_at: string;
  user_roles: {
    id: string;
    is_primary: boolean;
    role: {
      id: string;
      name: string;
      description?: string;
    };
  }[];
}

export interface ProductCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  status?: string;
  created_by?: string;
  creator?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  products?: {
    id: string;
    part_number: string;
    name: string;
    boms?: BOM[];
  }[];
  created_at: string;
}

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface ProductVersion {
  id: string;
  version_number: number;
  release_status: 'DRAFT' | 'RELEASED' | 'OBSOLETE';
  effective_date?: string;
  created_at: string;
}

export interface Product {
  id: string;
  part_number: string;
  name: string;
  description?: string;
  status: ProductStatus;
  current_version: number;
  category_id: string;
  category?: ProductCategory;
  product_versions?: ProductVersion[];
  boms?: BOM[];
  created_at: string;
  updated_at: string;
}

export type BOMComponentType =
  | 'RAW_MATERIAL'
  | 'SUB_ASSEMBLY'
  | 'HARDWARE'
  | 'ELECTRONIC'
  | 'MECHANICAL'
  | 'ELECTRICAL'
  | 'OPTICAL'
  | 'CHEMICAL'
  | 'FASTENER'
  | 'PLASTIC_MOLDED'
  | 'SHEET_METAL'
  | 'CONSUMABLE'
  | 'LABEL_PRINTING'
  | 'CABLE_WIRE'
  | 'TOOLING'
  | 'SOFTWARE_FIRMWARE'
  | 'PACKAGING'
  | 'OTHER';

export interface BOMComponent {
  id: string;
  part_number: string;
  name: string;
  component_type: BOMComponentType;
  quantity: number | string;
  unit_of_measure: string;
  unit_cost: number | string;
  total_cost: number | string;
  sub_assembly_bom_id?: string | null;
  sub_assembly_version?: number | null;
  is_cost_overridden?: boolean;
  cost_override_reason?: string | null;
  sub_assembly_bom?: {
    id: string;
    bom_number: string;
    current_version: number;
    status: string;
  } | null;
  sub_assembly_tree?: any | null;
  depth?: number;
  material_type?: string;
  notes?: string;
}

export interface BOMVersion {
  id: string;
  version_number: number;
  release_status: 'DRAFT' | 'RELEASED' | 'OBSOLETE';
  created_at: string;
}

export type BOMStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface BOM {
  id: string;
  bom_number: string;
  product_id: string;
  product?: Product;
  current_version: number;
  status: BOMStatus;
  description?: string;
  components?: BOMComponent[];
  bom_versions?: BOMVersion[];
  created_at: string;
  updated_at: string;
}

export type ECOStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ECOPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ECOChange {
  id: string;
  eco_id?: string;
  revision_number: number;
  change_type: 'QUANTITY_CHANGE' | 'MATERIAL_CHANGE' | 'COST_CHANGE' | 'COMPONENT_ADDITION' | 'COMPONENT_REMOVAL' | 'SPECIFICATION_CHANGE';
  change_target: 'PRODUCT' | 'BOM' | 'COMPONENT';
  field_name: string;
  old_value?: string;
  new_value?: string;
  impact_type?: string;
  justification?: string;
  created_at: string;
}

export interface ECORevision {
  id?: string;
  eco_id: string;
  revision_number: number;
  status: ECOStatus;
  change_summary: string;
  created_at: string;
  changes?: ECOChange[];
  snapshot?: any;
  approval?: Approval | null;
}

export interface Approval {
  id: string;
  revision_number: number;
  approver_id: string;
  decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
  comments?: string;
  created_at: string;
  approver?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface ECO {
  id: string;
  eco_number: string;
  title: string;
  description?: string;
  priority: ECOPriority;
  status: ECOStatus;
  active_revision_no: number;
  product_id: string;
  bom_id: string;
  ecr_id?: string;
  product?: Product;
  bom?: BOM;
  created_by?: string;
  eco_revisions?: ECORevision[];
  eco_changes?: ECOChange[];
  approvals?: Approval[];
  ecn?: any | null;
  created_at: string;
  updated_at: string;
}

export type ECRRequestType = 'DEFECT' | 'IMPROVEMENT' | 'COST_REDUCTION' | 'SAFETY' | 'OTHER';
export type ECRStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'NEEDS_INFORMATION' | 'ACCEPTED' | 'REJECTED' | 'PROMOTED';

export interface ECR {
  id: string;
  ecr_number: string;
  title: string;
  description: string;
  request_type: ECRRequestType;
  priority: ECOPriority;
  status: ECRStatus;
  product_id?: string | null;
  bom_id?: string | null;
  submitted_by: string;
  assigned_to?: string | null;
  affected_part_number?: string | null;
  suggested_solution?: string | null;
  review_comments?: string | null;
  rejection_reason?: string | null;
  promoted_eco_id?: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  submitter?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  assignee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  product?: {
    id: string;
    name: string;
    part_number: string;
  } | null;
  bom?: {
    id: string;
    bom_number: string;
  } | null;
  promoted_eco?: {
    id: string;
    eco_number: string;
    title?: string;
    status: string;
    active_revision_no?: number;
    created_at?: string;
  } | null;
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_id?: string;
  created_at: string;
}

export type ECNStatus = 'DRAFT' | 'ISSUED' | 'COMPLETED' | 'CANCELLED';
export type ECNDepartment = 'ENGINEERING' | 'QUALITY' | 'PRODUCTION' | 'PROCUREMENT' | 'INVENTORY' | 'MANAGEMENT';
export type ECNAcknowledgementStatus = 'PENDING' | 'ACKNOWLEDGED';
export type MaterialDispositionType = 'SCRAP' | 'REWORK' | 'USE_AS_IS';

export interface ECNDistribution {
  id: string;
  ecn_id: string;
  department: ECNDepartment;
  assigned_to?: string | null;
  acknowledgement_status: ECNAcknowledgementStatus;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  comments?: string | null;
  created_at: string;
  updated_at: string;
  assignee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  acknowledger?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export interface ECNMaterialDisposition {
  id: string;
  ecn_id: string;
  product_id?: string | null;
  part_number?: string | null;
  disposition_type: MaterialDispositionType;
  quantity?: number | null;
  instructions: string;
  responsible_department: ECNDepartment;
  created_by: string;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    part_number: string;
  } | null;
}

export interface ECN {
  id: string;
  ecn_number: string;
  eco_id: string;
  version_release_id: string;
  title: string;
  change_summary: string;
  reason_for_change?: string | null;
  effective_date: string;
  status: ECNStatus;
  issued_by?: string | null;
  issued_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  eco?: ECO;
  version_release?: {
    id: string;
    release_status: string;
    released_at: string;
    product_version?: { id: string; version_number: number };
    bom_version?: { id: string; version_number: number };
    product?: { id: string; name: string; part_number: string };
    releaser?: { id: string; first_name: string; last_name: string; email: string };
  };
  creator?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  issuer?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  distributions?: ECNDistribution[];
  dispositions?: ECNMaterialDisposition[];
}

// ==============================================================================
// Business Module Types: Suppliers, Inventory, Purchasing, Manufacturing, Quality
// ==============================================================================

export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING_QUALIFICATION' | 'BLOCKED';

export interface Supplier {
  id: string;
  supplier_code: string;
  name: string;
  status: SupplierStatus;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  rating?: number | null;
  created_at: string;
  updated_at: string;
  products?: SupplierProduct[];
  purchase_orders?: PurchaseOrder[];
  quotations?: SupplierQuotation[];
  mappedProductCount?: number;
  mappedProducts?: {
    id: string;
    productId: string;
    productName: string;
    partNumber: string;
    categoryName: string;
    supplierPartNumber?: string | null;
    unitPrice: number;
    currency: string;
    leadTimeDays: number;
    minimumOrderQty: number;
    isPreferred: boolean;
    status: string;
  }[];
  historicalPurchaseOrderCount?: number;
  completedPurchaseOrderCount?: number;
  repeatPurchaseCount?: number;
  latestQuotedPrice?: { price: number; currency: string } | null;
  avgLeadTimeDays?: number | null;
}

export interface SupplierProduct {
  id: string;
  supplier_id: string;
  product_id: string;
  supplier_part_number?: string | null;
  lead_time_days?: number | null;
  unit_price: number | string;
  minimum_order_qty: number | string;
  currency: string;
  is_preferred: boolean;
  status?: string;
  valid_until?: string | null;
  product?: Product;
}

export interface SupplierDashboardStats {
  totalSuppliers: number;
  activeSuppliers: number;
  inactiveSuppliers: number;
  totalMappedProducts: number;
  totalPurchaseOrders: number;
  completedPurchaseOrders: number;
  repeatSuppliers: number;
  pendingRFQs: number;
  pendingQuotations: number;
  activeNegotiations: number;
}

export interface RFQItem {
  id: string;
  rfq_id: string;
  product_id: string;
  quantity_required: number | string;
  notes?: string | null;
  product?: Product;
}

export interface RFQSupplier {
  id: string;
  rfq_id: string;
  supplier_id: string;
  status: 'INVITED' | 'RESPONDED' | 'DECLINED';
  supplier?: Supplier;
}

export interface RFQ {
  id: string;
  rfq_number: string;
  title: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED';
  submission_date: string;
  deadline_date?: string | null;
  delivery_date?: string | null;
  notes?: string | null;
  created_by: string;
  created_at: string;
  items: RFQItem[];
  suppliers: RFQSupplier[];
  quotations?: SupplierQuotation[];
}

export interface NegotiationEvent {
  id: string;
  quotation_id: string;
  event_type: 'COUNTER_OFFER' | 'REVISED_OFFER' | 'ACCEPTED' | 'REJECTED';
  actor_id: string;
  offered_price: number | string;
  counter_price: number | string;
  currency: string;
  message?: string | null;
  previous_status: string;
  new_status: string;
  created_at: string;
  actor?: { id: string; first_name: string; last_name: string; email: string };
}

export interface SupplierQuotation {
  id: string;
  quotation_number: string;
  rfq_id?: string | null;
  supplier_id: string;
  product_id: string;
  supplier_part_number?: string | null;
  offered_quantity: number | string;
  unit_price: number | string;
  currency: string;
  tax_amount: number | string;
  shipping_amount: number | string;
  total_amount: number | string;
  lead_time_days?: number | null;
  minimum_order_quantity: number | string;
  valid_until?: string | null;
  terms_conditions?: string | null;
  status: 'DRAFT' | 'REQUESTED' | 'QUOTED' | 'COUNTER_OFFERED' | 'REVISED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  converted_po_id?: string | null;
  created_at: string;
  supplier?: Supplier;
  product?: Product;
  rfq?: RFQ;
  negotiation_events?: NegotiationEvent[];
}

export interface SupplierPerformanceAnalytics {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  totalPurchaseOrders: number;
  completedPurchaseOrders: number;
  cancelledPurchaseOrders: number;
  repeatPurchaseOrders: number;
  repeatPurchaseFrequency: number;
  totalPurchasedValue: number;
  currency: string;
  lastPurchaseDate?: string | null;
  averageLeadTimeDays?: number | null;
  onTimeDeliveryPercentage?: number | null;
  inspectedQuantity: number;
  rejectedQuantity: number;
  qualityRejectionPercentage?: number | null;
  openNegotiations: number;
  acceptedQuotations: number;
  ranking: {
    score: number;
    grade: 'TIER_1_PREFERRED' | 'TIER_2_QUALIFIED' | 'TIER_3_STANDARD';
    reasons: string[];
  };
}

export type WarehouseStatus = 'ACTIVE' | 'INACTIVE';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location?: string | null;
  status: WarehouseStatus;
  created_at: string;
  updated_at: string;
  _count?: { inventory_items: number };
}

export interface InventoryItem {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity_on_hand: number | string;
  quantity_reserved: number | string;
  min_threshold: number | string;
  max_threshold?: number | string | null;
  unit_of_measure: string;
  created_at: string;
  updated_at: string;
  product?: Product;
  warehouse?: Warehouse;
}

export type InventoryTransactionType = 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT' | 'SCRAP' | 'TRANSFER' | 'RESERVATION';

export interface InventoryTransaction {
  id: string;
  item_id: string;
  type: InventoryTransactionType;
  quantity: number | string;
  unit_cost: number | string;
  total_cost: number | string;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  performed_by: string;
  created_at: string;
  item?: InventoryItem;
  performer?: { id: string; email: string; first_name: string; last_name: string };
}

export type PurchaseOrderStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  status: PurchaseOrderStatus;
  order_date: string;
  expected_delivery_date?: string | null;
  total_amount: number | string;
  notes?: string | null;
  created_by: string;
  approved_by?: string | null;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  creator?: { id: string; email: string; first_name: string; last_name: string };
  approver?: { id: string; email: string; first_name: string; last_name: string } | null;
  lines?: PurchaseOrderLine[];
}

export interface PurchaseOrderLine {
  id: string;
  po_id: string;
  line_number: number;
  product_id: string;
  quantity_ordered: number | string;
  quantity_received: number | string;
  unit_price: number | string;
  total_price: number | string;
  unit_of_measure: string;
  product?: Product;
}

export type WorkOrderStatus = 'DRAFT' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface WorkOrder {
  id: string;
  wo_number: string;
  product_id: string;
  bom_id: string;
  bom_version_id?: string | null;
  target_quantity: number | string;
  completed_quantity: number | string;
  rejected_quantity: number | string;
  status: WorkOrderStatus;
  start_date?: string | null;
  end_date?: string | null;
  created_by: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  product?: Product;
  bom?: BOM;
  bom_version?: BOMVersion | null;
  creator?: { id: string; email: string; first_name: string; last_name: string };
  allocations?: WorkOrderAllocation[];
  inspections?: QualityInspection[];
}

export interface WorkOrderAllocation {
  id: string;
  work_order_id: string;
  product_id: string;
  required_quantity: number | string;
  allocated_quantity: number | string;
  consumed_quantity: number | string;
  unit_of_measure: string;
  unit_cost: number | string;
  total_cost: number | string;
  product?: Product;
}

export type InspectionType = 'RECEIVING' | 'IN_PROCESS' | 'FINAL' | 'FIRST_ARTICLE';
export type InspectionStatus = 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'CONDITIONALLY_PASSED';

export interface QualityInspection {
  id: string;
  inspection_number: string;
  type: InspectionType;
  status: InspectionStatus;
  product_id: string;
  bom_id?: string | null;
  work_order_id?: string | null;
  po_id?: string | null;
  inspector_id?: string | null;
  sample_size: number | string;
  passed_quantity: number | string;
  failed_quantity: number | string;
  notes?: string | null;
  conducted_at?: string | null;
  created_at: string;
  updated_at: string;
  product?: Product;
  work_order?: WorkOrder | null;
  purchase_order?: PurchaseOrder | null;
  inspector?: { id: string; email: string; first_name: string; last_name: string } | null;
  non_conformances?: QualityNonConformance[];
}

export type NCRSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';
export type NCRStatus = 'OPEN' | 'UNDER_INVESTIGATION' | 'CAPA_REQUIRED' | 'CLOSED' | 'REJECTED';

export interface QualityNonConformance {
  id: string;
  ncr_number: string;
  inspection_id?: string | null;
  product_id: string;
  severity: NCRSeverity;
  status: NCRStatus;
  title: string;
  description: string;
  root_cause?: string | null;
  disposition?: string | null;
  capa_plan?: string | null;
  assigned_to?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  product?: Product;
  creator?: { id: string; email: string; first_name: string; last_name: string };
  assignee?: { id: string; email: string; first_name: string; last_name: string } | null;
}

// ==============================================================================
// Milestone 09 & 10 Types: Notifications, Approvals, Reports & Admin
// ==============================================================================

export type NotificationType =
  | 'ECO_SUBMITTED'
  | 'ECO_APPROVED'
  | 'ECO_REJECTED'
  | 'APPROVAL_REQUESTED'
  | 'SYSTEM_ALERT';

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface PendingApprovalItem {
  id: string;
  entityType: 'ECO' | 'ECR' | 'ECN' | 'PURCHASE_ORDER' | 'NCR';
  referenceNumber: string;
  title: string;
  status: string;
  priority?: string;
  submittedBy?: { id: string; name: string; email: string };
  assignedTo?: { id: string; name: string; email: string };
  submittedAt: string;
  dueDate: string;
  isOverdue: boolean;
  link: string;
}

export interface ApprovalStats {
  totalPending: number;
  totalOverdue: number;
  byDomain: {
    eco: { pending: number; overdue: number };
    ecr: { pending: number; overdue: number };
    ecn: { pending: number; overdue: number };
    po: { pending: number; overdue: number };
    ncr: { pending: number; overdue: number };
  };
}

export interface ActivityLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  severity: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
  } | null;
}

export interface DashboardMetrics {
  kpis: {
    products: number;
    activeBOMs: number;
    pendingECRs: number;
    activeECOs: number;
    pendingApprovals: number;
    issuedECNs: number;
    openPOs: number;
    lowStockAlerts: number;
    activeWOs: number;
    openNCRs: number;
    inventoryValuationINR: string;
    poSpendINR: string;
    currency: string;
    currencySymbol: string;
  };
  charts: {
    ecoDistribution: { status: string; count: number }[];
    poDistribution: { status: string; count: number }[];
    woDistribution: { status: string; count: number }[];
    ncrSeverity: { severity: string; count: number }[];
  };
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    user: string;
  }[];
}

export interface EngineeringReportData {
  boms: {
    id: string;
    bomNumber: string;
    productPartNumber: string;
    productName: string;
    componentCount: number;
    totalCostINR: string;
  }[];
  ecrStats: {
    total: number;
    avgTurnaroundDays: string;
    byStatus: Record<string, number>;
  };
  ecoStats: {
    total: number;
    byStatus: Record<string, number>;
  };
}

export interface InventoryReportData {
  warehouses: {
    id: string;
    name: string;
    code: string;
    itemCount: number;
    totalValuationINR: string;
  }[];
  lowStockItems: {
    id: string;
    partNumber: string;
    productName: string;
    warehouse: string;
    quantityOnHand: string;
    minThreshold: string;
    unitOfMeasure: string;
  }[];
  recentMovements: {
    id: string;
    type: string;
    partNumber: string;
    productName: string;
    warehouse: string;
    quantity: string;
    unitCostINR: string;
    totalCostINR: string;
    referenceType: string;
    createdAt: string;
  }[];
}

export interface PurchasingReportData {
  supplierSpend: {
    id: string;
    name: string;
    code: string;
    totalSpendINR: string;
    orderCount: number;
  }[];
  statusBreakdown: {
    status: string;
    count: number;
    totalINR: string;
  }[];
  totalOrders: number;
}

export interface ManufacturingReportData {
  totalWorkOrders: number;
  statusBreakdown: Record<string, number>;
  quantities: {
    totalPlanned: string;
    totalCompleted: string;
    totalRejected: string;
    scrapRatePercent: string;
  };
  workOrders: {
    id: string;
    woNumber: string;
    productPartNumber: string;
    productName: string;
    status: string;
    targetQty: string;
    completedQty: string;
    rejectedQty: string;
    startDate?: string | null;
    endDate?: string | null;
  }[];
}

export interface QualityReportData {
  inspections: {
    total: number;
    statusBreakdown: Record<string, number>;
    passRatePercent: string;
    passedQty: string;
    failedQty: string;
  };
  ncrs: {
    total: number;
    severityBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
    capaPlansDefined: number;
  };
}

export interface AdminUserItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  roles: { id: string; name: string; description?: string }[];
}

export interface AdminRoleItem {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  userCount: number;
  permissions: { id: string; code: string; description?: string; module: string }[];
}

export interface SystemHealthData {
  status: 'HEALTHY' | 'DEGRADED';
  database: {
    connected: boolean;
    version: string;
    latencyMs: number;
  };
  process: {
    uptimeSeconds: number;
    nodeVersion: string;
    platform: string;
    memory: {
      rssMb: string;
      heapTotalMb: string;
      heapUsedMb: string;
    };
  };
  counts: {
    users: number;
    products: number;
    boms: number;
    ecrs: number;
    ecos: number;
    purchaseOrders: number;
    workOrders: number;
    ncrs: number;
    auditLogs: number;
  };
}



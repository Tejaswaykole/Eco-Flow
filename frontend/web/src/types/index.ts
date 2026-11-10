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

export interface BOM {
  id: string;
  bom_number: string;
  product_id: string;
  product?: Product;
  current_version: number;
  status: 'DRAFT' | 'RELEASED' | 'OBSOLETE';
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


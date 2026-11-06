export type RoleName = 'ADMINISTRATOR' | 'LEAD_ENGINEER' | 'APPROVER' | 'OPERATOR';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
  permissions: string[];
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
  created_at: string;
}

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
  status: 'DRAFT' | 'ACTIVE' | 'PHASE_OUT' | 'OBSOLETE';
  current_version: number;
  category_id: string;
  category?: ProductCategory;
  product_versions?: ProductVersion[];
  boms?: BOM[];
  created_at: string;
  updated_at: string;
}

export interface BOMComponent {
  id: string;
  part_number: string;
  name: string;
  component_type: 'RAW_MATERIAL' | 'SUB_ASSEMBLY' | 'HARDWARE' | 'ELECTRONIC' | 'PACKAGING' | 'OTHER';
  quantity: number | string;
  unit_of_measure: string;
  unit_cost: number | string;
  total_cost: number | string;
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

export type ECOStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ECOPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ECOChange {
  id: string;
  revision_number: number;
  change_type: 'QUANTITY_CHANGE' | 'MATERIAL_CHANGE' | 'COST_CHANGE' | 'COMPONENT_ADDITION' | 'COMPONENT_REMOVAL' | 'SPECIFICATION_CHANGE';
  change_target: 'PRODUCT' | 'BOM' | 'COMPONENT';
  field_name: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export interface ECORevision {
  id: string;
  eco_id: string;
  revision_number: number;
  status: ECOStatus;
  change_summary: string;
  created_at: string;
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
  product?: Product;
  bom?: BOM;
  eco_revisions?: ECORevision[];
  eco_changes?: ECOChange[];
  approvals?: Approval[];
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_id?: string;
  created_at: string;
}


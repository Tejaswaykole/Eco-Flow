import {
  UserStatus,
  ProductStatus,
  BOMStatus,
  ECOStatus,
  PriorityLevel,
  ChangeType,
  ChangeTarget,
  ImpactType,
  ApprovalDecision,
  ECRRequestType,
  ECRStatus,
  ECNStatus,
  ECNDepartment,
  ECNAcknowledgementStatus,
  MaterialDispositionType,
} from '../enums.js';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  profileImage?: string | null;
  roleId?: string | null;
  status: UserStatus;
  lastLogin?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  role?: Role | null;
}

export interface Role {
  id: string;
  roleName: string;
  description?: string | null;
  createdAt: Date;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  permissionName: string;
  moduleName: string;
  description?: string | null;
}

export interface RolePermission {
  roleId: string;
  permissionId: string;
}

export interface Session {
  id: string;
  userId: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  lastActiveAt: Date;
  expiresAt: Date;
  createdAt: Date;
  refreshTokens?: RefreshToken[];
}

export interface RefreshToken {
  id: string;
  sessionId: string;
  tokenFamily: string;
  tokenHash: string;
  isConsumed: boolean;
  consumedAt?: Date | null;
  isRevoked: boolean;
  revokedAt?: Date | null;
  replacedByTokenHash?: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string | null;
  createdAt: Date;
}

export interface Product {
  id: string;
  productCode: string;
  productName: string;
  categoryId: string;
  description?: string | null;
  imageUrl?: string | null;
  status: ProductStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  category?: ProductCategory;
  creator?: User;
}

export interface ProductAttachment {
  id: string;
  productId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: Date;
  uploader?: User;
}

export interface BOM {
  id: string;
  productId: string;
  bomCode: string;
  bomName: string;
  description?: string | null;
  status: BOMStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  product?: Product;
  components?: BOMComponent[];
}

export interface BOMComponent {
  id: string;
  bomId: string;
  componentName: string;
  materialType: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  notes?: string | null;
  createdAt: Date;
}

export interface ECO {
  id: string;
  ecoNumber: string;
  productId: string;
  bomId: string;
  activeRevisionNo: number;
  title: string;
  description?: string | null;
  reason?: string | null;
  priority: PriorityLevel;
  status: ECOStatus;
  submittedBy: string;
  reviewedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  product?: Product;
  bom?: BOM;
  submitter?: User;
  reviewer?: User | null;
  changes?: ECOChange[];
  comments?: ECOComment[];
  approvals?: Approval[];
}

export interface ECOChange {
  id: string;
  ecoId: string;
  changeType: ChangeType;
  changeTarget: ChangeTarget;
  fieldName: string;
  oldValue?: string | null;
  newValue?: string | null;
  impactType: ImpactType;
  createdAt: Date;
}

export interface ECOComment {
  id: string;
  ecoId: string;
  userId: string;
  comment: string;
  createdAt: Date;
  user?: User;
}

export interface ECOAttachment {
  id: string;
  ecoId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: Date;
  uploader?: User;
}

export interface Approval {
  id: string;
  ecoId: string;
  reviewerId: string;
  decision: ApprovalDecision;
  reviewNotes?: string | null;
  reviewedAt: Date;
  createdAt: Date;
  reviewer?: User;
}

export interface ProductVersion {
  id: string;
  productId: string;
  versionNumber: string;
  ecoId: string;
  releaseNotes?: string | null;
  snapshot: Record<string, unknown>;
  createdBy: string;
  isActive: boolean;
  createdAt: Date;
}

export interface BOMVersion {
  id: string;
  bomId: string;
  versionNumber: string;
  ecoId: string;
  releaseNotes?: string | null;
  snapshot: Record<string, unknown>;
  createdBy: string;
  isActive: boolean;
  createdAt: Date;
}

export interface VersionRelease {
  id: string;
  productVersionId: string;
  bomVersionId: string;
  releaseDate: Date;
  releasedBy: string;
  notes?: string | null;
  productVersion?: ProductVersion;
  bomVersion?: BOMVersion;
  releaser?: User;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  performedBy: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  performedAt: Date;
  user?: User;
}

export interface LoginAudit {
  id: string;
  userId: string;
  action: 'LOGIN' | 'LOGOUT' | 'REFRESH' | 'FAILED_LOGIN' | 'REUSE_REVOCATION';
  ipAddress?: string | null;
  device?: string | null;
  createdAt: Date;
  user?: User;
}

export interface ECR {
  id: string;
  ecrNumber: string;
  title: string;
  description: string;
  requestType: ECRRequestType;
  priority: PriorityLevel;
  status: ECRStatus;
  productId?: string | null;
  bomId?: string | null;
  submittedBy: string;
  assignedTo?: string | null;
  affectedPartNumber?: string | null;
  suggestedSolution?: string | null;
  reviewComments?: string | null;
  rejectionReason?: string | null;
  promotedEcoId?: string | null;
  submittedAt: Date;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ECN {
  id: string;
  ecnNumber: string;
  ecoId: string;
  versionReleaseId: string;
  title: string;
  changeSummary: string;
  reasonForChange?: string | null;
  effectiveDate: Date;
  status: ECNStatus;
  issuedBy?: string | null;
  issuedAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  distributions?: ECNDistribution[];
  dispositions?: ECNMaterialDisposition[];
}

export interface ECNDistribution {
  id: string;
  ecnId: string;
  department: ECNDepartment;
  assignedTo?: string | null;
  acknowledgementStatus: ECNAcknowledgementStatus;
  acknowledgedBy?: string | null;
  acknowledgedAt?: Date | null;
  comments?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ECNMaterialDisposition {
  id: string;
  ecnId: string;
  productId?: string | null;
  partNumber?: string | null;
  dispositionType: MaterialDispositionType;
  quantity?: number | null;
  instructions: string;
  responsibleDepartment: ECNDepartment;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

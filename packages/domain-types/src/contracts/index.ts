import { ECO, ProductVersion, BOMVersion, VersionRelease } from '../models/index.js';
import { ECOStatus, PriorityLevel, ApprovalDecision } from '../enums.js';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Public DTOs (Never expose password_hash, token hashes, or internal secrets)
export interface UserProfileDto {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  profileImage?: string | null;
  status: string;
  role?: {
    id: string;
    roleName: string;
    description?: string | null;
  } | null;
  createdAt: Date;
}

export interface SessionDto {
  id: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  lastActiveAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

// Auth Contracts
export interface LoginRequest {
  email: string;
  password: string;
  deviceName?: string;
}

export interface LoginResponse {
  user: UserProfileDto;
  accessToken: string;
  csrfToken?: string;
}

export interface RefreshTokenRequest {
  refreshToken?: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  csrfToken?: string;
}

export interface AccessRequestCreate {
  fullName: string;
  email: string;
  requestedRole: string;
  department?: string;
  reason?: string;
}

// ECO Contracts
export interface ECOFilterParams extends PaginationParams {
  status?: ECOStatus;
  priority?: PriorityLevel;
  productId?: string;
  bomId?: string;
  submittedBy?: string;
}

export interface ApprovalProcessRequest {
  decision: ApprovalDecision;
  reviewNotes?: string;
}

export interface ApprovalProcessResponse {
  eco: ECO;
  productVersion?: ProductVersion;
  bomVersion?: BOMVersion;
  release?: VersionRelease;
}

// Audit Contracts
export interface AuditLogFilterParams extends PaginationParams {
  entityType?: string;
  entityId?: string;
  action?: string;
  performedBy?: string;
  startDate?: string;
  endDate?: string;
}

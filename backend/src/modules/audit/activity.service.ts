import { prisma } from '../../config/database.js';

export interface ActivityFilterOptions {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export class ActivityService {
  private static SENSITIVE_KEYS = ['password', 'password_hash', 'token', 'secret', 'refresh_token', 'access_token'];

  private static sanitizePayload(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.sanitizePayload(item));

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.SENSITIVE_KEYS.some((sk) => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizePayload(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  public static async listActivities(filters: ActivityFilterOptions = {}) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.entityType) where.entity_type = filters.entityType;
    if (filters.entityId) where.entity_id = filters.entityId;
    if (filters.userId) where.user_id = filters.userId;
    if (filters.action) where.action = filters.action;

    if (filters.dateFrom || filters.dateTo) {
      where.created_at = {};
      if (filters.dateFrom) where.created_at.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.created_at.lte = new Date(filters.dateTo);
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      }),
    ]);

    const sanitizedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      severity: log.severity,
      oldValues: this.sanitizePayload(log.old_values),
      newValues: this.sanitizePayload(log.new_values),
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      createdAt: log.created_at,
      user: log.user
        ? {
            id: log.user.id,
            email: log.user.email,
            name: `${log.user.first_name} ${log.user.last_name}`,
          }
        : null,
    }));

    return {
      activities: sanitizedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getEntityTimeline(entityType: string, entityId: string) {
    return this.listActivities({ entityType, entityId, limit: 100 });
  }
}


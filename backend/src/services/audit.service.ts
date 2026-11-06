import { prisma } from '../config/database.js';
import { randomUUID } from 'crypto';

export interface AuditContext {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  severity?: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  public static async log(ctx: AuditContext, tx?: any): Promise<void> {
    const client = tx || prisma;
    await client.auditLog.create({
      data: {
        id: randomUUID(),
        user_id: ctx.userId,
        action: ctx.action,
        entity_type: ctx.entityType,
        entity_id: ctx.entityId,
        old_values: ctx.oldValues || undefined,
        new_values: ctx.newValues || undefined,
        severity: ctx.severity || 'INFO',
        ip_address: ctx.ipAddress,
        user_agent: ctx.userAgent,
      },
    });
  }

  public static async notify(
    userId: string,
    type: 'ECO_SUBMITTED' | 'ECO_APPROVED' | 'ECO_REJECTED' | 'APPROVAL_REQUESTED' | 'SYSTEM_ALERT',
    title: string,
    message: string,
    entityType?: string,
    entityId?: string,
    tx?: any
  ): Promise<void> {
    const client = tx || prisma;
    await client.notification.create({
      data: {
        id: randomUUID(),
        user_id: userId,
        type,
        title,
        message,
        entity_type: entityType,
        entity_id: entityId,
      },
    });
  }
}

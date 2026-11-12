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
    arg1: string | { userId: string; type: 'ECO_SUBMITTED' | 'ECO_APPROVED' | 'ECO_REJECTED' | 'APPROVAL_REQUESTED' | 'SYSTEM_ALERT'; title: string; message: string; entityType?: string; entityId?: string; link?: string; tx?: any },
    arg2?: 'ECO_SUBMITTED' | 'ECO_APPROVED' | 'ECO_REJECTED' | 'APPROVAL_REQUESTED' | 'SYSTEM_ALERT',
    arg3?: string,
    arg4?: string,
    arg5?: string,
    arg6?: string,
    arg7?: any
  ): Promise<void> {
    let userId: string;
    let type: 'ECO_SUBMITTED' | 'ECO_APPROVED' | 'ECO_REJECTED' | 'APPROVAL_REQUESTED' | 'SYSTEM_ALERT';
    let title: string;
    let message: string;
    let entityType: string | undefined;
    let entityId: string | undefined;
    let link: string | undefined;
    let tx: any;

    if (typeof arg1 === 'object') {
      userId = arg1.userId;
      type = arg1.type;
      title = arg1.title;
      message = arg1.message;
      entityType = arg1.entityType;
      entityId = arg1.entityId;
      link = arg1.link || (entityType && entityId ? `/${entityType.toLowerCase()}s/${entityId}` : undefined);
      tx = arg1.tx;
    } else {
      userId = arg1;
      type = arg2!;
      title = arg3!;
      message = arg4!;
      entityType = arg5;
      entityId = arg6;
      link = entityType && entityId ? `/${entityType.toLowerCase()}s/${entityId}` : undefined;
      tx = arg7;
    }

    const client = tx || prisma;

    // Deduplication: prevent sending identical unread notifications within a 5-minute window
    if (client.notification?.findFirst) {
      const recentDuplicate = await client.notification.findFirst({
        where: {
          user_id: userId,
          type,
          title,
          link: link || null,
          is_read: false,
          created_at: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
      });

      if (recentDuplicate) {
        return;
      }
    }

    if (client.notification?.create) {
      await client.notification.create({
        data: {
          id: randomUUID(),
          user_id: userId,
          type,
          title,
          message,
          link,
        },
      });
    }
  }
}

import { prisma } from '../../config/database.js';
import { randomUUID } from 'crypto';
import { NotFoundError, AppError } from '../../utils/errors.js';

export interface ListNotificationsOptions {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export class NotificationService {
  public static async listNotifications(userId: string, options: ListNotificationsOptions = {}) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { user_id: userId };
    if (options.unreadOnly) {
      where.is_read = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { user_id: userId, is_read: false } }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getUnreadCount(userId: string): Promise<number> {
    return await prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
  }

  public static async markAsRead(id: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundError('Notification', id);
    }

    if (notification.user_id !== userId) {
      throw new AppError('Unauthorized access to notification', 403);
    }

    return await prisma.notification.update({
      where: { id },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });
  }

  public static async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    return { count: result.count };
  }

  public static async dismissNotification(id: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundError('Notification', id);
    }

    if (notification.user_id !== userId) {
      throw new AppError('Unauthorized access to notification', 403);
    }

    await prisma.notification.delete({
      where: { id },
    });

    return { success: true };
  }
}


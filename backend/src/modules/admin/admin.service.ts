import { prisma } from '../../config/database.js';
import { SecurityService } from '../../services/security.service.js';
import { AuditService } from '../../services/audit.service.js';
import { NotFoundError, AppError, ConflictError } from '../../utils/errors.js';
import { ActivityService, ActivityFilterOptions } from '../audit/activity.service.js';
import { randomUUID } from 'crypto';

export class AdminService {
  public static async listUsers(page = 1, limit = 50, search?: string, status?: string, roleId?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) where.status = status;
    if (roleId) {
      where.user_roles = {
        some: { role_id: roleId },
      };
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          status: true,
          created_at: true,
          updated_at: true,
          user_roles: {
            include: {
              role: {
                select: { id: true, name: true, description: true },
              },
            },
          },
        },
      }),
    ]);

    const formatted = users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      status: u.status,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
      roles: u.user_roles.map((ur) => ur.role),
    }));

    return {
      users: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async createUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    roleIds?: string[];
    status?: 'ACTIVE' | 'PENDING' | 'INACTIVE';
  }, actorId: string) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictError('A user with this email address already exists');
    }

    const passwordHash = await SecurityService.hashPassword(data.password);

    return await prisma.$transaction(async (tx) => {
      const targetStatus = data.status || 'ACTIVE';
      const user = await tx.user.create({
        data: {
          id: randomUUID(),
          email: data.email.toLowerCase(),
          password_hash: passwordHash,
          first_name: data.firstName,
          last_name: data.lastName,
          status: 'PENDING',
        },
      });

      if (data.roleIds && data.roleIds.length > 0) {
        for (let i = 0; i < data.roleIds.length; i++) {
          await tx.userRole.create({
            data: {
              id: randomUUID(),
              user_id: user.id,
              role_id: data.roleIds[i],
              is_primary: i === 0,
            },
          });
        }
      }

      let finalUser = user;
      if (targetStatus === 'ACTIVE') {
        finalUser = await tx.user.update({
          where: { id: user.id },
          data: { status: 'ACTIVE' },
        });
      }

      await AuditService.log({
        userId: actorId,
        action: 'ADMIN_USER_CREATED',
        entityType: 'USER',
        entityId: user.id,
        newValues: { email: user.email, status: finalUser.status },
      });

      return {
        id: finalUser.id,
        email: finalUser.email,
        firstName: finalUser.first_name,
        lastName: finalUser.last_name,
        status: finalUser.status,
        createdAt: finalUser.created_at,
      };
    });
  }

  public static async updateUserStatus(userId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED', actorId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User', userId);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        status: true,
      },
    });

    await AuditService.log({
      userId: actorId,
      action: 'ADMIN_USER_STATUS_UPDATED',
      entityType: 'USER',
      entityId: userId,
      oldValues: { status: user.status },
      newValues: { status },
    });

    return updated;
  }

  public static async updateUserRoles(userId: string, roleIds: string[], actorId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User', userId);

    return await prisma.$transaction(async (tx) => {
      // Remove existing roles
      await tx.userRole.deleteMany({ where: { user_id: userId } });

      // Assign new roles
      for (let i = 0; i < roleIds.length; i++) {
        await tx.userRole.create({
          data: {
            id: randomUUID(),
            user_id: userId,
            role_id: roleIds[i],
            is_primary: i === 0,
          },
        });
      }

      await AuditService.log({
        userId: actorId,
        action: 'ADMIN_USER_ROLES_UPDATED',
        entityType: 'USER',
        entityId: userId,
        newValues: { roleIds },
      });

      return await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          user_roles: { include: { role: true } },
        },
      });
    });
  }

  public static async listRoles() {
    const roles = await prisma.role.findMany({
      include: {
        role_permissions: {
          include: { permission: true },
        },
        _count: {
          select: { user_roles: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.is_system,
      userCount: r._count.user_roles,
      permissions: r.role_permissions.map((rp) => rp.permission),
    }));
  }

  public static async listPermissions() {
    return await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
  }

  public static async listAuditLogs(filters: ActivityFilterOptions) {
    return ActivityService.listActivities(filters);
  }

  public static async getSystemHealth() {
    const startTime = Date.now();
    let dbVersion = 'Unknown';
    let dbConnected = false;

    try {
      const result = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version() as version`;
      if (result && result.length > 0) {
        dbVersion = result[0].version;
        dbConnected = true;
      }
    } catch {
      dbConnected = false;
    }

    const latencyMs = Date.now() - startTime;

    const [usersCount, productsCount, bomsCount, ecrsCount, ecosCount, posCount, wosCount, ncrsCount, auditCount] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.bOM.count(),
      prisma.eCR.count(),
      prisma.eCO.count(),
      prisma.purchaseOrder.count(),
      prisma.workOrder.count(),
      prisma.qualityNonConformance.count(),
      prisma.auditLog.count(),
    ]);

    const memoryUsage = process.memoryUsage();

    return {
      status: dbConnected ? 'HEALTHY' : 'DEGRADED',
      database: {
        connected: dbConnected,
        version: dbVersion,
        latencyMs,
      },
      process: {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          rssMb: (memoryUsage.rss / 1024 / 1024).toFixed(2),
          heapTotalMb: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
          heapUsedMb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
        },
      },
      counts: {
        users: usersCount,
        products: productsCount,
        boms: bomsCount,
        ecrs: ecrsCount,
        ecos: ecosCount,
        purchaseOrders: posCount,
        workOrders: wosCount,
        ncrs: ncrsCount,
        auditLogs: auditCount,
      },
    };
  }
}

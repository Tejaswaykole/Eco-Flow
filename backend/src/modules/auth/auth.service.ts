import { prisma } from '../../config/database.js';
import { SecurityService, TokenPayload } from '../../services/security.service.js';
import { UnauthorizedError, ConflictError } from '../../utils/errors.js';
import { RegisterInput, LoginInput } from './auth.schema.js';
import { randomUUID } from 'crypto';

export class AuthService {
  public static async register(input: RegisterInput, ipAddress?: string, userAgent?: string) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictError('A user with this email address already exists');
    }

    const passwordHash = await SecurityService.hashPassword(input.password);

    const operatorRole = await prisma.role.findFirst({
      where: { name: 'OPERATOR' },
    });

    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: randomUUID(),
          email: input.email.toLowerCase(),
          password_hash: passwordHash,
          first_name: input.firstName,
          last_name: input.lastName,
          status: 'ACTIVE',
        },
      });

      if (operatorRole) {
        await tx.userRole.create({
          data: {
            id: randomUUID(),
            user_id: user.id,
            role_id: operatorRole.id,
            is_primary: true,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          user_id: user.id,
          action: 'USER_REGISTERED',
          entity_type: 'USER',
          entity_id: user.id,
          severity: 'INFO',
          ip_address: ipAddress,
          user_agent: userAgent,
        },
      });

      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        status: user.status,
      };
    });
  }

  public static async login(input: LoginInput, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        user_roles: {
          include: {
            role: {
              include: {
                role_permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    const isMatch = user ? await SecurityService.verifyPassword(user.password_hash, input.password) : false;

    await prisma.loginAudit.create({
      data: {
        id: randomUUID(),
        user_id: user?.id,
        email_attempt: input.email.toLowerCase(),
        ip_address: ipAddress,
        user_agent: userAgent,
        is_success: isMatch,
        failure_reason: isMatch ? null : user ? 'INVALID_PASSWORD' : 'USER_NOT_FOUND',
      },
    });

    if (!user || !isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError(`Account is ${user.status.toLowerCase()}`);
    }

    const roles: string[] = [];
    const permissions = new Set<string>();

    for (const ur of user.user_roles) {
      roles.push(ur.role.name);
      for (const rp of ur.role.role_permissions) {
        permissions.add(rp.permission.code);
      }
    }

    const sessionId = randomUUID();
    const tokenFamily = randomUUID();
    const { token: rawRefreshToken, hash: refreshTokenHash } = SecurityService.generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.$transaction(async (tx) => {
      await tx.session.create({
        data: {
          id: sessionId,
          user_id: user.id,
          ip_address: ipAddress,
          user_agent: userAgent,
          expires_at: expiresAt,
        },
      });

      await tx.refreshToken.create({
        data: {
          id: randomUUID(),
          session_id: sessionId,
          user_id: user.id,
          token_hash: refreshTokenHash,
          token_family: tokenFamily,
          expires_at: expiresAt,
        },
      });
    });

    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      sessionId,
      roles,
      permissions: Array.from(permissions),
    };

    const accessToken = SecurityService.generateAccessToken(tokenPayload);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        roles,
        permissions: Array.from(permissions),
      },
    };
  }

  public static async refresh(rawToken: string, _ipAddress?: string, _userAgent?: string) {
    const tokenHash = SecurityService.hashToken(rawToken);

    const tokenRecord = await prisma.refreshToken.findFirst({
      where: { token_hash: tokenHash },
      include: {
        session: true,
        user: {
          include: {
            user_roles: {
              include: {
                role: {
                  include: {
                    role_permissions: {
                      include: { permission: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (tokenRecord.is_consumed) {
      await prisma.refreshToken.updateMany({
        where: { token_family: tokenRecord.token_family },
        data: { is_consumed: true },
      });
      await prisma.session.update({
        where: { id: tokenRecord.session_id },
        data: {
          is_revoked: true,
          revoked_at: new Date(),
          revoked_reason: 'REFRESH_TOKEN_REUSE_DETECTED',
        },
      });
      throw new UnauthorizedError('Compromised refresh token detected: session revoked');
    }

    if (tokenRecord.session.is_revoked || tokenRecord.expires_at < new Date()) {
      throw new UnauthorizedError('Session has expired or was revoked');
    }

    const { token: newRawRefreshToken, hash: newRefreshTokenHash } = SecurityService.generateRefreshToken();
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    const newTokenRecordId = randomUUID();

    await prisma.$transaction(async (tx) => {
      // 1. Create the new token first so the foreign key target exists!
      await tx.refreshToken.create({
        data: {
          id: newTokenRecordId,
          session_id: tokenRecord.session_id,
          user_id: tokenRecord.user_id,
          token_hash: newRefreshTokenHash,
          token_family: tokenRecord.token_family,
          expires_at: newExpiresAt,
        },
      });

      // 2. Consume current token and point replaced_by_token_id to the new token
      await tx.refreshToken.update({
        where: { id: tokenRecord.id },
        data: {
          is_consumed: true,
          consumed_at: new Date(),
          replaced_by_token_id: newTokenRecordId,
        },
      });
    });

    const roles: string[] = [];
    const permissions = new Set<string>();

    for (const ur of tokenRecord.user.user_roles) {
      roles.push(ur.role.name);
      for (const rp of ur.role.role_permissions) {
        permissions.add(rp.permission.code);
      }
    }

    const payload: TokenPayload = {
      userId: tokenRecord.user.id,
      email: tokenRecord.user.email,
      sessionId: tokenRecord.session_id,
      roles,
      permissions: Array.from(permissions),
    };

    const accessToken = SecurityService.generateAccessToken(payload);

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  public static async logout(sessionId: string) {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
        revoked_reason: 'USER_LOGOUT',
      },
    });
  }

  public static async logoutAll(userId: string) {
    await prisma.session.updateMany({
      where: { user_id: userId, is_revoked: false },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
        revoked_reason: 'LOGOUT_ALL_SESSIONS',
      },
    });
  }

  public static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        user_roles: {
          include: {
            role: {
              include: {
                role_permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const roles: string[] = [];
    const permissions = new Set<string>();

    for (const ur of user.user_roles) {
      roles.push(ur.role.name);
      for (const rp of ur.role.role_permissions) {
        permissions.add(rp.permission.code);
      }
    }

    return {
      id: user.id,
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      roles,
      permissions: Array.from(permissions),
    };
  }
}

import { Request, Response, NextFunction } from 'express';
import { SecurityService, TokenPayload } from '../services/security.service.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { prisma } from '../config/database.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export async function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined;

  // 1. Check Authorization header: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  // 2. Check HTTP-only cookie if header not provided
  else if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    next(new UnauthorizedError('Authentication token required'));
    return;
  }

  try {
    const payload = SecurityService.verifyAccessToken(token);

    // Verify session has not been revoked in database
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: { is_revoked: true, expires_at: true },
    });

    if (!session || session.is_revoked || session.expires_at < new Date()) {
      next(new UnauthorizedError('Session expired or revoked'));
      return;
    }

    req.user = payload;
    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid or expired authentication token'));
  }
}

export function requirePermission(...requiredPermissions: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    // Administrator role or 'admin:all' bypasses individual permission requirements
    if (req.user.roles.includes('ADMINISTRATOR') || req.user.permissions.includes('admin:all')) {
      next();
      return;
    }

    const hasAll = requiredPermissions.every((perm) => req.user?.permissions.includes(perm));
    if (!hasAll) {
      next(new ForbiddenError(`Required permission(s): ${requiredPermissions.join(', ')}`));
      return;
    }

    next();
  };
}

export function requireRole(...requiredRoles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (req.user.roles.includes('ADMINISTRATOR')) {
      next();
      return;
    }

    const hasRole = requiredRoles.some((role) => req.user?.roles.includes(role));
    if (!hasRole) {
      next(new ForbiddenError(`Required role(s): ${requiredRoles.join(', ')}`));
      return;
    }

    next();
  };
}

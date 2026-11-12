import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { authenticate, requirePermission, AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';

const router = Router();

router.get('/', authenticate, requirePermission('user:read'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
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
          user_roles: {
            include: { role: true },
          },
        },
      }),
      prisma.user.count(),
    ]);

    sendSuccess(res, users, undefined, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Users can read their own profile, or requires 'user:read' / ADMINISTRATOR
    const isSelf = req.user?.userId === id;
    const canReadUsers = req.user?.roles.includes('ADMINISTRATOR') || req.user?.permissions.includes('user:read') || req.user?.permissions.includes('admin:all');
    if (!isSelf && !canReadUsers) {
      throw new ForbiddenError('Required permission(s): user:read');
    }
    const user = await prisma.user.findUnique({
      where: { id: id! },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        status: true,
        created_at: true,
        user_roles: {
          include: { role: true },
        },
      },
    });
    if (!user) throw new NotFoundError('User', id);
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

export const userRouter = router;

import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { registerSchema, loginSchema, refreshTokenSchema } from './auth.schema.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.post('/register', validate(registerSchema), AuthController.register);
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/refresh', validate(refreshTokenSchema), AuthController.refresh);
router.post('/logout', authenticate, AuthController.logout);
router.post('/logout-all', authenticate, AuthController.logoutAll);
router.get('/me', authenticate, AuthController.me);

export const authRouter = router;

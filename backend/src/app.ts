import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/error.js';
import { prisma } from './config/database.js';

// Safe BigInt JSON serialization support
(BigInt.prototype as any).toJSON = function () {
  const intVal = Number(this);
  return Number.isSafeInteger(intVal) ? intVal : this.toString();
};

// Route imports
import { authRouter } from './modules/auth/auth.routes.js';
import { productRouter } from './modules/products/product.routes.js';
import { bomRouter } from './modules/bom/bom.routes.js';
import { ecoRouter } from './modules/eco/eco.routes.js';
import { ecrRouter } from './modules/ecr/ecr.routes.js';
import { ecnRouter } from './modules/ecn/ecn.routes.js';
import { userRouter } from './modules/users/user.routes.js';

export function createApp(): Express {
  const app = express();

  // Basic security and diagnostic middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestIdMiddleware);

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // Root info endpoint
  app.get('/', (_req, res) => {
    res.status(200).json({
      service: 'ECOFlow Backend API',
      version: '1.0.0',
      status: 'healthy',
      endpoints: {
        health: '/health',
        ready: '/ready',
        api: '/api/v1',
      },
    });
  });

  // Health and readiness endpoints
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ready', database: 'connected' });
    } catch (err: any) {
      res.status(503).json({ status: 'not_ready', database: 'disconnected', error: err.message });
    }
  });

  // API v1 routes
  const apiV1 = express.Router();
  apiV1.use('/auth', authRouter);
  apiV1.use('/products', productRouter);
  apiV1.use('/boms', bomRouter);
  apiV1.use('/ecos', ecoRouter);
  apiV1.use('/ecrs', ecrRouter);
  apiV1.use('/ecns', ecnRouter);
  apiV1.use('/users', userRouter);

  app.use('/api/v1', apiV1);

  // Global centralized error handler
  app.use(errorHandler);

  return app;
}

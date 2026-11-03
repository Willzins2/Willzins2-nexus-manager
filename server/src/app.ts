import path from 'node:path';
import fs from 'node:fs';
import express, { Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { Prisma } from '@prisma/client';
import { env, isProd } from './config/env';
import { prisma } from './lib/prisma';
import { requireAuth, requireRole } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './modules/auth/auth.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { productsRouter } from './modules/products/products.routes';
import { salesRouter } from './modules/sales/sales.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { usersRouter } from './modules/users/users.routes';
import { tasksRouter } from './modules/tasks/tasks.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // atrás do proxy do provedor (Render/Railway) — necessário p/ rate limit e cookie secure
  app.disable('x-powered-by');

  // Decimais do Prisma saem como número no JSON (em vez de string).
  app.set('json replacer', function (this: Record<string, unknown>, key: string, value: unknown) {
    const raw = this[key];
    return raw instanceof Prisma.Decimal ? raw.toNumber() : value;
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'img-src': ["'self'", 'data:'] },
      },
    }),
  );
  const origins = env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? [env.APP_URL];
  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (env.NODE_ENV !== 'test') app.use(morgan(isProd ? 'combined' : 'dev'));

  // ---- API v1 ----
  const api = Router();
  api.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', time: new Date().toISOString() });
  });
  api.use('/auth', authRouter);
  api.use('/dashboard', requireAuth, dashboardRouter);
  api.use('/customers', requireAuth, customersRouter);
  api.use('/products', requireAuth, productsRouter);
  api.use('/sales', requireAuth, salesRouter);
  api.use('/reports', requireAuth, requireRole('ADMIN', 'MANAGER'), reportsRouter);
  api.use('/users', requireAuth, usersRouter);
  api.use('/tasks', requireAuth, tasksRouter);
  api.use(notFoundHandler);
  app.use('/api/v1', api);

  // ---- Frontend (build do React) servido pelo mesmo processo em produção ----
  const webDist = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

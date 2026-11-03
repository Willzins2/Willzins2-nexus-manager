import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authUser, requireAuth, requireRole } from '../../middleware/auth';
import { unauthorized } from '../../lib/errors';
import * as service from './billing.service';
import type { Feature } from './plans';

export const billingRouter = Router();

/** Bloqueia rotas de recursos que o plano atual não inclui (402 PLAN_FEATURE). */
export const requireFeature =
  (feature: Feature): RequestHandler =>
  (req, _res, next) => {
    service.assertFeature(authUser(req).organizationId, feature).then(() => next(), next);
  };

// Webhook público (autenticado pelo token configurado no painel do Asaas).
billingRouter.post(
  '/webhook/asaas',
  asyncHandler(async (req, res) => {
    if (!service.validWebhookToken(req.header('asaas-access-token'))) throw unauthorized('Token do webhook inválido');
    res.json(await service.handleAsaasEvent(req.body));
  }),
);

billingRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await service.overview(authUser(req).organizationId));
  }),
);

billingRouter.post(
  '/subscribe',
  requireAuth,
  requireRole('ADMIN'),
  validate({
    body: z.object({
      plan: z.enum(['ESSENTIAL', 'PRO', 'BUSINESS']),
      cycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
      cpfCnpj: z.string().trim().max(20).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    res.json(await service.subscribe(authUser(req), req.body));
  }),
);

billingRouter.post(
  '/cancel',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await service.cancel(authUser(req).organizationId);
    res.json(await service.overview(authUser(req).organizationId));
  }),
);

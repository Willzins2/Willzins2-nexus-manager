import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { authUser, requireRole } from '../../middleware/auth';

export const onboardingRouter = Router();

/** Primeiros passos calculados a partir dos dados reais da empresa (sem estado extra para manter). */
onboardingRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const orgId = authUser(req).organizationId;
    const [org, products, customers, sales, users] = await Promise.all([
      prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { onboardingDismissedAt: true } }),
      prisma.product.count({ where: { organizationId: orgId } }),
      prisma.customer.count({ where: { organizationId: orgId } }),
      prisma.sale.count({ where: { organizationId: orgId } }),
      prisma.user.count({ where: { organizationId: orgId } }),
    ]);
    const steps = [
      { id: 'product', done: products > 0 },
      { id: 'customer', done: customers > 0 },
      { id: 'sale', done: sales > 0 },
      { id: 'team', done: users > 1, optional: true },
    ];
    res.json({ dismissed: !!org.onboardingDismissedAt, completed: steps.filter((s) => !s.optional).every((s) => s.done), steps });
  }),
);

onboardingRouter.post(
  '/dismiss',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    await prisma.organization.update({ where: { id: authUser(req).organizationId }, data: { onboardingDismissedAt: new Date() } });
    res.status(204).end();
  }),
);

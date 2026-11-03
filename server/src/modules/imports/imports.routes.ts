import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authUser, requireRole } from '../../middleware/auth';
import * as service from './imports.service';

export const importsRouter = Router();

const bodySchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1, 'A planilha está vazia').max(2000, 'Máximo de 2.000 linhas por importação'),
  dryRun: z.boolean().default(true), // true = só valida e mostra a prévia
});

importsRouter.post(
  '/customers',
  validate({ body: bodySchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.importCustomers(authUser(req).organizationId, req.body.rows, req.body.dryRun));
  }),
);

importsRouter.post(
  '/products',
  requireRole('ADMIN', 'MANAGER'),
  validate({ body: bodySchema }),
  asyncHandler(async (req, res) => {
    const u = authUser(req);
    res.json(await service.importProducts(u.organizationId, u.id, req.body.rows, req.body.dryRun));
  }),
);

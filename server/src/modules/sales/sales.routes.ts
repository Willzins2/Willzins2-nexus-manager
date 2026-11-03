import { Router } from 'express';
import { asyncHandler, idParam } from '../../lib/http';
import { q, validate } from '../../middleware/validate';
import { authUser } from '../../middleware/auth';
import * as service from './sales.service';
import { createSaleSchema, listSalesSchema, updateStatusSchema } from './sales.schemas';

export const salesRouter = Router();

salesRouter.get(
  '/',
  validate({ query: listSalesSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.list(authUser(req).organizationId, q(req)));
  }),
);

salesRouter.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json(await service.get(authUser(req).organizationId, req.params.id));
  }),
);

salesRouter.post(
  '/',
  validate({ body: createSaleSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.create(authUser(req), req.body));
  }),
);

salesRouter.patch(
  '/:id/status',
  validate({ params: idParam, body: updateStatusSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.updateStatus(authUser(req), req.params.id, req.body.status));
  }),
);

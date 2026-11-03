import { Router } from 'express';
import { asyncHandler, idParam } from '../../lib/http';
import { q, validate } from '../../middleware/validate';
import { authUser, requireRole } from '../../middleware/auth';
import * as service from './products.service';
import { createProductSchema, listProductsSchema, productSchema, stockMovementSchema } from './products.schemas';

export const productsRouter = Router();
const canManage = requireRole('ADMIN', 'MANAGER');

productsRouter.get(
  '/',
  validate({ query: listProductsSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.list(authUser(req).organizationId, q(req)));
  }),
);

productsRouter.get(
  '/categories',
  asyncHandler(async (req, res) => {
    res.json(await service.categories(authUser(req).organizationId));
  }),
);

productsRouter.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json(await service.get(authUser(req).organizationId, req.params.id));
  }),
);

productsRouter.post(
  '/',
  canManage,
  validate({ body: createProductSchema }),
  asyncHandler(async (req, res) => {
    const u = authUser(req);
    res.status(201).json(await service.create(u.organizationId, u.id, req.body));
  }),
);

productsRouter.put(
  '/:id',
  canManage,
  validate({ params: idParam, body: productSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.update(authUser(req).organizationId, req.params.id, req.body));
  }),
);

productsRouter.delete(
  '/:id',
  canManage,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json(await service.remove(authUser(req).organizationId, req.params.id));
  }),
);

productsRouter.get(
  '/:id/movements',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json(await service.movements(authUser(req).organizationId, req.params.id));
  }),
);

productsRouter.post(
  '/:id/movements',
  canManage,
  validate({ params: idParam, body: stockMovementSchema }),
  asyncHandler(async (req, res) => {
    const u = authUser(req);
    res.status(201).json(await service.addMovement(u.organizationId, u.id, req.params.id, req.body));
  }),
);

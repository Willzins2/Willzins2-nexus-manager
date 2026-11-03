import { Router } from 'express';
import { asyncHandler, idParam } from '../../lib/http';
import { q, validate } from '../../middleware/validate';
import { authUser, requireRole } from '../../middleware/auth';
import * as service from './customers.service';
import { customerSchema, listCustomersSchema } from './customers.schemas';

export const customersRouter = Router();

customersRouter.get(
  '/',
  validate({ query: listCustomersSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.list(authUser(req).organizationId, q(req)));
  }),
);

customersRouter.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json(await service.get(authUser(req).organizationId, req.params.id));
  }),
);

customersRouter.post(
  '/',
  validate({ body: customerSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.create(authUser(req).organizationId, req.body));
  }),
);

customersRouter.put(
  '/:id',
  validate({ params: idParam, body: customerSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.update(authUser(req).organizationId, req.params.id, req.body));
  }),
);

customersRouter.delete(
  '/:id',
  requireRole('ADMIN', 'MANAGER'),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await service.remove(authUser(req).organizationId, req.params.id);
    res.status(204).end();
  }),
);

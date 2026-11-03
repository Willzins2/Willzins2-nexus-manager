import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, idParam, optionalText } from '../../lib/http';
import { q, validate } from '../../middleware/validate';
import { authUser } from '../../middleware/auth';
import * as service from './tasks.service';

export const tasksRouter = Router();

const status = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);

export const taskSchema = z.object({
  title: z.string().trim().min(2, 'Informe o título').max(160),
  description: optionalText(4000),
  status: status.default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, 'Data inválida')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null))
    .transform((v) => (v ? new Date(v.length === 10 ? `${v}T12:00:00.000Z` : v) : null)),
  assigneeId: z.string().min(1).optional().nullable().or(z.literal('').transform(() => null)),
  customerId: z.string().min(1).optional().nullable().or(z.literal('').transform(() => null)),
});

const listSchema = z.object({
  assigneeId: z.string().optional(),
  mine: z.enum(['true', 'false']).optional(),
  search: z.string().trim().max(100).optional(),
});

tasksRouter.get(
  '/',
  validate({ query: listSchema }),
  asyncHandler(async (req, res) => {
    const u = authUser(req);
    const query = q<z.infer<typeof listSchema>>(req);
    res.json(await service.list(u.organizationId, { ...query, assigneeId: query.mine === 'true' ? u.id : query.assigneeId }));
  }),
);

tasksRouter.post(
  '/',
  validate({ body: taskSchema }),
  asyncHandler(async (req, res) => {
    const u = authUser(req);
    res.status(201).json(await service.create(u.organizationId, u.id, req.body));
  }),
);

tasksRouter.put(
  '/:id',
  validate({ params: idParam, body: taskSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.update(authUser(req).organizationId, req.params.id, req.body));
  }),
);

tasksRouter.patch(
  '/:id/status',
  validate({ params: idParam, body: z.object({ status }) }),
  asyncHandler(async (req, res) => {
    res.json(await service.update(authUser(req).organizationId, req.params.id, { status: req.body.status }));
  }),
);

tasksRouter.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await service.remove(authUser(req).organizationId, req.params.id);
    res.status(204).end();
  }),
);

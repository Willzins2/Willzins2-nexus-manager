import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, idParam } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authUser, requireRole } from '../../middleware/auth';
import { passwordRule } from '../auth/auth.schemas';
import * as service from './users.service';

export const usersRouter = Router();

const role = z.enum(['ADMIN', 'MANAGER', 'SELLER']);

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(160),
  role,
  password: passwordRule,
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: role.optional(),
  active: z.boolean().optional(),
  password: passwordRule.optional(),
});

// Lista simples (id/nome) para selects — liberada a qualquer usuário autenticado.
usersRouter.get(
  '/options',
  asyncHandler(async (req, res) => {
    res.json(await service.options(authUser(req).organizationId));
  }),
);

// Gestão de usuários: somente ADMIN.
usersRouter.use(requireRole('ADMIN'));

usersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await service.list(authUser(req).organizationId));
  }),
);

usersRouter.post(
  '/',
  validate({ body: createUserSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.create(authUser(req).organizationId, req.body, authUser(req).name));
  }),
);

usersRouter.patch(
  '/:id',
  validate({ params: idParam, body: updateUserSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.update(authUser(req), req.params.id, req.body));
  }),
);

usersRouter.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await service.remove(authUser(req), req.params.id);
    res.status(204).end();
  }),
);

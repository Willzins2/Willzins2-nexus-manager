import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { AUTH_COOKIE, authUser, requireAuth } from '../../middleware/auth';
import { env, isProd } from '../../config/env';
import * as service from './auth.service';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth.schemas';

export const authRouter = Router();

// Proteção contra força bruta nas rotas públicas de autenticação.
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas. Tente novamente em alguns minutos.' } },
});

const setAuthCookie = (res: Response, token: string) =>
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true, // inacessível a JavaScript (mitiga XSS)
    secure: isProd,
    sameSite: 'lax', // mitiga CSRF
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });

authRouter.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const { user, token } = await service.register(req.body);
    setAuthCookie(res, token);
    res.status(201).json({ user, token });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { user, token } = await service.login(req.body);
    setAuthCookie(res, token);
    res.json({ user, token });
  }),
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.status(204).end();
});

authRouter.post(
  '/logout-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await service.logoutEverywhere(authUser(req).id);
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    res.status(204).end();
  }),
);

authRouter.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(async (req, res) => {
    const { resetUrl } = await service.forgotPassword(req.body.email);
    res.json({
      message: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.',
      ...(resetUrl ? { resetUrl } : {}),
    });
  }),
);

authRouter.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    await service.resetPassword(req.body);
    res.json({ message: 'Senha redefinida com sucesso. Faça login com a nova senha.' });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: await service.me(authUser(req).id) });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    res.json({ user: await service.updateProfile(authUser(req).id, req.body) });
  }),
);

authRouter.post(
  '/me/password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    const token = await service.changePassword(authUser(req).id, req.body);
    setAuthCookie(res, token);
    res.json({ message: 'Senha alterada com sucesso' });
  }),
);

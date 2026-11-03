import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { forbidden, unauthorized } from '../lib/errors';

export const AUTH_COOKIE = 'nexus_token';

export interface AuthUser {
  id: string;
  organizationId: string;
  role: Role;
  name: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface TokenPayload {
  sub: string;
  ver: number;
}

export const signToken = (userId: string, tokenVersion: number) =>
  jwt.sign({ sub: userId, ver: tokenVersion } satisfies TokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

/**
 * Aceita o token no cookie httpOnly (navegador) ou no header Authorization: Bearer (integrações/API).
 * Confere no banco se o usuário continua ativo e se a versão do token é a atual.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.[AUTH_COOKIE];
    if (!token) throw unauthorized();

    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as unknown as TokenPayload;
    } catch {
      throw unauthorized('Sessão expirada ou inválida');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, organizationId: true, role: true, name: true, email: true, active: true, tokenVersion: true },
    });
    if (!user || !user.active || user.tokenVersion !== payload.ver) throw unauthorized('Sessão expirada ou inválida');

    req.user = { id: user.id, organizationId: user.organizationId, role: user.role, name: user.name, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
};

/** Restringe a rota aos papéis informados. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };

/** Atalho: usuário autenticado garantido (após requireAuth). */
export const authUser = (req: Express.Request): AuthUser => {
  if (!req.user) throw unauthorized();
  return req.user;
};

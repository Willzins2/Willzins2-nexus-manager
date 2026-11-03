import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { isProd } from '../config/env';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Rota ${req.method} ${req.path} não encontrada` } });
};

/** Converte qualquer erro em uma resposta JSON padronizada: { error: { code, message, details? } } */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const fields = (err.meta?.target as string[] | undefined)?.join(', ');
      return res
        .status(409)
        .json({ error: { code: 'CONFLICT', message: `Já existe um registro com este valor${fields ? ` (${fields})` : ''}` } });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Registro não encontrado' } });
    }
    if (err.code === 'P2003') {
      return res
        .status(409)
        .json({ error: { code: 'CONFLICT', message: 'Registro está em uso por outros dados e não pode ser removido' } });
    }
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'JSON malformado' } });
  }

  console.error(err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor', ...(isProd ? {} : { details: String(err?.message ?? err) }) },
  });
};

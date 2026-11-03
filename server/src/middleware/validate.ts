import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

/**
 * Valida body/query/params com Zod e substitui pelos valores já normalizados.
 * Erros de validação são tratados pelo errorHandler (422).
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) (req as any).validatedQuery = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };

/** Lê a query validada (Express 4 não permite reatribuir req.query de forma tipada). */
export const q = <T>(req: Express.Request): T => (req as any).validatedQuery as T;

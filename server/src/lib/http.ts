import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

/** Encaminha erros de handlers assíncronos para o middleware de erro. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Query string padrão de listagens. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const paginate = (p: Pagination) => ({ skip: (p.page - 1) * p.pageSize, take: p.pageSize });

export const paged = <T>(data: T[], total: number, p: Pagination) => ({
  data,
  meta: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.max(1, Math.ceil(total / p.pageSize)) },
});

/** Converte string vazia em undefined (útil para campos opcionais de formulário). */
export const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const idParam = z.object({ id: z.string().min(1) });

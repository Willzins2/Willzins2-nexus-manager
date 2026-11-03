import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http';
import { q, validate } from '../../middleware/validate';
import { authUser } from '../../middleware/auth';
import { badRequest } from '../../lib/errors';
import * as service from './reports.service';

export const reportsRouter = Router();

const periodSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato AAAA-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato AAAA-MM-DD').optional(),
});

/** Padrão: últimos 6 meses até hoje. */
const toPeriod = ({ from, to }: z.infer<typeof periodSchema>): service.Period => {
  const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
  const d = new Date();
  const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 5, 1));
  if (start > end) throw badRequest('A data inicial deve ser anterior à final');
  if (end.getTime() - start.getTime() > 3 * 366 * 86_400_000) throw badRequest('Período máximo de 3 anos');
  return { from: start, to: end };
};

reportsRouter.get(
  '/summary',
  validate({ query: periodSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.summary(authUser(req).organizationId, toPeriod(q(req))));
  }),
);

reportsRouter.get(
  '/sales.csv',
  validate({ query: periodSchema }),
  asyncHandler(async (req, res) => {
    const csv = await service.salesCsv(authUser(req).organizationId, toPeriod(q(req)));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="vendas.csv"');
    res.send(csv);
  }),
);

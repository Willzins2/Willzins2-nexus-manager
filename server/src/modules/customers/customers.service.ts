import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';
import { paged, paginate } from '../../lib/http';
import type { customerSchema, listCustomersSchema } from './customers.schemas';

type Input = z.infer<typeof customerSchema>;

export async function list(orgId: string, p: z.infer<typeof listCustomersSchema>) {
  const where: Prisma.CustomerWhereInput = { organizationId: orgId };
  if (p.search) {
    where.OR = [
      { name: { contains: p.search, mode: 'insensitive' } },
      { email: { contains: p.search, mode: 'insensitive' } },
      { company: { contains: p.search, mode: 'insensitive' } },
      { phone: { contains: p.search } },
      { document: { contains: p.search } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: p.sort === 'name' ? { name: 'asc' } : { createdAt: 'desc' },
      ...paginate(p),
      include: { _count: { select: { sales: true } } },
    }),
    prisma.customer.count({ where }),
  ]);
  return paged(rows, total, p);
}

export async function get(orgId: string, id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: orgId },
    include: {
      sales: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, number: true, total: true, status: true, createdAt: true } },
    },
  });
  if (!customer) throw notFound('Cliente');
  const stats = await prisma.sale.aggregate({
    where: { customerId: id, status: 'PAID' },
    _sum: { total: true },
    _count: true,
  });
  return { ...customer, stats: { totalSpent: stats._sum.total ?? 0, paidSales: stats._count } };
}

export const create = (orgId: string, data: Input) => prisma.customer.create({ data: { ...data, organizationId: orgId } });

export async function update(orgId: string, id: string, data: Input) {
  await ensure(orgId, id);
  return prisma.customer.update({ where: { id }, data });
}

export async function remove(orgId: string, id: string) {
  await ensure(orgId, id);
  // As vendas do cliente são preservadas (customerId vira null) para não distorcer relatórios.
  await prisma.customer.delete({ where: { id } });
}

async function ensure(orgId: string, id: string) {
  const c = await prisma.customer.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
  if (!c) throw notFound('Cliente');
}

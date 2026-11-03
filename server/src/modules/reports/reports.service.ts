import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const TZ = 'America/Sao_Paulo';
const num = (v: unknown) => (v == null ? 0 : Number(v));

export interface Period {
  from: Date;
  to: Date;
}

/** Resumo de desempenho no período: faturamento, lucro bruto, margens e rankings. */
export async function summary(orgId: string, { from, to }: Period) {
  const base = Prisma.sql`s."organizationId" = ${orgId} AND s."createdAt" >= ${from} AND s."createdAt" <= ${to}`;
  const paidWhere: Prisma.SaleWhereInput = { organizationId: orgId, status: 'PAID', createdAt: { gte: from, lte: to } };

  const [paid, canceled, pending, byMonth, byProduct, bySeller, byCustomer, byPayment, byCategory] = await Promise.all([
    prisma.sale.aggregate({ where: paidWhere, _sum: { total: true, cost: true, discount: true }, _count: true }),
    prisma.sale.aggregate({ where: { ...paidWhere, status: 'CANCELED' }, _sum: { total: true }, _count: true }),
    prisma.sale.aggregate({ where: { ...paidWhere, status: 'PENDING' }, _sum: { total: true }, _count: true }),
    prisma.$queryRaw<{ month: Date; revenue: Prisma.Decimal; cost: Prisma.Decimal; count: bigint }[]>`
      SELECT date_trunc('month', s."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TZ}) AS month,
             SUM(s.total) AS revenue, SUM(s.cost) AS cost, COUNT(*) AS count
      FROM "Sale" s WHERE ${base} AND s.status = 'PAID' GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ productId: string; name: string; sku: string; quantity: bigint; revenue: Prisma.Decimal; cost: Prisma.Decimal }[]>`
      SELECT i."productId", MAX(i.name) AS name, MAX(p.sku) AS sku, SUM(i.quantity) AS quantity,
             SUM(i.subtotal) AS revenue, SUM(i."unitCost" * i.quantity) AS cost
      FROM "SaleItem" i JOIN "Sale" s ON s.id = i."saleId" JOIN "Product" p ON p.id = i."productId"
      WHERE ${base} AND s.status = 'PAID' GROUP BY i."productId" ORDER BY revenue DESC LIMIT 10`,
    prisma.$queryRaw<{ userId: string | null; name: string | null; revenue: Prisma.Decimal; count: bigint }[]>`
      SELECT s."userId", MAX(u.name) AS name, SUM(s.total) AS revenue, COUNT(*) AS count
      FROM "Sale" s LEFT JOIN "User" u ON u.id = s."userId"
      WHERE ${base} AND s.status = 'PAID' GROUP BY s."userId" ORDER BY revenue DESC`,
    prisma.$queryRaw<{ customerId: string; name: string; revenue: Prisma.Decimal; count: bigint }[]>`
      SELECT s."customerId", MAX(c.name) AS name, SUM(s.total) AS revenue, COUNT(*) AS count
      FROM "Sale" s JOIN "Customer" c ON c.id = s."customerId"
      WHERE ${base} AND s.status = 'PAID' GROUP BY s."customerId" ORDER BY revenue DESC LIMIT 10`,
    prisma.$queryRaw<{ method: string; revenue: Prisma.Decimal; count: bigint }[]>`
      SELECT s."paymentMethod"::text AS method, SUM(s.total) AS revenue, COUNT(*) AS count
      FROM "Sale" s WHERE ${base} AND s.status = 'PAID' GROUP BY 1 ORDER BY revenue DESC`,
    prisma.$queryRaw<{ category: string | null; revenue: Prisma.Decimal; quantity: bigint }[]>`
      SELECT p.category, SUM(i.subtotal) AS revenue, SUM(i.quantity) AS quantity
      FROM "SaleItem" i JOIN "Sale" s ON s.id = i."saleId" JOIN "Product" p ON p.id = i."productId"
      WHERE ${base} AND s.status = 'PAID' GROUP BY p.category ORDER BY revenue DESC`,
  ]);

  const revenue = num(paid._sum.total);
  const cost = num(paid._sum.cost);

  return {
    period: { from, to },
    totals: {
      revenue,
      cost,
      grossProfit: revenue - cost,
      margin: revenue > 0 ? (revenue - cost) / revenue : 0,
      discounts: num(paid._sum.discount),
      salesCount: paid._count,
      averageTicket: paid._count ? revenue / paid._count : 0,
      canceledCount: canceled._count,
      canceledAmount: num(canceled._sum.total),
      pendingCount: pending._count,
      pendingAmount: num(pending._sum.total),
    },
    byMonth: byMonth.map((m) => ({
      month: m.month.toISOString().slice(0, 7),
      revenue: num(m.revenue),
      profit: num(m.revenue) - num(m.cost),
      count: num(m.count),
    })),
    byProduct: byProduct.map((p) => ({
      productId: p.productId,
      name: p.name,
      sku: p.sku,
      quantity: num(p.quantity),
      revenue: num(p.revenue),
      profit: num(p.revenue) - num(p.cost),
    })),
    bySeller: bySeller.map((s) => ({ userId: s.userId, name: s.name ?? 'Usuário removido', revenue: num(s.revenue), count: num(s.count) })),
    byCustomer: byCustomer.map((c) => ({ customerId: c.customerId, name: c.name, revenue: num(c.revenue), count: num(c.count) })),
    byPaymentMethod: byPayment.map((p) => ({ method: p.method, revenue: num(p.revenue), count: num(p.count) })),
    byCategory: byCategory.map((c) => ({ category: c.category ?? 'Sem categoria', revenue: num(c.revenue), quantity: num(c.quantity) })),
  };
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // Previne injeção de fórmulas em planilhas (=, +, -, @).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Exporta as vendas do período em CSV (separador ";" para abrir direto no Excel em pt-BR). */
export async function salesCsv(orgId: string, { from, to }: Period) {
  const sales = await prisma.sale.findMany({
    where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: 'asc' },
    include: { customer: { select: { name: true } }, user: { select: { name: true } } },
  });
  const header = ['Número', 'Data', 'Cliente', 'Vendedor', 'Status', 'Pagamento', 'Subtotal', 'Desconto', 'Total', 'Custo'];
  const fmt = (d: Prisma.Decimal) => d.toFixed(2).replace('.', ',');
  const lines = sales.map((s) =>
    [
      s.number,
      s.createdAt.toISOString(),
      s.customer?.name ?? '',
      s.user?.name ?? '',
      s.status,
      s.paymentMethod,
      fmt(s.subtotal),
      fmt(s.discount),
      fmt(s.total),
      fmt(s.cost),
    ]
      .map(csvCell)
      .join(';'),
  );
  return '﻿' + [header.join(';'), ...lines].join('\n');
}

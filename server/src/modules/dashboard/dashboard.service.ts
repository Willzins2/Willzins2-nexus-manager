import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const TZ = 'America/Sao_Paulo';
const num = (v: unknown) => (v == null ? 0 : Number(v));

/** Início do mês corrente/anterior (aproximação em UTC; suficiente para indicadores). */
const monthStart = (offset = 0) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
};

export async function overview(orgId: string) {
  const thisMonth = monthStart(0);
  const lastMonth = monthStart(-1);
  const since30 = new Date(Date.now() - 29 * 86_400_000);
  since30.setUTCHours(0, 0, 0, 0);

  const paid = (from: Date, to?: Date): Prisma.SaleWhereInput => ({
    organizationId: orgId,
    status: 'PAID',
    createdAt: { gte: from, ...(to ? { lt: to } : {}) },
  });

  const [cur, prev, customers, newCustomers, openTasks, pending, lowStockRows, daily, top, recent, byPayment] = await Promise.all([
    prisma.sale.aggregate({ where: paid(thisMonth), _sum: { total: true, cost: true }, _count: true }),
    // Compara com o mesmo intervalo do mês anterior (mês-até-hoje), para não penalizar o início do mês.
    prisma.sale.aggregate({
      where: paid(lastMonth, new Date(Math.min(thisMonth.getTime(), lastMonth.getTime() + (Date.now() - thisMonth.getTime())))),
      _sum: { total: true },
      _count: true,
    }),
    prisma.customer.count({ where: { organizationId: orgId } }),
    prisma.customer.count({ where: { organizationId: orgId, createdAt: { gte: thisMonth } } }),
    prisma.task.count({ where: { organizationId: orgId, status: { not: 'DONE' } } }),
    prisma.sale.aggregate({ where: { organizationId: orgId, status: 'PENDING' }, _sum: { total: true }, _count: true }),
    prisma.$queryRaw<{ id: string; name: string; sku: string; stock: number; minStock: number }[]>`
      SELECT id, name, sku, stock, "minStock" FROM "Product"
      WHERE "organizationId" = ${orgId} AND active = true AND stock <= "minStock"
      ORDER BY stock ASC, name ASC LIMIT 6`,
    prisma.$queryRaw<{ day: Date; revenue: Prisma.Decimal; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TZ}) AS day,
             SUM(total) AS revenue, COUNT(*) AS count
      FROM "Sale"
      WHERE "organizationId" = ${orgId} AND status = 'PAID' AND "createdAt" >= ${since30}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ productId: string; name: string; quantity: bigint; revenue: Prisma.Decimal }[]>`
      SELECT i."productId", MAX(i.name) AS name, SUM(i.quantity) AS quantity, SUM(i.subtotal) AS revenue
      FROM "SaleItem" i JOIN "Sale" s ON s.id = i."saleId"
      WHERE s."organizationId" = ${orgId} AND s.status = 'PAID' AND s."createdAt" >= ${since30}
      GROUP BY i."productId" ORDER BY revenue DESC LIMIT 5`,
    prisma.sale.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, number: true, total: true, status: true, createdAt: true, customer: { select: { name: true } } },
    }),
    prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: paid(since30),
      _sum: { total: true },
      _count: true,
    }),
  ]);

  const lowStockCount = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*) AS c FROM "Product" WHERE "organizationId" = ${orgId} AND active = true AND stock <= "minStock"`;

  // Série contínua de 30 dias (dias sem venda aparecem com zero).
  const map = new Map(daily.map((d) => [d.day.toISOString().slice(0, 10), d]));
  const series = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(since30.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    const row = map.get(day);
    return { date: day, revenue: num(row?.revenue), count: num(row?.count) };
  });

  const revenue = num(cur._sum.total);
  const prevRevenue = num(prev._sum.total);

  return {
    kpis: {
      revenueMonth: revenue,
      revenueGrowth: prevRevenue > 0 ? (revenue - prevRevenue) / prevRevenue : null,
      grossProfitMonth: revenue - num(cur._sum.cost),
      salesMonth: cur._count,
      salesGrowth: prev._count > 0 ? (cur._count - prev._count) / prev._count : null,
      averageTicket: cur._count ? revenue / cur._count : 0,
      customers,
      newCustomersMonth: newCustomers,
      lowStock: num(lowStockCount[0]?.c),
      openTasks,
      pendingAmount: num(pending._sum.total),
      pendingCount: pending._count,
    },
    salesByDay: series,
    topProducts: top.map((t) => ({ productId: t.productId, name: t.name, quantity: num(t.quantity), revenue: num(t.revenue) })),
    byPaymentMethod: byPayment.map((b) => ({ method: b.paymentMethod, total: num(b._sum.total), count: b._count })),
    recentSales: recent,
    lowStockProducts: lowStockRows,
  };
}

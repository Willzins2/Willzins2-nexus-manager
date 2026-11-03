import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendMail } from '../../lib/mailer';
import { weeklySummaryEmail, type WeeklyData } from '../../lib/email-templates';

const DAY = 86_400_000;
const num = (v: unknown) => (v == null ? 0 : Number(v));
const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

/** Consolida os números dos últimos 7 dias (e dos 7 anteriores, para comparação). */
export async function buildWeeklyData(orgId: string, now = new Date()): Promise<WeeklyData> {
  const from = new Date(now.getTime() - 7 * DAY);
  const prevFrom = new Date(now.getTime() - 14 * DAY);
  const paid = (gte: Date, lt: Date): Prisma.SaleWhereInput => ({ organizationId: orgId, status: 'PAID', createdAt: { gte, lt } });

  const [org, cur, prev, pending, newCustomers, top, low] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true } }),
    prisma.sale.aggregate({ where: paid(from, now), _sum: { total: true }, _count: true }),
    prisma.sale.aggregate({ where: paid(prevFrom, from), _sum: { total: true }, _count: true }),
    prisma.sale.aggregate({ where: { organizationId: orgId, status: 'PENDING' }, _sum: { total: true } }),
    prisma.customer.count({ where: { organizationId: orgId, createdAt: { gte: from } } }),
    prisma.$queryRaw<{ name: string; quantity: bigint; revenue: Prisma.Decimal }[]>`
      SELECT MAX(i.name) AS name, SUM(i.quantity) AS quantity, SUM(i.subtotal) AS revenue
      FROM "SaleItem" i JOIN "Sale" s ON s.id = i."saleId"
      WHERE s."organizationId" = ${orgId} AND s.status = 'PAID' AND s."createdAt" >= ${from} AND s."createdAt" < ${now}
      GROUP BY i."productId" ORDER BY revenue DESC LIMIT 3`,
    prisma.$queryRaw<{ name: string; stock: number; minStock: number }[]>`
      SELECT name, stock, "minStock" FROM "Product"
      WHERE "organizationId" = ${orgId} AND active = true AND stock <= "minStock" ORDER BY stock ASC LIMIT 5`,
  ]);

  const revenue = num(cur._sum.total);
  return {
    company: org.name,
    periodLabel: `de ${fmt(from)} a ${fmt(new Date(now.getTime() - 1))}`,
    revenue,
    revenuePrev: num(prev._sum.total),
    sales: cur._count,
    salesPrev: prev._count,
    averageTicket: cur._count ? revenue / cur._count : 0,
    pendingAmount: num(pending._sum.total),
    newCustomers,
    topProducts: top.map((t) => ({ name: t.name, quantity: num(t.quantity), revenue: num(t.revenue) })),
    lowStock: low,
  };
}

/** Envia o resumo para administradores e gerentes ativos que não desligaram o e-mail. */
export async function sendWeeklySummary(orgId: string, now = new Date()) {
  const data = await buildWeeklyData(orgId, now);
  const recipients = await prisma.user.findMany({
    where: { organizationId: orgId, active: true, weeklySummary: true, role: { in: ['ADMIN', 'MANAGER'] } },
    select: { name: true, email: true },
  });
  for (const r of recipients) {
    const { subject, html } = weeklySummaryEmail(r.name, data);
    await sendMail(r.email, subject, html);
  }
  await prisma.organization.update({ where: { id: orgId }, data: { lastWeeklySummaryAt: now } });
  return recipients.length;
}

/** Segunda-feira 08:00 de Brasília (UTC−3) da semana de `now`, em UTC. */
export function currentSlot(now = new Date()) {
  const br = new Date(now.getTime() - 3 * 3_600_000); // relógio de Brasília
  const dow = (br.getUTCDay() + 6) % 7; // 0 = segunda
  const monday = Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() - dow, 8 + 3); // 08h BRT = 11h UTC
  return new Date(monday);
}

/**
 * Envia para as empresas que ainda não receberam o resumo desta semana.
 * Idempotente: pode rodar a cada hora (agendador interno) ou por cron externo.
 */
export async function runWeeklySummaries(now = new Date()) {
  const slot = currentSlot(now);
  if (now < slot) return { sent: 0 };
  const orgs = await prisma.organization.findMany({
    where: { OR: [{ lastWeeklySummaryAt: null }, { lastWeeklySummaryAt: { lt: slot } }], sales: { some: {} } },
    select: { id: true },
  });
  let sent = 0;
  for (const o of orgs) {
    try {
      sent += await sendWeeklySummary(o.id, now);
    } catch (e) {
      console.error(`[weekly-summary] falha na empresa ${o.id}`, e);
    }
  }
  return { sent, organizations: orgs.length };
}

export function startWeeklyScheduler() {
  const tick = () => runWeeklySummaries().catch((e) => console.error('[weekly-summary]', e));
  setTimeout(tick, 60_000).unref();
  setInterval(tick, 60 * 60_000).unref();
}

import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { forbidden, notFound, unprocessable } from '../../lib/errors';
import { paged, paginate } from '../../lib/http';
import type { AuthUser } from '../../middleware/auth';
import type { createSaleSchema, listSalesSchema } from './sales.schemas';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const saleInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  user: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, sku: true } } } },
} satisfies Prisma.SaleInclude;

/** Converte AAAA-MM-DD em intervalo [início do dia, fim do dia] (UTC). */
export const dayRange = (from?: string, to?: string) => {
  const range: Prisma.DateTimeFilter = {};
  if (from) range.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) range.lte = new Date(`${to}T23:59:59.999Z`);
  return Object.keys(range).length ? range : undefined;
};

export async function list(orgId: string, p: z.infer<typeof listSalesSchema>) {
  const where: Prisma.SaleWhereInput = { organizationId: orgId };
  if (p.status) where.status = p.status;
  if (p.customerId) where.customerId = p.customerId;
  const createdAt = dayRange(p.from, p.to);
  if (createdAt) where.createdAt = createdAt;
  if (p.search) {
    const n = Number(p.search.replace('#', ''));
    where.OR = [
      { customer: { name: { contains: p.search, mode: 'insensitive' } } },
      ...(Number.isInteger(n) && n > 0 ? [{ number: n }] : []),
    ];
  }
  const [rows, total, sum] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...paginate(p),
      include: { customer: { select: { id: true, name: true } }, user: { select: { id: true, name: true } }, _count: { select: { items: true } } },
    }),
    prisma.sale.count({ where }),
    prisma.sale.aggregate({ where: { ...where, status: { not: 'CANCELED' } }, _sum: { total: true } }),
  ]);
  return { ...paged(rows, total, p), summary: { total: sum._sum.total ?? 0 } };
}

export async function get(orgId: string, id: string) {
  const sale = await prisma.sale.findFirst({ where: { id, organizationId: orgId }, include: saleInclude });
  if (!sale) throw notFound('Venda');
  return sale;
}

/**
 * Registra a venda em uma única transação:
 * valida produtos e estoque (com lock de linha), baixa o estoque, grava movimentos e calcula totais.
 */
export async function create(user: AuthUser, input: z.infer<typeof createSaleSchema>) {
  const orgId = user.organizationId;
  return prisma.$transaction(async (tx) => {
    if (input.customerId) {
      const c = await tx.customer.findFirst({ where: { id: input.customerId, organizationId: orgId }, select: { id: true } });
      if (!c) throw unprocessable('Cliente não encontrado');
    }

    // Lock da organização serializa a numeração sequencial das vendas.
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${orgId} FOR UPDATE`;

    const ids = input.items.map((i) => i.productId);
    const products = await tx.$queryRaw<
      { id: string; name: string; price: Prisma.Decimal; cost: Prisma.Decimal; stock: number; active: boolean }[]
    >`SELECT id, name, price, cost, stock, active FROM "Product"
      WHERE "organizationId" = ${orgId} AND id IN (${Prisma.join(ids)}) FOR UPDATE`;
    const byId = new Map(products.map((p) => [p.id, p]));

    const errors: { field: string; message: string }[] = [];
    input.items.forEach((item, idx) => {
      const p = byId.get(item.productId);
      if (!p) errors.push({ field: `items.${idx}.productId`, message: 'Produto não encontrado' });
      else if (!p.active) errors.push({ field: `items.${idx}.productId`, message: `${p.name} está inativo` });
      else if (p.stock < item.quantity)
        errors.push({ field: `items.${idx}.quantity`, message: `Estoque insuficiente de ${p.name} (disponível: ${p.stock})` });
    });
    if (errors.length) throw unprocessable('Não foi possível registrar a venda', errors);

    const lines = input.items.map((item) => {
      const p = byId.get(item.productId)!;
      const unitPrice = item.unitPrice !== undefined ? D(item.unitPrice) : D(p.price);
      return { ...item, name: p.name, unitPrice, unitCost: D(p.cost), subtotal: unitPrice.mul(item.quantity), stock: p.stock };
    });
    const subtotal = lines.reduce((acc, l) => acc.add(l.subtotal), D(0));
    const discount = D(input.discount);
    if (discount.gt(subtotal)) throw unprocessable('Desconto maior que o subtotal');
    const cost = lines.reduce((acc, l) => acc.add(l.unitCost.mul(l.quantity)), D(0));

    const last = await tx.sale.findFirst({ where: { organizationId: orgId }, orderBy: { number: 'desc' }, select: { number: true } });

    const sale = await tx.sale.create({
      data: {
        organizationId: orgId,
        number: (last?.number ?? 0) + 1,
        customerId: input.customerId ?? null,
        userId: user.id,
        status: input.status,
        paymentMethod: input.paymentMethod,
        subtotal,
        discount,
        total: subtotal.sub(discount),
        cost,
        notes: input.notes,
        paidAt: input.status === 'PAID' ? new Date() : null,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            unitCost: l.unitCost,
            subtotal: l.subtotal,
          })),
        },
      },
    });

    for (const l of lines) {
      const balance = l.stock - l.quantity;
      await tx.product.update({ where: { id: l.productId }, data: { stock: balance } });
      await tx.stockMovement.create({
        data: {
          organizationId: orgId,
          productId: l.productId,
          userId: user.id,
          saleId: sale.id,
          type: 'SALE',
          quantity: -l.quantity,
          balance,
          reason: `Venda #${sale.number}`,
        },
      });
    }

    return tx.sale.findUniqueOrThrow({ where: { id: sale.id }, include: saleInclude });
  });
}

/** PENDING → PAID; PENDING/PAID → CANCELED (devolve os itens ao estoque). */
export async function updateStatus(user: AuthUser, id: string, status: 'PAID' | 'CANCELED') {
  if (status === 'CANCELED' && user.role === 'SELLER') throw forbidden('Apenas gerentes e administradores podem cancelar vendas');

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id, organizationId: user.organizationId }, include: { items: true } });
    if (!sale) throw notFound('Venda');
    if (sale.status === 'CANCELED') throw unprocessable('Venda já está cancelada');
    if (sale.status === status) throw unprocessable('A venda já está com este status');

    if (status === 'PAID') {
      await tx.sale.update({ where: { id }, data: { status: 'PAID', paidAt: new Date() } });
    } else {
      for (const item of sale.items) {
        const product = await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        await tx.stockMovement.create({
          data: {
            organizationId: user.organizationId,
            productId: item.productId,
            userId: user.id,
            saleId: sale.id,
            type: 'SALE_CANCEL',
            quantity: item.quantity,
            balance: product.stock,
            reason: `Cancelamento da venda #${sale.number}`,
          },
        });
      }
      await tx.sale.update({ where: { id }, data: { status: 'CANCELED', canceledAt: new Date() } });
    }
    return tx.sale.findUniqueOrThrow({ where: { id }, include: saleInclude });
  });
}

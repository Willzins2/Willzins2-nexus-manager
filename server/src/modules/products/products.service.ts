import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { notFound, unprocessable } from '../../lib/errors';
import { paged, paginate } from '../../lib/http';
import type { createProductSchema, listProductsSchema, productSchema, stockMovementSchema } from './products.schemas';

export async function list(orgId: string, p: z.infer<typeof listProductsSchema>) {
  const where: Prisma.ProductWhereInput = { organizationId: orgId };
  if (p.search) {
    where.OR = [
      { name: { contains: p.search, mode: 'insensitive' } },
      { sku: { contains: p.search, mode: 'insensitive' } },
      { category: { contains: p.search, mode: 'insensitive' } },
    ];
  }
  if (p.category) where.category = p.category;
  if (p.active !== 'all') where.active = p.active === 'true';
  if (p.stock === 'out') where.stock = { lte: 0 };

  // "Estoque baixo" compara duas colunas (stock <= minStock): resolvido com SQL bruto parametrizado.
  if (p.stock === 'low') {
    const ids = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Product" WHERE "organizationId" = ${orgId} AND stock <= "minStock"`;
    where.id = { in: ids.map((r) => r.id) };
  }

  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { name: 'asc' }, ...paginate(p) }),
    prisma.product.count({ where }),
  ]);
  return paged(rows, total, p);
}

export async function categories(orgId: string) {
  const rows = await prisma.product.findMany({
    where: { organizationId: orgId, category: { not: null } },
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category as string);
}

export async function get(orgId: string, id: string) {
  const product = await prisma.product.findFirst({ where: { id, organizationId: orgId } });
  if (!product) throw notFound('Produto');
  return product;
}

export async function create(orgId: string, userId: string, data: z.infer<typeof createProductSchema>) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data: { ...data, organizationId: orgId } });
    if (data.stock > 0) {
      await tx.stockMovement.create({
        data: {
          organizationId: orgId,
          productId: product.id,
          userId,
          type: 'IN',
          quantity: data.stock,
          balance: data.stock,
          reason: 'Estoque inicial',
        },
      });
    }
    return product;
  });
}

export async function update(orgId: string, id: string, data: z.infer<typeof productSchema>) {
  await get(orgId, id);
  // O estoque nunca é editado diretamente: só por movimentações (rastreabilidade).
  return prisma.product.update({ where: { id }, data });
}

export async function remove(orgId: string, id: string) {
  await get(orgId, id);
  const used = await prisma.saleItem.count({ where: { productId: id } });
  if (used > 0) {
    // Produto com histórico de vendas é desativado em vez de excluído.
    await prisma.product.update({ where: { id }, data: { active: false } });
    return { deleted: false, deactivated: true };
  }
  await prisma.product.delete({ where: { id } });
  return { deleted: true, deactivated: false };
}

export async function addMovement(orgId: string, userId: string, id: string, input: z.infer<typeof stockMovementSchema>) {
  return prisma.$transaction(async (tx) => {
    // Bloqueia a linha do produto para evitar condição de corrida em movimentos simultâneos.
    const [locked] = await tx.$queryRaw<{ stock: number }[]>`
      SELECT stock FROM "Product" WHERE id = ${id} AND "organizationId" = ${orgId} FOR UPDATE`;
    if (!locked) throw notFound('Produto');

    let delta: number;
    if (input.type === 'IN') delta = input.quantity;
    else if (input.type === 'OUT') delta = -input.quantity;
    else delta = input.quantity - locked.stock;

    const balance = locked.stock + delta;
    if (balance < 0) throw unprocessable(`Estoque insuficiente (saldo atual: ${locked.stock})`);

    const product = await tx.product.update({ where: { id }, data: { stock: balance } });
    const movement = await tx.stockMovement.create({
      data: { organizationId: orgId, productId: id, userId, type: input.type, quantity: delta, balance, reason: input.reason },
    });
    return { product, movement };
  });
}

export async function movements(orgId: string, id: string) {
  await get(orgId, id);
  return prisma.stockMovement.findMany({
    where: { productId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { id: true, name: true } }, sale: { select: { id: true, number: true } } },
  });
}

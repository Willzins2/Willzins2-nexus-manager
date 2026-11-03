import { z } from 'zod';
import { optionalText, paginationSchema } from '../../lib/http';

const money = z.coerce.number().min(0, 'Valor não pode ser negativo').max(99_999_999).multipleOf(0.01, 'Máximo de 2 casas decimais');

export const productSchema = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Informe o SKU')
    .max(40)
    .regex(/^[A-Z0-9._-]+$/, 'SKU aceita apenas letras, números, ponto, hífen e sublinhado'),
  name: z.string().trim().min(2, 'Informe o nome').max(160),
  description: optionalText(2000),
  category: optionalText(80),
  price: money,
  cost: money.default(0),
  minStock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  active: z.boolean().default(true),
});

// Na criação é possível informar o estoque inicial (gera um movimento de entrada).
export const createProductSchema = productSchema.extend({
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const listProductsSchema = paginationSchema.extend({
  category: z.string().trim().optional(),
  stock: z.enum(['all', 'low', 'out']).default('all'),
  active: z.enum(['all', 'true', 'false']).default('all'),
});

export const stockMovementSchema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUST']),
  // IN/OUT: quantidade a somar/subtrair. ADJUST: novo saldo absoluto (inventário).
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  reason: optionalText(255),
}).refine((v) => v.type === 'ADJUST' || v.quantity > 0, { message: 'Quantidade deve ser maior que zero', path: ['quantity'] });

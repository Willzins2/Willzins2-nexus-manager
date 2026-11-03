import { z } from 'zod';
import { optionalText, paginationSchema } from '../../lib/http';

export const paymentMethods = ['CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_SLIP', 'TRANSFER'] as const;

export const createSaleSchema = z.object({
  customerId: z.string().min(1).optional().nullable(),
  paymentMethod: z.enum(paymentMethods).default('PIX'),
  status: z.enum(['PENDING', 'PAID']).default('PAID'),
  discount: z.coerce.number().min(0).max(99_999_999).multipleOf(0.01).default(0),
  notes: optionalText(1000),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().min(1, 'Quantidade mínima é 1').max(100_000),
        // Opcional: permite preço negociado; se omitido, usa o preço do cadastro.
        unitPrice: z.coerce.number().min(0).max(99_999_999).multipleOf(0.01).optional(),
      }),
    )
    .min(1, 'Adicione ao menos um item')
    .max(200)
    .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, 'Produto repetido na venda'),
});

export const updateStatusSchema = z.object({
  status: z.enum(['PAID', 'CANCELED']),
});

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato AAAA-MM-DD')
  .optional();

export const listSalesSchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'PAID', 'CANCELED']).optional(),
  customerId: z.string().optional(),
  from: dateParam,
  to: dateParam,
});

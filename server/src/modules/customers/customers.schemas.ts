import { z } from 'zod';
import { optionalText, paginationSchema } from '../../lib/http';

const onlyDigits = (v: string) => v.replace(/\D/g, '');

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(160),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('E-mail inválido')
    .max(160)
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null))
    .transform((v) => v || null),
  phone: optionalText(30).refine((v) => !v || onlyDigits(v).length >= 10, 'Telefone deve ter DDD + número'),
  document: optionalText(20).refine(
    (v) => !v || [11, 14].includes(onlyDigits(v).length),
    'CPF deve ter 11 dígitos ou CNPJ 14 dígitos',
  ),
  company: optionalText(160),
  address: optionalText(255),
  city: optionalText(100),
  state: optionalText(2)
    .refine((v) => !v || /^[A-Za-z]{2}$/.test(v), 'UF deve ter 2 letras')
    .transform((v) => v?.toUpperCase() ?? null),
  notes: optionalText(2000),
});

export const listCustomersSchema = paginationSchema.extend({
  sort: z.enum(['name', 'createdAt']).default('name'),
});

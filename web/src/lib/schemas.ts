import { z } from 'zod';

/** Regras espelhadas da API (a API valida de novo — o cliente só antecipa o feedback). */
export const password = z
  .string()
  .min(8, 'Mínimo de 8 caracteres')
  .max(72, 'Máximo de 72 caracteres')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número');

export const email = z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido');

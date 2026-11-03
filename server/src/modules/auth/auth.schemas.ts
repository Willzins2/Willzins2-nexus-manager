import { z } from 'zod';

export const passwordRule = z
  .string()
  .min(8, 'A senha deve ter ao menos 8 caracteres')
  .max(72, 'A senha deve ter no máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra')
  .regex(/\d/, 'A senha deve conter ao menos um número');

const email = z.string().trim().toLowerCase().email('E-mail inválido').max(160);

export const registerSchema = z.object({
  companyName: z.string().trim().min(2, 'Informe o nome da empresa').max(120),
  name: z.string().trim().min(2, 'Informe seu nome').max(120),
  email,
  password: passwordRule,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha').max(72),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordRule,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: passwordRule,
});

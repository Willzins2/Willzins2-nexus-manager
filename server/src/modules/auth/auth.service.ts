import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { badRequest, conflict, unauthorized } from '../../lib/errors';
import { sendMail } from '../../lib/mailer';
import { env } from '../../config/env';
import { signToken } from '../../middleware/auth';
import type {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth.schemas';

const BCRYPT_ROUNDS = 12;
const RESET_TTL_MINUTES = 30;

export const publicUser = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  organizationId: true,
  createdAt: true,
  lastLoginAt: true,
  organization: { select: { id: true, name: true } },
} as const;

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

/** Cria a organização (tenant) e o primeiro usuário como ADMIN. */
export async function register(input: z.infer<typeof registerSchema>) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw conflict('Este e-mail já está cadastrado');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'ADMIN',
      lastLoginAt: new Date(),
      organization: { create: { name: input.companyName } },
    },
    select: { ...publicUser, tokenVersion: true },
  });
  const { tokenVersion, ...safe } = user;
  return { user: safe, token: signToken(user.id, tokenVersion) };
}

export async function login(input: z.infer<typeof loginSchema>) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Mesma mensagem para e-mail inexistente e senha errada (evita enumeração de usuários).
  const ok = user ? await bcrypt.compare(input.password, user.passwordHash) : await bcrypt.compare(input.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
  if (!user || !ok) throw unauthorized('E-mail ou senha incorretos');
  if (!user.active) throw unauthorized('Usuário desativado. Fale com o administrador.');

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: publicUser,
  });
  return { user: updated, token: signToken(user.id, user.tokenVersion) };
}

export async function me(userId: string) {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: publicUser });
}

/** Invalida todos os tokens emitidos para o usuário. */
export async function logoutEverywhere(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
}

/**
 * Gera token de uso único (30 min). A resposta é sempre a mesma, exista ou não o e-mail.
 * Retorna o link apenas quando DEMO_MODE=true (ambiente de demonstração sem SMTP).
 */
export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return { resetUrl: undefined };

  const token = crypto.randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
    },
  });

  const resetUrl = `${env.APP_URL.replace(/\/$/, '')}/redefinir-senha?token=${token}`;
  await sendMail(
    user.email,
    'Recuperação de senha — Nexus Manager',
    `<p>Olá, ${user.name}.</p><p>Para criar uma nova senha, acesse: <a href="${resetUrl}">${resetUrl}</a></p><p>O link expira em ${RESET_TTL_MINUTES} minutos. Se não foi você, ignore este e-mail.</p>`,
  );
  return { resetUrl: env.DEMO_MODE ? resetUrl : undefined };
}

export async function resetPassword(input: z.infer<typeof resetPasswordSchema>) {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(input.token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw badRequest('Link de recuperação inválido ou expirado');
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Invalida outros tokens pendentes do mesmo usuário.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
}

export async function updateProfile(userId: string, input: z.infer<typeof updateProfileSchema>) {
  const other = await prisma.user.findUnique({ where: { email: input.email } });
  if (other && other.id !== userId) throw conflict('Este e-mail já está em uso');
  return prisma.user.update({ where: { id: userId }, data: input, select: publicUser });
}

export async function changePassword(userId: string, input: z.infer<typeof changePasswordSchema>) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw badRequest('Senha atual incorreta');
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS), tokenVersion: { increment: 1 } },
  });
  return signToken(userId, updated.tokenVersion);
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_ROUNDS);

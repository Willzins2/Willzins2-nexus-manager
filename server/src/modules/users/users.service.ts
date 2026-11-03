import type { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { conflict, notFound, unprocessable } from '../../lib/errors';
import type { AuthUser } from '../../middleware/auth';
import { hashPassword, publicUser } from '../auth/auth.service';
import { assertLimit } from '../billing/billing.service';
import { sendMail } from '../../lib/mailer';
import { inviteEmail } from '../../lib/email-templates';

export const options = (orgId: string) =>
  prisma.user.findMany({
    where: { organizationId: orgId, active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

export const list = (orgId: string) =>
  prisma.user.findMany({ where: { organizationId: orgId }, select: publicUser, orderBy: { name: 'asc' } });

export async function create(orgId: string, input: { name: string; email: string; role: Role; password: string }, invitedBy?: string) {
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw conflict('Este e-mail já está cadastrado');
  await assertLimit(orgId, 'users');
  const user = await prisma.user.create({
    data: { organizationId: orgId, name: input.name, email: input.email, role: input.role, passwordHash: await hashPassword(input.password) },
    select: publicUser,
  });
  // A senha nunca vai por e-mail: o convite só avisa e aponta para o login.
  const mail = inviteEmail(user.name, user.organization.name, invitedBy ?? 'O administrador', user.email);
  sendMail(user.email, mail.subject, mail.html).catch((e) => console.error('[mailer] convite', e));
  return user;
}

/** Garante que a organização nunca fique sem um administrador ativo. */
async function assertKeepsAdmin(orgId: string, targetId: string) {
  const admins = await prisma.user.count({ where: { organizationId: orgId, role: 'ADMIN', active: true, id: { not: targetId } } });
  if (admins === 0) throw unprocessable('A empresa precisa de ao menos um administrador ativo');
}

export async function update(actor: AuthUser, id: string, input: { name?: string; role?: Role; active?: boolean; password?: string }) {
  const target = await prisma.user.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!target) throw notFound('Usuário');

  const losesAdmin = target.role === 'ADMIN' && ((input.role && input.role !== 'ADMIN') || input.active === false);
  if (losesAdmin) await assertKeepsAdmin(actor.organizationId, id);

  if (input.active === true && !target.active) await assertLimit(actor.organizationId, 'users');

  const revoke = input.active === false || !!input.password || (input.role && input.role !== target.role);
  return prisma.user.update({
    where: { id },
    data: {
      name: input.name,
      role: input.role,
      active: input.active,
      ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
      // Mudança de papel, senha ou desativação derruba as sessões abertas do usuário.
      ...(revoke ? { tokenVersion: { increment: 1 } } : {}),
    },
    select: publicUser,
  });
}

export async function remove(actor: AuthUser, id: string) {
  if (actor.id === id) throw unprocessable('Você não pode excluir o próprio usuário');
  const target = await prisma.user.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!target) throw notFound('Usuário');
  if (target.role === 'ADMIN') await assertKeepsAdmin(actor.organizationId, id);
  await prisma.user.delete({ where: { id } });
}

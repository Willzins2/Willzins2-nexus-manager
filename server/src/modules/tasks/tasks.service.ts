import type { Prisma, TaskStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { notFound, unprocessable } from '../../lib/errors';

const include = {
  assignee: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

type TaskInput = Partial<{
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate: Date | null;
  assigneeId: string | null;
  customerId: string | null;
}>;

/** Impede referenciar usuário/cliente de outra organização. */
async function checkRefs(orgId: string, data: TaskInput) {
  if (data.assigneeId) {
    const u = await prisma.user.findFirst({ where: { id: data.assigneeId, organizationId: orgId }, select: { id: true } });
    if (!u) throw unprocessable('Responsável não encontrado');
  }
  if (data.customerId) {
    const c = await prisma.customer.findFirst({ where: { id: data.customerId, organizationId: orgId }, select: { id: true } });
    if (!c) throw unprocessable('Cliente não encontrado');
  }
}

export function list(orgId: string, f: { assigneeId?: string; search?: string }) {
  const where: Prisma.TaskWhereInput = { organizationId: orgId };
  if (f.assigneeId) where.assigneeId = f.assigneeId;
  if (f.search) where.title = { contains: f.search, mode: 'insensitive' };
  return prisma.task.findMany({
    where,
    include,
    orderBy: [{ status: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 500,
  });
}

export async function create(orgId: string, userId: string, data: TaskInput & { title: string }) {
  await checkRefs(orgId, data);
  return prisma.task.create({
    data: { ...data, organizationId: orgId, createdById: userId, completedAt: data.status === 'DONE' ? new Date() : null },
    include,
  });
}

export async function update(orgId: string, id: string, data: TaskInput) {
  const task = await prisma.task.findFirst({ where: { id, organizationId: orgId } });
  if (!task) throw notFound('Tarefa');
  await checkRefs(orgId, data);
  const completedAt = data.status === undefined ? undefined : data.status === 'DONE' ? task.completedAt ?? new Date() : null;
  return prisma.task.update({ where: { id }, data: { ...data, completedAt }, include });
}

export async function remove(orgId: string, id: string) {
  const task = await prisma.task.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
  if (!task) throw notFound('Tarefa');
  await prisma.task.delete({ where: { id } });
}

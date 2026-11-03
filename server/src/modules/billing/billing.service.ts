import crypto from 'node:crypto';
import type { BillingCycle, Plan, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError, unprocessable } from '../../lib/errors';
import { env, isProd } from '../../config/env';
import type { AuthUser } from '../../middleware/auth';
import { asaas } from './asaas';
import { addCycle, effectivePlan, PAID_PLANS, PLANS, priceOf, type Feature } from './plans';

const monthStartUtc = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

/** Modo de cobrança em uso: Asaas real ou simulado (sem chave, apenas demo/desenvolvimento). */
export const billingMode = (): 'asaas' | 'simulated' | 'disabled' =>
  asaas.enabled() ? 'asaas' : env.DEMO_MODE || !isProd ? 'simulated' : 'disabled';

export async function getOrgPlan(orgId: string) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
  return { org, plan: effectivePlan(org) };
}

export async function overview(orgId: string) {
  const { org, plan } = await getOrgPlan(orgId);
  const [users, products, salesThisMonth] = await Promise.all([
    prisma.user.count({ where: { organizationId: orgId, active: true } }),
    prisma.product.count({ where: { organizationId: orgId } }),
    prisma.sale.count({ where: { organizationId: orgId, createdAt: { gte: monthStartUtc() } } }),
  ]);
  const trialDaysLeft =
    org.subscriptionStatus === 'TRIALING' && org.trialEndsAt ? Math.max(0, Math.ceil((org.trialEndsAt.getTime() - Date.now()) / 86_400_000)) : null;
  return {
    plan: org.plan,
    effectivePlan: plan,
    status: org.subscriptionStatus,
    cycle: org.billingCycle,
    trialEndsAt: org.trialEndsAt,
    trialDaysLeft,
    currentPeriodEnd: org.currentPeriodEnd,
    pendingPlan: org.pendingPlan,
    features: PLANS[plan].features,
    limits: PLANS[plan].limits,
    usage: { users, products, salesThisMonth },
    mode: billingMode(),
    plans: Object.values(PLANS),
  };
}

/* ---------- Limites e recursos ---------- */

const limitError = (what: string, plan: Plan) =>
  new AppError(402, `Limite do plano ${PLANS[plan].name} atingido: ${what}. Faça upgrade para continuar.`, 'PLAN_LIMIT', { plan });

export async function assertFeature(orgId: string, feature: Feature) {
  const { plan } = await getOrgPlan(orgId);
  if (!PLANS[plan].features.includes(feature)) {
    const label = feature === 'reports' ? 'Relatórios' : 'Quadro de tarefas';
    throw new AppError(402, `${label} não está disponível no plano ${PLANS[plan].name}. Faça upgrade para liberar.`, 'PLAN_FEATURE', { plan, feature });
  }
}

/** Garante que cabem `adding` novos registros no limite do plano. */
export async function assertLimit(orgId: string, kind: 'users' | 'products' | 'salesPerMonth', adding = 1) {
  const { plan } = await getOrgPlan(orgId);
  const max = PLANS[plan].limits[kind];
  if (max === null) return;
  const current =
    kind === 'users'
      ? await prisma.user.count({ where: { organizationId: orgId, active: true } })
      : kind === 'products'
        ? await prisma.product.count({ where: { organizationId: orgId } })
        : await prisma.sale.count({ where: { organizationId: orgId, createdAt: { gte: monthStartUtc() } } });
  if (current + adding > max) {
    const what = { users: `${max} usuário(s) ativo(s)`, products: `${max} produtos`, salesPerMonth: `${max} vendas por mês` }[kind];
    throw limitError(what, plan);
  }
}

/* ---------- Assinatura ---------- */

const digits = (v: string) => v.replace(/\D/g, '');
const today = () => new Date().toISOString().slice(0, 10);

export async function subscribe(user: AuthUser, input: { plan: Plan; cycle: BillingCycle; cpfCnpj?: string }) {
  if (!PAID_PLANS.includes(input.plan)) throw unprocessable('Escolha um plano pago');
  const mode = billingMode();
  if (mode === 'disabled') throw new AppError(503, 'Cobrança ainda não configurada. Fale com o suporte.', 'BILLING_DISABLED');

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
  const value = priceOf(input.plan, input.cycle);
  const description = `Nexus Manager — plano ${PLANS[input.plan].name} (${input.cycle === 'YEARLY' ? 'anual' : 'mensal'})`;

  if (mode === 'simulated') {
    // Sem provedor configurado: ativa na hora, como se o pagamento tivesse sido confirmado.
    await prisma.organization.update({
      where: { id: org.id },
      data: { plan: input.plan, billingCycle: input.cycle, subscriptionStatus: 'ACTIVE', currentPeriodEnd: addCycle(new Date(), input.cycle), pendingPlan: null },
    });
    return { mode, checkoutUrl: null };
  }

  // Já tem assinatura ativa no Asaas: troca de plano/ciclo atualiza a mesma assinatura.
  if (org.billingSubscriptionId && org.subscriptionStatus === 'ACTIVE') {
    await asaas.updateSubscription(org.billingSubscriptionId, { value, cycle: input.cycle, description });
    await prisma.organization.update({ where: { id: org.id }, data: { plan: input.plan, billingCycle: input.cycle } });
    return { mode, checkoutUrl: null };
  }

  let customerId = org.billingCustomerId;
  if (!customerId) {
    const doc = digits(input.cpfCnpj ?? '');
    if (![11, 14].includes(doc.length)) throw unprocessable('Informe um CPF ou CNPJ válido', [{ field: 'cpfCnpj', message: 'CPF (11) ou CNPJ (14 dígitos)' }]);
    customerId = (await asaas.createCustomer({ name: org.name, email: user.email, cpfCnpj: doc, externalReference: org.id })).id;
  }
  const sub = await asaas.createSubscription({ customer: customerId, value, cycle: input.cycle, nextDueDate: today(), description, externalReference: org.id });
  await prisma.organization.update({
    where: { id: org.id },
    data: { billingCustomerId: customerId, billingSubscriptionId: sub.id, pendingPlan: input.plan, billingCycle: input.cycle },
  });
  return { mode, checkoutUrl: await asaas.firstPaymentUrl(sub.id) };
}

/** Cancela a renovação; o plano continua valendo até o fim do período pago. */
export async function cancel(orgId: string) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
  if (org.subscriptionStatus !== 'ACTIVE' && org.subscriptionStatus !== 'PAST_DUE') throw unprocessable('Não há assinatura ativa para cancelar');
  if (org.billingSubscriptionId && asaas.enabled()) await asaas.cancelSubscription(org.billingSubscriptionId);
  await prisma.organization.update({ where: { id: orgId }, data: { subscriptionStatus: 'CANCELED', billingSubscriptionId: null, pendingPlan: null } });
}

/* ---------- Webhook do Asaas ---------- */

export const validWebhookToken = (received?: string) => {
  const expected = env.ASAAS_WEBHOOK_TOKEN;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

interface AsaasEvent {
  id?: string;
  event: string;
  payment?: { id: string; subscription?: string; dueDate?: string };
  subscription?: { id: string };
}

/** Processa um evento do Asaas de forma idempotente (o mesmo evento pode chegar mais de uma vez). */
export async function handleAsaasEvent(evt: AsaasEvent) {
  const subId = evt.payment?.subscription ?? evt.subscription?.id;
  const externalId = evt.id ?? `${evt.event}:${evt.payment?.id ?? subId}`;
  const org = subId ? await prisma.organization.findUnique({ where: { billingSubscriptionId: subId } }) : null;

  try {
    await prisma.billingEvent.create({
      data: { provider: 'asaas', externalId, type: evt.event, organizationId: org?.id, payload: evt as unknown as Prisma.InputJsonValue },
    });
  } catch {
    return { duplicate: true };
  }
  if (!org) return { ignored: true };

  switch (evt.event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED': {
      const base = evt.payment?.dueDate ? new Date(`${evt.payment.dueDate}T12:00:00Z`) : new Date();
      await prisma.organization.update({
        where: { id: org.id },
        data: { subscriptionStatus: 'ACTIVE', plan: org.pendingPlan ?? org.plan, pendingPlan: null, currentPeriodEnd: addCycle(base, org.billingCycle) },
      });
      break;
    }
    case 'PAYMENT_OVERDUE':
      if (org.subscriptionStatus === 'ACTIVE') await prisma.organization.update({ where: { id: org.id }, data: { subscriptionStatus: 'PAST_DUE' } });
      break;
    case 'SUBSCRIPTION_DELETED':
    case 'SUBSCRIPTION_INACTIVATED':
      await prisma.organization.update({ where: { id: org.id }, data: { subscriptionStatus: 'CANCELED', billingSubscriptionId: null } });
      break;
  }
  return { processed: true };
}

import type { BillingCycle, Organization, Plan } from '@prisma/client';

export type Feature = 'reports' | 'tasks';

export interface PlanDef {
  id: Plan;
  name: string;
  description: string;
  monthly: number; // R$/mês
  yearly: number; // R$/ano (≈ 2 meses grátis)
  limits: { users: number | null; products: number | null; salesPerMonth: number | null };
  features: Feature[];
  highlights: string[];
}

/** Catálogo de planos — fonte única para API, cobrança e tela de assinatura. */
export const PLANS: Record<Plan, PlanDef> = {
  FREE: {
    id: 'FREE',
    name: 'Grátis',
    description: 'Para começar a organizar o negócio',
    monthly: 0,
    yearly: 0,
    limits: { users: 1, products: 50, salesPerMonth: 100 },
    features: [],
    highlights: ['1 usuário', 'Até 50 produtos', 'Até 100 vendas por mês', 'Clientes, estoque e dashboard'],
  },
  ESSENTIAL: {
    id: 'ESSENTIAL',
    name: 'Essencial',
    description: 'Para pequenos negócios em crescimento',
    monthly: 59,
    yearly: 590,
    limits: { users: 3, products: null, salesPerMonth: null },
    features: ['reports'],
    highlights: ['Até 3 usuários', 'Produtos e vendas ilimitados', 'Relatórios e exportação CSV', 'Importação por planilha'],
  },
  PRO: {
    id: 'PRO',
    name: 'Profissional',
    description: 'Para equipes que vendem todos os dias',
    monthly: 129,
    yearly: 1290,
    limits: { users: 10, products: null, salesPerMonth: null },
    features: ['reports', 'tasks'],
    highlights: ['Até 10 usuários', 'Tudo do Essencial', 'Quadro de tarefas da equipe', 'Suporte prioritário'],
  },
  BUSINESS: {
    id: 'BUSINESS',
    name: 'Empresa',
    description: 'Para operações maiores',
    monthly: 299,
    yearly: 2990,
    limits: { users: null, products: null, salesPerMonth: null },
    features: ['reports', 'tasks'],
    highlights: ['Usuários ilimitados', 'Tudo do Profissional', 'Treinamento da equipe', 'Atendimento dedicado'],
  },
};

export const PAID_PLANS: Plan[] = ['ESSENTIAL', 'PRO', 'BUSINESS'];
export const PAST_DUE_GRACE_DAYS = 7;

export const priceOf = (plan: Plan, cycle: BillingCycle) => (cycle === 'YEARLY' ? PLANS[plan].yearly : PLANS[plan].monthly);

type OrgBilling = Pick<Organization, 'plan' | 'subscriptionStatus' | 'trialEndsAt' | 'currentPeriodEnd'>;

/**
 * Plano que vale AGORA, considerando teste, atraso e cancelamento.
 * Nunca bloqueia o acesso aos dados: no pior caso a empresa cai para o plano Grátis.
 */
export function effectivePlan(org: OrgBilling, now = new Date()): Plan {
  switch (org.subscriptionStatus) {
    case 'TRIALING':
      return org.trialEndsAt && org.trialEndsAt > now ? 'PRO' : 'FREE';
    case 'ACTIVE':
      return org.plan;
    case 'PAST_DUE': {
      const graceEnd = org.currentPeriodEnd ? org.currentPeriodEnd.getTime() + PAST_DUE_GRACE_DAYS * 86_400_000 : 0;
      return graceEnd > now.getTime() ? org.plan : 'FREE';
    }
    case 'CANCELED':
      return org.currentPeriodEnd && org.currentPeriodEnd > now ? org.plan : 'FREE';
  }
}

export const addCycle = (from: Date, cycle: BillingCycle) => {
  const d = new Date(from);
  if (cycle === 'YEARLY') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
};

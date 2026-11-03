import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from '../auth/AuthContext';

export type PlanId = 'FREE' | 'ESSENTIAL' | 'PRO' | 'BUSINESS';
export type Feature = 'reports' | 'tasks';

export interface PlanDef {
  id: PlanId;
  name: string;
  description: string;
  monthly: number;
  yearly: number;
  limits: { users: number | null; products: number | null; salesPerMonth: number | null };
  features: Feature[];
  highlights: string[];
}

export interface Billing {
  plan: PlanId;
  effectivePlan: PlanId;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  cycle: 'MONTHLY' | 'YEARLY';
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  currentPeriodEnd: string | null;
  pendingPlan: PlanId | null;
  features: Feature[];
  limits: PlanDef['limits'];
  usage: { users: number; products: number; salesThisMonth: number };
  mode: 'asaas' | 'simulated' | 'disabled';
  plans: PlanDef[];
}

export const featureLabel: Record<Feature, string> = { reports: 'Relatórios', tasks: 'Quadro de tarefas' };

export function useBilling() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['billing'], queryFn: () => api.get<Billing>('/billing'), enabled: !!user, staleTime: 60_000 });
  return {
    ...q,
    has: (f: Feature) => (q.data ? q.data.features.includes(f) : true), // otimista enquanto carrega; a API valida de verdade
  };
}

/** Plano mais barato que libera o recurso. */
export const planFor = (plans: PlanDef[], f: Feature) => plans.find((p) => p.features.includes(f));

import { env } from '../../config/env';
import { AppError } from '../../lib/errors';

/** Cliente mínimo da API v3 do Asaas (https://docs.asaas.com). */
const BASE = env.ASAAS_ENV === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', access_token: env.ASAAS_API_KEY ?? '', 'User-Agent': 'nexus-manager' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { errors?: { description: string }[] } & T;
  if (!res.ok) {
    const msg = data.errors?.map((e) => e.description).join('; ') || `Erro ${res.status} no provedor de pagamento`;
    throw new AppError(502, msg, 'BILLING_PROVIDER_ERROR');
  }
  return data;
}

export const asaas = {
  enabled: () => !!env.ASAAS_API_KEY,

  createCustomer: (input: { name: string; email: string; cpfCnpj: string; externalReference: string }) =>
    call<{ id: string }>('POST', '/customers', input),

  createSubscription: (input: {
    customer: string;
    value: number;
    cycle: 'MONTHLY' | 'YEARLY';
    nextDueDate: string;
    description: string;
    externalReference: string;
  }) => call<{ id: string }>('POST', '/subscriptions', { ...input, billingType: 'UNDEFINED' }), // cliente escolhe Pix, boleto ou cartão

  updateSubscription: (id: string, input: { value: number; cycle: 'MONTHLY' | 'YEARLY'; description: string }) =>
    call<{ id: string }>('POST', `/subscriptions/${id}`, { ...input, updatePendingPayments: true }),

  firstPaymentUrl: async (subscriptionId: string) => {
    const r = await call<{ data: { invoiceUrl: string; status: string }[] }>('GET', `/subscriptions/${subscriptionId}/payments`);
    return r.data.find((p) => p.status === 'PENDING' || p.status === 'OVERDUE')?.invoiceUrl ?? r.data[0]?.invoiceUrl ?? null;
  },

  cancelSubscription: (id: string) => call<{ deleted: boolean }>('DELETE', `/subscriptions/${id}`),
};

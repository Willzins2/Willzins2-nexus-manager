import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, CreditCard, ExternalLink, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useBilling, type Billing as BillingData, type PlanDef, type PlanId } from '../lib/billing';
import { ConfirmDialog, ErrorState, Field, Input, Modal, PageHeader, PageLoader, Spinner, Badge, cn } from '../components/ui';
import { date, int, money } from '../lib/format';
import { errorMessage, toastError } from '../lib/forms';

type Cycle = 'MONTHLY' | 'YEARLY';

const statusInfo: Record<BillingData['status'], { label: string; tone: 'blue' | 'green' | 'red' | 'amber' }> = {
  TRIALING: { label: 'Em teste', tone: 'blue' },
  ACTIVE: { label: 'Ativa', tone: 'green' },
  PAST_DUE: { label: 'Pagamento atrasado', tone: 'red' },
  CANCELED: { label: 'Cancelada', tone: 'amber' },
};

function Meter({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max ? Math.min(100, (used / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span className="text-slate-600">{label}</span><span className="font-medium text-slate-900 num">{int(used)}{max ? ` / ${int(max)}` : ' · ilimitado'}</span></div>
      <div className="h-2 rounded-full bg-slate-100">{max !== null && <div className={cn('h-2 rounded-full', pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-brand-600')} style={{ width: `${Math.max(pct, 2)}%` }} />}</div>
    </div>
  );
}

function PlanCard({ plan, cycle, current, onChoose }: { plan: PlanDef; cycle: Cycle; current: boolean; onChoose: () => void }) {
  const price = cycle === 'YEARLY' ? plan.yearly / 12 : plan.monthly;
  const featured = plan.id === 'PRO';
  return (
    <div className={cn('card relative flex flex-col p-5', featured && 'ring-2 ring-brand-500')}>
      {featured && <span className="absolute -top-3 left-5 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">Mais escolhido</span>}
      <h3 className="font-semibold text-slate-900">{plan.name}</h3>
      <p className="mt-0.5 text-sm text-slate-500">{plan.description}</p>
      <p className="mt-4">
        <span className="text-3xl font-semibold tracking-tight text-slate-900 num">{money(price).replace(',00', '')}</span>
        <span className="text-sm text-slate-500">/mês</span>
      </p>
      <p className="h-5 text-xs text-slate-500">{plan.monthly > 0 && cycle === 'YEARLY' ? `${money(plan.yearly)} cobrados por ano` : plan.monthly === 0 ? 'Para sempre' : 'Cobrado mensalmente'}</p>
      <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
        {plan.highlights.map((h) => <li key={h} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{h}</li>)}
      </ul>
      {plan.id === 'FREE' ? (
        <p className="mt-5 text-center text-xs text-slate-500">{current ? 'Seu plano atual' : 'Ao fim do teste ou cancelamento'}</p>
      ) : (
        <button className={cn('mt-5 w-full', current ? 'btn-secondary' : featured ? 'btn-primary' : 'btn-secondary')} disabled={current} onClick={onChoose}>
          {current ? 'Plano atual' : 'Assinar'}
        </button>
      )}
    </div>
  );
}

export default function Billing() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useBilling();
  const [cycle, setCycle] = useState<Cycle>('MONTHLY');
  const [choosing, setChoosing] = useState<PlanDef | null>(null);
  const [doc, setDoc] = useState('');
  const [docError, setDocError] = useState<string>();
  const [canceling, setCanceling] = useState(false);

  const subscribe = useMutation({
    mutationFn: (plan: PlanId) => api.post<{ mode: string; checkoutUrl: string | null }>('/billing/subscribe', { plan, cycle, cpfCnpj: doc || undefined }),
    onSuccess: (r) => {
      qc.invalidateQueries();
      setChoosing(null);
      if (r.checkoutUrl) {
        toast.success('Assinatura criada. Abrimos a página de pagamento (Pix, boleto ou cartão).');
        window.open(r.checkoutUrl, '_blank', 'noopener');
      } else toast.success(r.mode === 'simulated' ? 'Plano ativado (modo demonstração, sem cobrança real).' : 'Plano atualizado.');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.details?.some((d) => d.field === 'cpfCnpj')) setDocError(e.details.find((d) => d.field === 'cpfCnpj')!.message);
      toastError(e);
    },
  });
  const cancel = useMutation({
    mutationFn: () => api.post('/billing/cancel'),
    onSuccess: () => { qc.invalidateQueries(); setCanceling(false); toast.success('Renovação cancelada.'); },
    onError: toastError,
  });

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  const current = data.plans.find((p) => p.id === data.effectivePlan)!;
  const st = statusInfo[data.status];
  const isCurrent = (p: PlanDef) => p.id === data.effectivePlan && (data.status === 'ACTIVE' || p.id === 'FREE') && (p.id === 'FREE' || data.cycle === cycle);
  const needsDoc = data.mode === 'asaas' && !(data.status === 'ACTIVE');

  return (
    <>
      <PageHeader title="Assinatura" subtitle="Seu plano, uso e cobrança." />

      {data.mode === 'simulated' && (
        <div className="mb-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Modo demonstração:</strong> nenhum pagamento real é feito. Com a chave do Asaas configurada, a assinatura gera a cobrança por Pix, boleto ou cartão.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Plano atual</p>
              <p className="mt-0.5 text-2xl font-semibold text-slate-900">{current.name}</p>
            </div>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {data.status === 'TRIALING' && data.effectivePlan === 'PRO' && <>Teste grátis até <strong>{date(data.trialEndsAt)}</strong> ({data.trialDaysLeft} dia(s)). Depois disso, a conta passa para o plano Grátis se nenhum plano for escolhido. Nenhum dado é apagado.</>}
            {data.status === 'TRIALING' && data.effectivePlan === 'FREE' && <>O teste terminou em {date(data.trialEndsAt)}. Assine para voltar a ter relatórios, tarefas e mais usuários.</>}
            {data.status === 'ACTIVE' && <>Renova em <strong>{date(data.currentPeriodEnd)}</strong> ({data.cycle === 'YEARLY' ? 'anual' : 'mensal'}).</>}
            {data.status === 'PAST_DUE' && <>O último pagamento está em aberto. Os recursos continuam por até 7 dias após o vencimento.</>}
            {data.status === 'CANCELED' && <>Cancelada. {data.effectivePlan !== 'FREE' ? `Os recursos seguem até ${date(data.currentPeriodEnd)}.` : 'A conta está no plano Grátis.'}</>}
            {data.pendingPlan && <> Aguardando o primeiro pagamento do plano {data.plans.find((p) => p.id === data.pendingPlan)?.name}.</>}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Meter label="Usuários ativos" used={data.usage.users} max={data.limits.users} />
            <Meter label="Produtos" used={data.usage.products} max={data.limits.products} />
            <Meter label="Vendas no mês" used={data.usage.salesThisMonth} max={data.limits.salesPerMonth} />
          </div>
          {(data.status === 'ACTIVE' || data.status === 'PAST_DUE') && (
            <button className="btn-ghost mt-5 -ml-3 text-rose-600" onClick={() => setCanceling(true)}>Cancelar renovação</button>
          )}
        </section>
        <section className="card h-fit p-5 text-sm text-slate-600">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="h-4 w-4 text-brand-600" /> Pagamento seguro</h2>
          <p>Cobrança processada pelo Asaas. Você escolhe <strong>Pix, boleto ou cartão</strong> na página de pagamento, e o plano é liberado assim que o pagamento é confirmado.</p>
          <p className="mt-2">Sem fidelidade: cancele quando quiser e continue usando até o fim do período pago.</p>
        </section>
      </div>

      <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Planos</h2>
        <div className="flex rounded-lg bg-slate-100 p-1 text-sm font-medium" role="radiogroup" aria-label="Ciclo de cobrança">
          {(['MONTHLY', 'YEARLY'] as Cycle[]).map((c) => (
            <button key={c} role="radio" aria-checked={cycle === c} onClick={() => setCycle(c)} className={cn('rounded-md px-3 py-1.5 transition', cycle === c ? 'bg-surface text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')}>
              {c === 'MONTHLY' ? 'Mensal' : <>Anual <span className="text-emerald-600">· 2 meses grátis</span></>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.plans.map((p) => <PlanCard key={p.id} plan={p} cycle={cycle} current={isCurrent(p)} onChoose={() => { setDocError(undefined); setChoosing(p); }} />)}
      </div>

      <Modal open={!!choosing} onClose={() => setChoosing(null)} title={`Assinar o plano ${choosing?.name ?? ''}`} size="sm"
        footer={<>
          <button className="btn-secondary" onClick={() => setChoosing(null)}>Voltar</button>
          <button className="btn-primary" disabled={subscribe.isPending} onClick={() => choosing && subscribe.mutate(choosing.id)}>
            {subscribe.isPending ? <Spinner /> : data.mode === 'asaas' ? <ExternalLink className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />} {data.mode === 'asaas' ? 'Ir para o pagamento' : 'Confirmar'}
          </button>
        </>}>
        {choosing && (
          <div className="space-y-4 text-sm">
            <div className="flex items-baseline justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-slate-600">{choosing.name} · {cycle === 'YEARLY' ? 'anual' : 'mensal'}</span>
              <span className="text-lg font-semibold text-slate-900 num">{money(cycle === 'YEARLY' ? choosing.yearly : choosing.monthly)}</span>
            </div>
            {needsDoc && (
              <Field label="CPF ou CNPJ do responsável" error={docError} hint="Exigido pelo Asaas para emitir a cobrança.">
                <Input inputMode="numeric" value={doc} onChange={(e) => setDoc(e.target.value)} invalid={!!docError} autoFocus />
              </Field>
            )}
            <p className="text-slate-500">{data.status === 'ACTIVE' ? 'A troca vale a partir de agora; o valor novo entra na próxima cobrança.' : 'O plano é liberado assim que o pagamento for confirmado.'}</p>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={canceling} onClose={() => setCanceling(false)} danger loading={cancel.isPending} confirmLabel="Cancelar renovação" title="Cancelar assinatura"
        message={<>A cobrança não será renovada. Você continua com o plano {current.name} até {date(data.currentPeriodEnd)} e depois passa para o Grátis. Nenhum dado é apagado.</>}
        onConfirm={() => cancel.mutate()} />
    </>
  );
}

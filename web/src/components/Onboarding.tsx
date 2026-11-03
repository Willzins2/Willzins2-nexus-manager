import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, FileSpreadsheet, Package, Rocket, ShoppingCart, UserPlus, Users, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { cn } from './ui';

interface Onboarding {
  dismissed: boolean;
  completed: boolean;
  steps: { id: 'product' | 'customer' | 'sale' | 'team'; done: boolean; optional?: boolean }[];
}

const meta = {
  product: { icon: Package, title: 'Cadastre seus produtos', text: 'Preço, custo e estoque de cada item.', to: '/produtos?novo=1', cta: 'Cadastrar produto', alt: { to: '/produtos?importar=1', label: 'ou importar planilha' } },
  customer: { icon: Users, title: 'Cadastre seus clientes', text: 'Contatos e histórico de compras em um lugar.', to: '/clientes?novo=1', cta: 'Cadastrar cliente', alt: { to: '/clientes?importar=1', label: 'ou importar planilha' } },
  sale: { icon: ShoppingCart, title: 'Registre a primeira venda', text: 'O estoque baixa e o dashboard se atualiza na hora.', to: '/vendas/nova', cta: 'Nova venda' },
  team: { icon: UserPlus, title: 'Convide sua equipe', text: 'Cada pessoa com o acesso certo.', to: '/usuarios', cta: 'Convidar' },
} as const;

/** Guia de primeiros passos no dashboard. Some sozinho ao concluir os 3 passos ou quando dispensado. */
export function OnboardingCard() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['onboarding'], queryFn: () => api.get<Onboarding>('/onboarding') });
  const dismiss = useMutation({ mutationFn: () => api.post('/onboarding/dismiss'), onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }) });

  if (!data || data.dismissed || data.completed) return null;
  const steps = data.steps.filter((s) => s.id !== 'team' || can('ADMIN'));
  const required = steps.filter((s) => !s.optional);
  const done = required.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <section className="card mb-6 overflow-hidden" aria-label="Primeiros passos">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-brand-50 to-transparent px-5 py-4">
        <div className="flex gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-600 text-white"><Rocket className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold text-slate-900">Boas-vindas, {user?.name.split(' ')[0]}! Vamos deixar tudo pronto</h2>
            <p className="text-sm text-slate-600">{done} de {required.length} passos concluídos. Leva uns 5 minutos.</p>
          </div>
        </div>
        {can('ADMIN', 'MANAGER') && (
          <button className="btn-icon btn-ghost -mr-2 -mt-1" onClick={() => dismiss.mutate()} aria-label="Dispensar primeiros passos" title="Dispensar"><X className="h-4 w-4" /></button>
        )}
      </div>
      <div className="h-1 bg-slate-100"><div className="h-1 bg-brand-600 transition-all" style={{ width: `${(done / required.length) * 100}%` }} /></div>
      <ol className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => {
          const m = meta[s.id];
          const isNext = next?.id === s.id;
          return (
            <li key={s.id} className={cn('flex flex-col bg-surface p-4', s.done && 'opacity-70')}>
              <div className="flex items-center gap-2">
                {s.done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Concluído" /> : <Circle className={cn('h-5 w-5', isNext ? 'text-brand-500' : 'text-slate-300')} aria-label="Pendente" />}
                <m.icon className="h-4 w-4 text-slate-400" />
                {'optional' in s && s.optional && <span className="text-xs text-slate-400">opcional</span>}
              </div>
              <p className={cn('mt-2 font-medium text-slate-900', s.done && 'line-through')}>{m.title}</p>
              <p className="mt-0.5 flex-1 text-sm text-slate-500">{m.text}</p>
              {!s.done && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link to={m.to} className={cn(isNext ? 'btn-primary' : 'btn-secondary', 'px-3 py-1.5 text-xs')}>{m.cta}</Link>
                  {'alt' in m && <Link to={m.alt.to} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"><FileSpreadsheet className="h-3.5 w-3.5" />{m.alt.label}</Link>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

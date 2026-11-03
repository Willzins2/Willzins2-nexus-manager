import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { featureLabel, planFor, useBilling, type Feature } from '../lib/billing';
import { PageLoader } from './ui';

export function UpgradeState({ feature }: { feature: Feature }) {
  const { data } = useBilling();
  const plan = data ? planFor(data.plans, feature) : undefined;
  return (
    <div className="card mx-auto mt-6 max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600"><Lock className="h-5 w-5" /></div>
      <h1 className="text-lg font-semibold text-slate-900">{featureLabel[feature]} não está no seu plano</h1>
      <p className="mt-2 text-sm text-slate-500">
        {plan ? <>Disponível a partir do plano <strong className="text-slate-700">{plan.name}</strong> (R$ {plan.monthly}/mês).</> : 'Faça upgrade para liberar este recurso.'}{' '}
        Seus dados continuam salvos.
      </p>
      <Link to="/assinatura" className="btn-primary mt-6"><Sparkles className="h-4 w-4" /> Ver planos</Link>
    </div>
  );
}

/** Mostra a página só se o plano incluir o recurso; senão, um convite para upgrade. */
export function FeatureGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { data, isLoading } = useBilling();
  if (isLoading) return <PageLoader />;
  if (data && !data.features.includes(feature)) return <UpgradeState feature={feature} />;
  return <>{children}</>;
}

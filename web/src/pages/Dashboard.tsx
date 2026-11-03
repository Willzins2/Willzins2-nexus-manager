import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckSquare, DollarSign, Plus, Receipt, ShoppingCart, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { BarList, RevenueArea } from '../components/charts';
import { SaleStatusBadge } from '../components/badges';
import { OnboardingCard } from '../components/Onboarding';
import { ErrorState, PageHeader, PageLoader, StatCard } from '../components/ui';
import { dateTime, int, money, paymentLabel, shortDay } from '../lib/format';
import { errorMessage } from '../lib/forms';
import type { PaymentMethod, SaleStatus } from '../lib/types';

interface DashboardData {
  kpis: {
    revenueMonth: number; revenueGrowth: number | null; grossProfitMonth: number; salesMonth: number; salesGrowth: number | null;
    averageTicket: number; customers: number; newCustomersMonth: number; lowStock: number; openTasks: number; pendingAmount: number; pendingCount: number;
  };
  salesByDay: { date: string; revenue: number; count: number }[];
  topProducts: { productId: string; name: string; quantity: number; revenue: number }[];
  byPaymentMethod: { method: PaymentMethod; total: number; count: number }[];
  recentSales: { id: string; number: number; total: number; status: SaleStatus; createdAt: string; customer: { name: string } | null }[];
  lowStockProducts: { id: string; name: string; sku: string; stock: number; minStock: number }[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardData>('/dashboard') });

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;
  const k = data.kpis;
  const total30 = data.salesByDay.reduce((a, d) => a + d.revenue, 0);

  return (
    <>
      <PageHeader
        title={`Olá, ${user?.name.split(' ')[0]}`}
        subtitle="Resumo do mês atual. Comparações com o mesmo período do mês anterior."
        actions={<Link to="/vendas/nova" className="btn-primary"><Plus className="h-4 w-4" /> Nova venda</Link>}
      />

      <OnboardingCard />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Faturamento no mês" value={money(k.revenueMonth)} icon={DollarSign} trend={k.revenueGrowth} hint={<span>lucro bruto {money(k.grossProfitMonth)}</span>} />
        <StatCard label="Vendas no mês" value={int(k.salesMonth)} icon={ShoppingCart} tone="violet" trend={k.salesGrowth} hint={<span>ticket médio {money(k.averageTicket)}</span>} />
        <StatCard label="Clientes" value={int(k.customers)} icon={Users} tone="green" hint={<span>+{k.newCustomersMonth} novos este mês</span>} />
        <StatCard label="A receber" value={money(k.pendingAmount)} icon={Receipt} tone="amber" hint={<span>{k.pendingCount} venda(s) pendente(s)</span>} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Faturamento diário</h2>
              <p className="text-sm text-slate-500">Vendas pagas nos últimos 30 dias</p>
            </div>
            <p className="text-lg font-semibold text-slate-900 num">{money(total30)}</p>
          </div>
          <RevenueArea data={data.salesByDay} x="date" y="revenue" xFormat={shortDay} extra={{ key: 'count', label: 'Vendas', format: (v) => int(v) }} />
        </section>

        <section className="card p-5">
          <h2 className="font-semibold text-slate-900">Mais vendidos</h2>
          <p className="mb-4 text-sm text-slate-500">Por faturamento, últimos 30 dias</p>
          <BarList items={data.topProducts.map((p) => ({ label: p.name, value: p.revenue, sub: `${int(p.quantity)} un.` }))} format={money} />
        </section>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-semibold text-slate-900">Últimas vendas</h2>
            <Link to="/vendas" className="text-sm font-medium text-brand-600 hover:text-brand-700">Ver todas</Link>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Venda</th><th>Cliente</th><th className="hidden sm:table-cell">Data</th><th>Status</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {data.recentSales.map((s) => (
                  <tr key={s.id}>
                    <td><Link to={`/vendas/${s.id}`} className="font-medium text-brand-700 hover:underline">#{s.number}</Link></td>
                    <td className="max-w-[160px] truncate">{s.customer?.name ?? <span className="text-slate-400">Consumidor final</span>}</td>
                    <td className="hidden text-slate-500 sm:table-cell">{dateTime(s.createdAt)}</td>
                    <td><SaleStatusBadge status={s.status} /></td>
                    <td className="text-right font-medium num">{money(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.recentSales.length && <p className="p-6 text-center text-sm text-slate-500">Nenhuma venda registrada ainda.</p>}
          </div>
        </section>

        <div className="space-y-4">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Estoque baixo
              </h2>
              <span className="text-sm text-slate-500">{k.lowStock} item(ns)</span>
            </div>
            {data.lowStockProducts.length ? (
              <ul className="divide-y divide-slate-100">
                {data.lowStockProducts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.sku} · mínimo {p.minStock}</p>
                    </div>
                    <span className={`shrink-0 font-semibold num ${p.stock <= 0 ? 'text-rose-600' : 'text-amber-600'}`}>{p.stock} un.</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Tudo certo com o estoque.</p>
            )}
            <Link to="/produtos?stock=low" className="mt-2 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">Ver produtos</Link>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Formas de pagamento</h2>
            <BarList items={data.byPaymentMethod.sort((a, b) => b.total - a.total).map((p) => ({ label: paymentLabel[p.method], value: p.total }))} format={money} />
          </section>

          <Link to="/tarefas" className="card flex items-center gap-3 p-4 transition hover:border-brand-200">
            <div className="rounded-lg bg-violet-50 p-2 text-violet-600"><CheckSquare className="h-5 w-5" /></div>
            <div><p className="font-medium text-slate-900">{k.openTasks} tarefa(s) em aberto</p><p className="text-sm text-slate-500">Ver quadro da equipe</p></div>
          </Link>
        </div>
      </div>
    </>
  );
}

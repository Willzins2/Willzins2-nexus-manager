import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '../lib/api';
import { BarList, GroupedBars } from '../components/charts';
import { ErrorState, Input, PageHeader, PageLoader, cn } from '../components/ui';
import { int, isoDay, money, monthLabel, paymentLabel, percent } from '../lib/format';
import { errorMessage } from '../lib/forms';
import type { PaymentMethod } from '../lib/types';

interface Summary {
  totals: { revenue: number; cost: number; grossProfit: number; margin: number; discounts: number; salesCount: number; averageTicket: number; canceledCount: number; canceledAmount: number; pendingCount: number; pendingAmount: number };
  byMonth: { month: string; revenue: number; profit: number; count: number }[];
  byProduct: { productId: string; name: string; sku: string; quantity: number; revenue: number; profit: number }[];
  bySeller: { userId: string; name: string; revenue: number; count: number }[];
  byCustomer: { customerId: string; name: string; revenue: number; count: number }[];
  byPaymentMethod: { method: PaymentMethod; revenue: number; count: number }[];
  byCategory: { category: string; revenue: number; quantity: number }[];
}

const presets = [
  { label: 'Este mês', range: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth(), 1), d]; } },
  { label: '3 meses', range: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth() - 2, 1), d]; } },
  { label: '6 meses', range: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth() - 5, 1), d]; } },
  { label: '12 meses', range: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth() - 11, 1), d]; } },
];
const localIso = (d: Date) => isoDay(new Date(d.getTime() - d.getTimezoneOffset() * 60000));

export default function Reports() {
  const [[from, to], setRange] = useState(() => presets[2].range().map(localIso));
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['reports', from, to],
    queryFn: () => api.get<Summary>('/reports/summary', { from, to }),
    placeholderData: keepPreviousData,
  });

  const activePreset = presets.findIndex((p) => p.range().map(localIso).join() === [from, to].join());
  const t = data?.totals;

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Resumo de desempenho do período (vendas pagas)."
        actions={<a className="btn-secondary" href={api.url('/reports/sales.csv', { from, to })}><Download className="h-4 w-4" /> Exportar CSV</a>} />

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {presets.map((p, i) => (
            <button key={p.label} onClick={() => setRange(p.range().map(localIso))}
              className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition', i === activePreset ? 'bg-surface text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')}>{p.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setRange([e.target.value, to])} aria-label="Data inicial" className="w-auto" />
          <span className="text-slate-400">até</span>
          <Input type="date" value={to} min={from} onChange={(e) => e.target.value && setRange([from, e.target.value])} aria-label="Data final" className="w-auto" />
        </div>
      </div>

      {isLoading ? <PageLoader /> : error || !data || !t ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : (
        <div className={cn('space-y-4 transition-opacity', isFetching && 'opacity-60')}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { l: 'Faturamento', v: money(t.revenue), s: `${int(t.salesCount)} vendas` },
              { l: 'Lucro bruto', v: money(t.grossProfit), s: `margem ${percent(t.margin)}` },
              { l: 'Ticket médio', v: money(t.averageTicket), s: `descontos ${money(t.discounts)}` },
              { l: 'Custo das vendas', v: money(t.cost), s: `${t.canceledCount} canceladas (${money(t.canceledAmount)})` },
            ].map((k) => (
              <div key={k.l} className="card p-4"><p className="text-sm text-slate-500">{k.l}</p><p className="mt-1 text-xl font-semibold text-slate-900 num sm:text-2xl">{k.v}</p><p className="mt-1 text-xs text-slate-500">{k.s}</p></div>
            ))}
          </div>

          <section className="card p-5">
            <h2 className="font-semibold text-slate-900">Faturamento e lucro por mês</h2>
            <p className="mb-4 text-sm text-slate-500">Valores em reais, mesmo eixo</p>
            {data.byMonth.length ? <GroupedBars data={data.byMonth} x="month" xFormat={monthLabel} series={[{ key: 'revenue', label: 'Faturamento' }, { key: 'profit', label: 'Lucro bruto' }]} />
              : <p className="py-10 text-center text-sm text-slate-500">Sem vendas no período.</p>}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card">
              <h2 className="px-5 pt-5 font-semibold text-slate-900">Produtos mais vendidos</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Produto</th><th className="text-right">Qtd.</th><th className="text-right">Faturamento</th><th className="hidden sm:table-cell text-right">Lucro</th></tr></thead>
                  <tbody>
                    {data.byProduct.map((p) => (
                      <tr key={p.productId}><td><p className="font-medium text-slate-900">{p.name}</p><p className="text-xs text-slate-500">{p.sku}</p></td><td className="text-right num">{int(p.quantity)}</td><td className="text-right num">{money(p.revenue)}</td><td className="hidden sm:table-cell text-right text-emerald-700 num">{money(p.profit)}</td></tr>
                    ))}
                  </tbody>
                </table>
                {!data.byProduct.length && <p className="p-6 text-center text-sm text-slate-500">Sem dados.</p>}
              </div>
            </section>
            <section className="card">
              <h2 className="px-5 pt-5 font-semibold text-slate-900">Melhores clientes</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Cliente</th><th className="text-right">Compras</th><th className="text-right">Total</th></tr></thead>
                  <tbody>{data.byCustomer.map((c) => <tr key={c.customerId}><td className="font-medium text-slate-900">{c.name}</td><td className="text-right num">{c.count}</td><td className="text-right num">{money(c.revenue)}</td></tr>)}</tbody>
                </table>
                {!data.byCustomer.length && <p className="p-6 text-center text-sm text-slate-500">Sem dados.</p>}
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="card p-5"><h2 className="mb-4 font-semibold text-slate-900">Por vendedor</h2><BarList items={data.bySeller.map((s) => ({ label: s.name, value: s.revenue, sub: `${s.count} vendas` }))} format={money} /></section>
            <section className="card p-5"><h2 className="mb-4 font-semibold text-slate-900">Por categoria</h2><BarList items={data.byCategory.map((c) => ({ label: c.category, value: c.revenue, sub: `${int(c.quantity)} un.` }))} format={money} /></section>
            <section className="card p-5"><h2 className="mb-4 font-semibold text-slate-900">Por forma de pagamento</h2><BarList items={data.byPaymentMethod.map((p) => ({ label: paymentLabel[p.method], value: p.revenue, sub: `${p.count} vendas` }))} format={money} /></section>
          </div>
        </div>
      )}
    </>
  );
}

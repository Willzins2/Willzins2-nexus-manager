import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, ShoppingCart } from 'lucide-react';
import { api } from '../lib/api';
import { SaleStatusBadge } from '../components/badges';
import { EmptyState, ErrorState, Input, PageHeader, PageLoader, Pagination, SearchInput, Select } from '../components/ui';
import { dateTime, money, paymentLabel } from '../lib/format';
import { errorMessage } from '../lib/forms';
import { useListState } from '../lib/useList';
import type { Paged, Sale } from '../lib/types';

export default function Sales() {
  const { search, setSearch, debounced, page, setPage } = useListState();
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sales', { page, search: debounced, status, from, to }],
    queryFn: () => api.get<Paged<Sale> & { summary: { total: number } }>('/sales', { page, search: debounced, status, from, to, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });
  const filtered = !!(debounced || status || from || to);

  return (
    <>
      <PageHeader title="Vendas" subtitle="Registro e acompanhamento das vendas."
        actions={<Link to="/vendas/nova" className="btn-primary"><Plus className="h-4 w-4" /> Nova venda</Link>} />

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Nº da venda ou cliente..." />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex">
            <Select className="col-span-2 sm:col-span-1 lg:w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
              <option value="">Todos os status</option>
              <option value="PAID">Pagas</option>
              <option value="PENDING">Pendentes</option>
              <option value="CANCELED">Canceladas</option>
            </Select>
            <Input type="date" className="lg:w-40" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="De" />
            <Input type="date" className="lg:w-40" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="Até" />
          </div>
          {data && <p className="text-sm text-slate-500 lg:ml-auto">Total (exceto canceladas): <strong className="text-slate-900 num">{money(data.summary.total)}</strong></p>}
        </div>

        {isLoading ? <PageLoader /> : error ? <div className="p-4"><ErrorState message={errorMessage(error)} onRetry={refetch} /></div> : !data?.data.length ? (
          <EmptyState icon={ShoppingCart} title={filtered ? 'Nenhuma venda encontrada' : 'Nenhuma venda ainda'} text={filtered ? 'Ajuste os filtros.' : 'Registre sua primeira venda.'}
            action={!filtered && <Link to="/vendas/nova" className="btn-primary"><Plus className="h-4 w-4" /> Nova venda</Link>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Venda</th><th>Cliente</th><th className="hidden md:table-cell">Data</th><th className="hidden lg:table-cell">Pagamento</th><th className="hidden lg:table-cell">Vendedor</th><th>Status</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {data.data.map((s) => (
                    <tr key={s.id}>
                      <td><Link to={`/vendas/${s.id}`} className="font-medium text-brand-700 hover:underline">#{s.number}</Link><p className="text-xs text-slate-500 md:hidden">{dateTime(s.createdAt)}</p></td>
                      <td className="max-w-[180px] truncate">{s.customer?.name ?? <span className="text-slate-400">Consumidor final</span>}</td>
                      <td className="hidden md:table-cell whitespace-nowrap text-slate-500">{dateTime(s.createdAt)}</td>
                      <td className="hidden lg:table-cell text-slate-600">{paymentLabel[s.paymentMethod]}</td>
                      <td className="hidden lg:table-cell text-slate-600">{s.user?.name ?? '—'}</td>
                      <td><SaleStatusBadge status={s.status} /></td>
                      <td className="text-right font-medium num">{money(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={setPage} />
          </>
        )}
      </div>
    </>
  );
}

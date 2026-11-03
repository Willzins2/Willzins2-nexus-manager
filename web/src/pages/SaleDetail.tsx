import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Printer, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { SaleStatusBadge } from '../components/badges';
import { ConfirmDialog, ErrorState, PageLoader } from '../components/ui';
import { dateTime, money, paymentLabel } from '../lib/format';
import { errorMessage } from '../lib/forms';
import type { Sale } from '../lib/types';

export default function SaleDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<'PAID' | 'CANCELED' | null>(null);
  const { data: sale, isLoading, error, refetch } = useQuery({ queryKey: ['sales', id], queryFn: () => api.get<Sale>(`/sales/${id}`) });

  const mut = useMutation({
    mutationFn: (status: 'PAID' | 'CANCELED') => api.patch<Sale>(`/sales/${id}/status`, { status }),
    onSuccess: (s) => {
      toast.success(s.status === 'PAID' ? 'Pagamento confirmado' : 'Venda cancelada e estoque devolvido');
      qc.setQueryData(['sales', id], s);
      ['sales', 'products', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setConfirm(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  if (error || !sale) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  return (
    <>
      <Link to="/vendas" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 print:hidden"><ArrowLeft className="h-4 w-4" /> Vendas</Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Venda #{sale.number}</h1>
          <SaleStatusBadge status={sale.status} />
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir</button>
          {sale.status === 'PENDING' && <button className="btn-primary" onClick={() => setConfirm('PAID')}><CheckCircle2 className="h-4 w-4" /> Confirmar pagamento</button>}
          {sale.status !== 'CANCELED' && can('ADMIN', 'MANAGER') && <button className="btn-secondary text-rose-600" onClick={() => setConfirm('CANCELED')}><XCircle className="h-4 w-4" /> Cancelar venda</button>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Produto</th><th className="text-right">Qtd.</th><th className="text-right">Unitário</th><th className="text-right">Subtotal</th></tr></thead>
              <tbody>
                {sale.items?.map((i) => (
                  <tr key={i.id}>
                    <td><p className="font-medium text-slate-900">{i.name}</p><p className="text-xs text-slate-500">{i.product.sku}</p></td>
                    <td className="text-right num">{i.quantity}</td>
                    <td className="text-right num">{money(i.unitPrice)}</td>
                    <td className="text-right font-medium num">{money(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto max-w-xs space-y-1.5 p-5 text-sm">
            <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd className="num">{money(sale.subtotal)}</dd></div>
            <div className="flex justify-between text-slate-600"><dt>Desconto</dt><dd className="num">− {money(sale.discount)}</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-lg font-semibold text-slate-900"><dt>Total</dt><dd className="num">{money(sale.total)}</dd></div>
          </dl>
        </section>

        <section className="card h-fit p-5">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-slate-500">Cliente</dt><dd className="font-medium text-slate-900">{sale.customer?.name ?? 'Consumidor final'}</dd>{sale.customer?.phone && <dd className="text-slate-500">{sale.customer.phone}</dd>}</div>
            <div><dt className="text-slate-500">Pagamento</dt><dd className="font-medium text-slate-900">{paymentLabel[sale.paymentMethod]}</dd></div>
            <div><dt className="text-slate-500">Vendedor</dt><dd className="font-medium text-slate-900">{sale.user?.name ?? '—'}</dd></div>
            <div><dt className="text-slate-500">Registrada em</dt><dd className="text-slate-900">{dateTime(sale.createdAt)}</dd></div>
            {sale.paidAt && <div><dt className="text-slate-500">Paga em</dt><dd className="text-slate-900">{dateTime(sale.paidAt)}</dd></div>}
            {sale.canceledAt && <div><dt className="text-slate-500">Cancelada em</dt><dd className="text-rose-700">{dateTime(sale.canceledAt)}</dd></div>}
            {can('ADMIN', 'MANAGER') && sale.status !== 'CANCELED' && (
              <div><dt className="text-slate-500">Lucro bruto</dt><dd className="font-medium text-emerald-700 num">{money(sale.total - sale.cost)}</dd></div>
            )}
            {sale.notes && <div><dt className="text-slate-500">Observações</dt><dd className="text-slate-900">{sale.notes}</dd></div>}
          </dl>
        </section>
      </div>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} loading={mut.isPending} danger={confirm === 'CANCELED'}
        title={confirm === 'PAID' ? 'Confirmar pagamento' : 'Cancelar venda'}
        confirmLabel={confirm === 'PAID' ? 'Confirmar' : 'Cancelar venda'}
        message={confirm === 'PAID' ? `Marcar a venda #${sale.number} como paga?` : `Cancelar a venda #${sale.number}? Os itens voltam para o estoque. Esta ação não pode ser desfeita.`}
        onConfirm={() => confirm && mut.mutate(confirm)} />
    </>
  );
}

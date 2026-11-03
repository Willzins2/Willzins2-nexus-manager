import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Field, Input, PageHeader, Select, Spinner, Textarea, cn, useDebounced } from '../components/ui';
import { money, paymentLabel } from '../lib/format';
import type { Customer, Paged, PaymentMethod, Product } from '../lib/types';

interface Line {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export default function NewSale() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [lines, setLines] = useState<Line[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('PIX');
  const [status, setStatus] = useState<'PAID' | 'PENDING'>('PAID');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const ps = useDebounced(productSearch, 250);
  const cs = useDebounced(customerSearch, 250);
  const { data: products } = useQuery({
    queryKey: ['products', 'pick', ps],
    queryFn: () => api.get<Paged<Product>>('/products', { search: ps, active: 'true', pageSize: 8 }),
    enabled: ps.length > 0,
  });
  const { data: customers } = useQuery({
    queryKey: ['customers', 'pick', cs],
    queryFn: () => api.get<Paged<Customer>>('/customers', { search: cs, pageSize: 6 }),
    enabled: cs.length > 0 && !customer,
  });

  const add = (p: Product) => {
    setLines((ls) => {
      const found = ls.find((l) => l.product.id === p.id);
      if (found) return ls.map((l) => (l.product.id === p.id ? { ...l, quantity: Math.min(l.quantity + 1, p.stock) } : l));
      return [...ls, { product: p, quantity: 1, unitPrice: p.price }];
    });
    setProductSearch('');
  };
  const update = (id: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => setLines((ls) => ls.filter((l) => l.product.id !== id));

  const subtotal = useMemo(() => lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0), [lines]);
  const disc = Math.max(0, Number(discount.replace(',', '.')) || 0);
  const total = subtotal - disc;
  const invalid = !lines.length || disc > subtotal || lines.some((l) => l.quantity < 1 || l.quantity > l.product.stock || l.unitPrice < 0);

  const submit = async () => {
    setErrors([]);
    setSaving(true);
    try {
      const sale = await api.post<{ id: string; number: number }>('/sales', {
        customerId: customer?.id ?? null,
        paymentMethod: payment,
        status,
        discount: Math.round(disc * 100) / 100,
        notes,
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, unitPrice: Math.round(l.unitPrice * 100) / 100 })),
      });
      toast.success(`Venda #${sale.number} registrada`);
      ['sales', 'products', 'dashboard', 'customers'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      navigate(`/vendas/${sale.id}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.details?.length) setErrors(e.details.map((d) => d.message));
      else toast.error(e instanceof ApiError ? e.message : 'Erro ao registrar a venda');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Link to="/vendas" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Vendas</Link>
      <PageHeader title="Nova venda" />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Itens</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Buscar produto (nome ou SKU)" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} aria-label="Buscar produto" />
              {ps && products && (
                <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {products.data.length ? products.data.map((p) => (
                    <li key={p.id}>
                      <button type="button" disabled={p.stock <= 0} onClick={() => add(p)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                        <span className="min-w-0"><span className="block truncate font-medium text-slate-900">{p.name}</span><span className="text-xs text-slate-500">{p.sku} · {p.stock} em estoque</span></span>
                        <span className="shrink-0 font-medium num">{money(p.price)}</span>
                      </button>
                    </li>
                  )) : <li className="px-3 py-2 text-sm text-slate-500">Nenhum produto encontrado</li>}
                </ul>
              )}
            </div>

            {lines.length ? (
              <ul className="mt-4 divide-y divide-slate-100">
                {lines.map((l) => {
                  const over = l.quantity > l.product.stock;
                  return (
                    <li key={l.product.id} className="grid grid-cols-[1fr_auto] gap-3 py-3 sm:grid-cols-[1fr_auto_120px_110px_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{l.product.name}</p>
                        <p className={cn('text-xs', over ? 'text-rose-600' : 'text-slate-500')}>{l.product.sku} · {l.product.stock} disponível(is)</p>
                      </div>
                      <button className="btn-icon btn-ghost justify-self-end sm:order-last" onClick={() => remove(l.product.id)} aria-label="Remover item"><Trash2 className="h-4 w-4" /></button>
                      <div className="flex items-center rounded-lg border border-slate-300">
                        <button className="btn-icon rounded-r-none" onClick={() => update(l.product.id, { quantity: Math.max(1, l.quantity - 1) })} aria-label="Diminuir"><Minus className="h-3.5 w-3.5" /></button>
                        <input className="w-12 border-x border-slate-300 py-1.5 text-center text-sm num focus:outline-none" value={l.quantity} inputMode="numeric"
                          onChange={(e) => update(l.product.id, { quantity: Math.max(0, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)) })} aria-label="Quantidade" />
                        <button className="btn-icon rounded-l-none" onClick={() => update(l.product.id, { quantity: l.quantity + 1 })} disabled={l.quantity >= l.product.stock} aria-label="Aumentar"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      <Input type="number" step="0.01" min="0" className="py-1.5 text-right" value={l.unitPrice} onChange={(e) => update(l.product.id, { unitPrice: Number(e.target.value) })} aria-label="Preço unitário" />
                      <p className="text-right font-medium num">{money(l.quantity * l.unitPrice)}</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-4 flex flex-col items-center rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                <ShoppingCart className="mb-2 h-6 w-6 text-slate-300" /> Busque e adicione produtos à venda.
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-semibold text-slate-900">Cliente</h2>
            <p className="mb-3 text-sm text-slate-500">Sem cliente, a venda fica como consumidor final.</p>
            {customer ? (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div><p className="font-medium text-slate-900">{customer.name}</p><p className="text-xs text-slate-500">{customer.email ?? customer.phone}</p></div>
                <button className="btn-ghost text-sm" onClick={() => { setCustomer(null); setCustomerSearch(''); }}>Trocar</button>
              </div>
            ) : (
              <div className="relative">
                <Input placeholder="Buscar cliente (opcional)" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} aria-label="Buscar cliente" />
                {cs && customers && (
                  <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {customers.data.length ? customers.data.map((c) => (
                      <li key={c.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => setCustomer(c)}><span className="font-medium">{c.name}</span> <span className="text-slate-500">{c.email}</span></button></li>
                    )) : <li className="px-3 py-2 text-sm text-slate-500">Nenhum cliente encontrado</li>}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-6">
          <h2 className="font-semibold text-slate-900">Pagamento</h2>
          <Field label="Forma de pagamento">
            <Select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
              {Object.entries(paymentLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Situação">
            <Select value={status} onChange={(e) => setStatus(e.target.value as 'PAID' | 'PENDING')}>
              <option value="PAID">Paga</option>
              <option value="PENDING">Pendente (a receber)</option>
            </Select>
          </Field>
          <Field label="Desconto (R$)" error={disc > subtotal ? 'Maior que o subtotal' : undefined}>
            <Input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} invalid={disc > subtotal} />
          </Field>
          <Field label="Observações"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px]" /></Field>
          <dl className="space-y-1.5 border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd className="num">{money(subtotal)}</dd></div>
            <div className="flex justify-between text-slate-600"><dt>Desconto</dt><dd className="num">− {money(disc)}</dd></div>
            <div className="flex justify-between pt-1 text-lg font-semibold text-slate-900"><dt>Total</dt><dd className="num">{money(Math.max(0, total))}</dd></div>
          </dl>
          {errors.length > 0 && <ul className="space-y-1 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          <button className="btn-primary w-full py-2.5" disabled={invalid || saving} onClick={submit}>{saving && <Spinner />} Finalizar venda</button>
        </aside>
      </div>
    </>
  );
}

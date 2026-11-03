import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ImportModal, customerImport } from '../components/ImportModal';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Building2, FileSpreadsheet, Mail, MapPin, Pencil, Phone, Plus, Trash2, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, PageLoader, Pagination, SearchInput, Spinner, Textarea } from '../components/ui';
import { SaleStatusBadge } from '../components/badges';
import { date, money } from '../lib/format';
import { errorMessage, handleFormError, toastError } from '../lib/forms';
import { useListState } from '../lib/useList';
import type { Customer, Paged, SaleStatus } from '../lib/types';

const digits = (v?: string) => (v ?? '').replace(/\D/g, '');
const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome'),
  email: z.string().trim().email('E-mail inválido').or(z.literal('')),
  phone: z.string().refine((v) => !v || digits(v).length >= 10, 'Informe DDD + número'),
  document: z.string().refine((v) => !v || [11, 14].includes(digits(v).length), 'CPF (11) ou CNPJ (14 dígitos)'),
  company: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string().refine((v) => !v || /^[A-Za-z]{2}$/.test(v), 'UF com 2 letras'),
  notes: z.string(),
});
type Form = z.infer<typeof schema>;
const empty: Form = { name: '', email: '', phone: '', document: '', company: '', address: '', city: '', state: '', notes: '' };

/** Máscara simples de telefone brasileiro. */
const maskPhone = (v: string) => {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

function CustomerForm({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, setError, setValue, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: empty });

  useEffect(() => {
    reset(customer ? Object.fromEntries(Object.keys(empty).map((k) => [k, (customer as unknown as Record<string, string | null>)[k] ?? ''])) as Form : empty);
  }, [customer, reset]);

  const onSubmit = async (data: Form) => {
    try {
      if (customer) await api.put(`/customers/${customer.id}`, data);
      else await api.post('/customers', data);
      toast.success(customer ? 'Cliente atualizado' : 'Cliente cadastrado');
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    } catch (e) {
      handleFormError(e, setError);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2" id="customer-form">
      <Field label="Nome *" error={errors.name?.message} className="sm:col-span-2"><Input invalid={!!errors.name} {...register('name')} autoFocus /></Field>
      <Field label="E-mail" error={errors.email?.message}><Input type="email" invalid={!!errors.email} {...register('email')} /></Field>
      <Field label="Telefone" error={errors.phone?.message}>
        <Input inputMode="tel" invalid={!!errors.phone} {...register('phone', { onChange: (e) => setValue('phone', maskPhone(e.target.value)) })} placeholder="(11) 99999-0000" />
      </Field>
      <Field label="CPF / CNPJ" error={errors.document?.message}><Input inputMode="numeric" invalid={!!errors.document} {...register('document')} /></Field>
      <Field label="Empresa" error={errors.company?.message}><Input {...register('company')} /></Field>
      <Field label="Endereço" className="sm:col-span-2"><Input {...register('address')} /></Field>
      <Field label="Cidade"><Input {...register('city')} /></Field>
      <Field label="UF" error={errors.state?.message}><Input maxLength={2} className="uppercase" invalid={!!errors.state} {...register('state')} /></Field>
      <Field label="Observações" className="sm:col-span-2"><Textarea {...register('notes')} /></Field>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner />} Salvar</button>
      </div>
    </form>
  );
}

interface CustomerDetail extends Customer {
  sales: { id: string; number: number; total: number; status: SaleStatus; createdAt: string }[];
  stats: { totalSpent: number; paidSales: number };
}

function CustomerView({ id }: { id: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['customers', id], queryFn: () => api.get<CustomerDetail>(`/customers/${id}`) });
  if (isLoading || !data) return <PageLoader />;
  const info = [
    { icon: Mail, v: data.email },
    { icon: Phone, v: data.phone },
    { icon: Building2, v: data.company },
    { icon: MapPin, v: [data.address, data.city, data.state].filter(Boolean).join(', ') },
  ].filter((i) => i.v);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Total comprado</p><p className="text-lg font-semibold num">{money(data.stats.totalSpent)}</p></div>
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Compras pagas</p><p className="text-lg font-semibold num">{data.stats.paidSales}</p></div>
      </div>
      <ul className="space-y-2 text-sm">
        {info.map((i, idx) => <li key={idx} className="flex items-center gap-2 text-slate-700"><i.icon className="h-4 w-4 text-slate-400" />{i.v}</li>)}
        {data.document && <li className="text-slate-500">Documento: {data.document}</li>}
        <li className="text-slate-500">Cliente desde {date(data.createdAt)}</li>
      </ul>
      {data.notes && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{data.notes}</p>}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Últimas compras</h3>
        {data.sales.length ? (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {data.sales.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <Link to={`/vendas/${s.id}`} className="font-medium text-brand-700 hover:underline">#{s.number}</Link>
                <span className="text-slate-500">{date(s.createdAt)}</span>
                <SaleStatusBadge status={s.status} />
                <span className="font-medium num">{money(s.total)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">Nenhuma compra ainda.</p>}
      </div>
    </div>
  );
}

export default function Customers() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { search, setSearch, debounced, page, setPage } = useListState();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Customer | null | undefined>(params.get('novo') ? null : undefined); // undefined = fechado; null = novo
  const [importing, setImporting] = useState(!!params.get('importar'));
  useEffect(() => {
    if (params.get('novo') || params.get('importar')) setParams({}, { replace: true }); // atalhos vindos dos primeiros passos
  }, [params, setParams]);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customers', { page, search: debounced }],
    queryFn: () => api.get<Paged<Customer>>('/customers', { page, search: debounced, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      toast.success('Cliente excluído');
      qc.invalidateQueries({ queryKey: ['customers'] });
      setDeleting(null);
    },
    onError: (e) => toastError(e),
  });

  return (
    <>
      <PageHeader title="Clientes" subtitle="Cadastro e informações de contato." actions={<>
        <button className="btn-secondary" onClick={() => setImporting(true)}><FileSpreadsheet className="h-4 w-4" /> Importar</button>
        <button className="btn-primary" onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Novo cliente</button>
      </>} />

      <div className="card">
        <div className="border-b border-slate-100 p-4"><SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, e-mail, telefone..." /></div>
        {isLoading ? <PageLoader /> : error ? <div className="p-4"><ErrorState message={errorMessage(error)} onRetry={refetch} /></div> : !data?.data.length ? (
          <EmptyState icon={Users} title={debounced ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'} text={debounced ? 'Tente outro termo de busca.' : 'Cadastre seu primeiro cliente para começar.'}
            action={!debounced && <button className="btn-primary" onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Novo cliente</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Nome</th><th className="hidden md:table-cell">Contato</th><th className="hidden lg:table-cell">Cidade</th><th className="hidden sm:table-cell text-right">Compras</th><th className="w-24" /></tr></thead>
                <tbody>
                  {data.data.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <button className="text-left font-medium text-slate-900 hover:text-brand-700" onClick={() => setViewing(c)}>{c.name}</button>
                        {c.company && <p className="text-xs text-slate-500">{c.company}</p>}
                        <p className="text-xs text-slate-500 md:hidden">{c.phone ?? c.email}</p>
                      </td>
                      <td className="hidden md:table-cell"><p>{c.email ?? '—'}</p><p className="text-xs text-slate-500">{c.phone}</p></td>
                      <td className="hidden lg:table-cell text-slate-600">{c.city ? `${c.city}/${c.state ?? ''}` : '—'}</td>
                      <td className="hidden sm:table-cell text-right num">{c._count?.sales ?? 0}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button className="btn-icon btn-ghost" onClick={() => setEditing(c)} aria-label={`Editar ${c.name}`}><Pencil className="h-4 w-4" /></button>
                          {can('ADMIN', 'MANAGER') && <button className="btn-icon btn-ghost hover:text-rose-600" onClick={() => setDeleting(c)} aria-label={`Excluir ${c.name}`}><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={setPage} />
          </>
        )}
      </div>

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Editar cliente' : 'Novo cliente'} size="lg">
        <CustomerForm customer={editing ?? null} onClose={() => setEditing(undefined)} />
      </Modal>
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name ?? ''}
        footer={<button className="btn-secondary" onClick={() => { setEditing(viewing); setViewing(null); }}><Pencil className="h-4 w-4" /> Editar</button>}>
        {viewing && <CustomerView id={viewing.id} />}
      </Modal>
      <ImportModal open={importing} onClose={() => setImporting(false)} config={customerImport} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} danger confirmLabel="Excluir" loading={del.isPending} title="Excluir cliente"
        message={<>Tem certeza que deseja excluir <strong>{deleting?.name}</strong>? O histórico de vendas é mantido, sem o vínculo com o cliente.</>}
        onConfirm={() => deleting && del.mutate(deleting.id)} />
    </>
  );
}

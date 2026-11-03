import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowDownUp, History, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, PageLoader, Pagination, SearchInput, Select, Spinner, Textarea, cn } from '../components/ui';
import { StockBadge } from '../components/badges';
import { dateTime, int, money, movementLabel, percent } from '../lib/format';
import { errorMessage, handleFormError } from '../lib/forms';
import { useListState } from '../lib/useList';
import type { Paged, Product, StockMovement } from '../lib/types';

const moneyField = z.coerce.number({ invalid_type_error: 'Informe um valor' }).min(0, 'Não pode ser negativo');
const schema = z.object({
  sku: z.string().trim().min(1, 'Informe o SKU').regex(/^[A-Za-z0-9._-]+$/, 'Use letras, números, ".", "-" ou "_"'),
  name: z.string().trim().min(2, 'Informe o nome'),
  category: z.string(),
  description: z.string(),
  price: moneyField,
  cost: moneyField,
  stock: z.coerce.number().int('Número inteiro').min(0),
  minStock: z.coerce.number().int('Número inteiro').min(0),
  active: z.boolean(),
});
type Form = z.infer<typeof schema>;

function ProductForm({ product, categories, onClose }: { product: Product | null; categories: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, watch, setError, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    reset(product
      ? { ...product, category: product.category ?? '', description: product.description ?? '' }
      : { sku: '', name: '', category: '', description: '', price: 0, cost: 0, stock: 0, minStock: 5, active: true });
  }, [product, reset]);

  const price = Number(watch('price')) || 0;
  const cost = Number(watch('cost')) || 0;

  const onSubmit = async ({ stock, ...data }: Form) => {
    try {
      if (product) await api.put(`/products/${product.id}`, data);
      else await api.post('/products', { ...data, stock });
      toast.success(product ? 'Produto atualizado' : 'Produto cadastrado');
      qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    } catch (e) {
      handleFormError(e, setError);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome *" error={errors.name?.message} className="sm:col-span-2"><Input invalid={!!errors.name} {...register('name')} autoFocus /></Field>
      <Field label="SKU *" error={errors.sku?.message}><Input className="uppercase" invalid={!!errors.sku} {...register('sku')} /></Field>
      <Field label="Categoria">
        <Input list="categories" {...register('category')} />
        <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field label="Preço de venda (R$) *" error={errors.price?.message}><Input type="number" step="0.01" min="0" invalid={!!errors.price} {...register('price')} /></Field>
      <Field label="Custo (R$)" error={errors.cost?.message} hint={price > 0 ? `Margem: ${percent((price - cost) / price)}` : undefined}>
        <Input type="number" step="0.01" min="0" invalid={!!errors.cost} {...register('cost')} />
      </Field>
      {!product && <Field label="Estoque inicial" error={errors.stock?.message}><Input type="number" min="0" invalid={!!errors.stock} {...register('stock')} /></Field>}
      <Field label="Estoque mínimo" error={errors.minStock?.message} hint="Abaixo disso o produto entra no alerta."><Input type="number" min="0" invalid={!!errors.minStock} {...register('minStock')} /></Field>
      <Field label="Descrição" className="sm:col-span-2"><Textarea {...register('description')} /></Field>
      <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" {...register('active')} /> Produto ativo (disponível para venda)
      </label>
      {product && <p className="text-xs text-slate-500 sm:col-span-2">Para alterar o estoque, use “Movimentar estoque”: toda mudança fica registrada no histórico.</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner />} Salvar</button>
      </div>
    </form>
  );
}

const moveSchema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUST']),
  quantity: z.coerce.number().int('Número inteiro').min(0, 'Não pode ser negativo'),
  reason: z.string(),
}).refine((v) => v.type === 'ADJUST' || v.quantity > 0, { message: 'Informe uma quantidade', path: ['quantity'] });
type MoveForm = z.infer<typeof moveSchema>;

function StockForm({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm<MoveForm>({ resolver: zodResolver(moveSchema), defaultValues: { type: 'IN', quantity: 1, reason: '' } });
  const type = watch('type');
  const qty = Number(watch('quantity')) || 0;
  const next = type === 'IN' ? product.stock + qty : type === 'OUT' ? product.stock - qty : qty;

  const onSubmit = async (data: MoveForm) => {
    try {
      await api.post(`/products/${product.id}/movements`, data);
      toast.success('Estoque atualizado');
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    } catch (e) {
      handleFormError(e, setError);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid grid-cols-3 gap-2" role="radiogroup">
        {(['IN', 'OUT', 'ADJUST'] as const).map((t) => (
          <label key={t} className={cn('cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium', type === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
            <input type="radio" value={t} className="sr-only" {...register('type')} />
            {t === 'ADJUST' ? 'Inventário' : movementLabel[t]}
          </label>
        ))}
      </div>
      <Field label={type === 'ADJUST' ? 'Saldo contado' : 'Quantidade'} error={errors.quantity?.message}><Input type="number" min="0" invalid={!!errors.quantity} {...register('quantity')} autoFocus /></Field>
      <Field label="Motivo"><Input placeholder={type === 'IN' ? 'Ex.: compra do fornecedor' : type === 'OUT' ? 'Ex.: avaria, uso interno' : 'Ex.: contagem mensal'} {...register('reason')} /></Field>
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-500">Saldo atual: <strong className="text-slate-800 num">{product.stock}</strong></span>
        <span className="text-slate-500">Novo saldo: <strong className={cn('num', next < 0 ? 'text-rose-600' : 'text-slate-900')}>{next}</strong></span>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={isSubmitting || next < 0}>{isSubmitting && <Spinner />} Confirmar</button>
      </div>
    </form>
  );
}

function Movements({ product }: { product: Product }) {
  const { data, isLoading } = useQuery({ queryKey: ['products', product.id, 'movements'], queryFn: () => api.get<StockMovement[]>(`/products/${product.id}/movements`) });
  if (isLoading || !data) return <PageLoader />;
  if (!data.length) return <p className="py-6 text-center text-sm text-slate-500">Nenhuma movimentação.</p>;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="table">
        <thead><tr><th>Data</th><th>Tipo</th><th className="text-right">Qtd.</th><th className="text-right">Saldo</th><th className="hidden sm:table-cell">Motivo</th></tr></thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap text-slate-500">{dateTime(m.createdAt)}</td>
              <td><Badge tone={m.quantity >= 0 ? 'green' : 'red'}>{movementLabel[m.type]}</Badge></td>
              <td className={cn('text-right font-medium num', m.quantity >= 0 ? 'text-emerald-700' : 'text-rose-700')}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
              <td className="text-right num">{m.balance}</td>
              <td className="hidden sm:table-cell text-slate-600">{m.reason ?? '—'}{m.user && <span className="block text-xs text-slate-400">{m.user.name}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Products() {
  const { can } = useAuth();
  const manage = can('ADMIN', 'MANAGER');
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const { search, setSearch, debounced, page, setPage } = useListState();
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState(params.get('stock') ?? 'all');
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [moving, setMoving] = useState<Product | null>(null);
  const [history, setHistory] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const { data: categories = [] } = useQuery({ queryKey: ['products', 'categories'], queryFn: () => api.get<string[]>('/products/categories') });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['products', { page, search: debounced, category, stock }],
    queryFn: () => api.get<Paged<Product>>('/products', { page, search: debounced, category, stock, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: boolean }>(`/products/${id}`),
    onSuccess: (r) => {
      toast.success(r.deleted ? 'Produto excluído' : 'Produto possui vendas: foi desativado em vez de excluído');
      qc.invalidateQueries({ queryKey: ['products'] });
      setDeleting(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Produtos e estoque" subtitle="Catálogo, preços e controle de estoque."
        actions={manage && <button className="btn-primary" onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Novo produto</button>} />

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome ou SKU..." />
          <Select className="sm:w-48" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select className="sm:w-44" value={stock} onChange={(e) => { setStock(e.target.value); setPage(1); }} aria-label="Situação do estoque">
            <option value="all">Todo o estoque</option>
            <option value="low">Estoque baixo</option>
            <option value="out">Sem estoque</option>
          </Select>
        </div>
        {isLoading ? <PageLoader /> : error ? <div className="p-4"><ErrorState message={errorMessage(error)} onRetry={refetch} /></div> : !data?.data.length ? (
          <EmptyState icon={Package} title="Nenhum produto encontrado" text={manage ? 'Cadastre produtos para vender e controlar o estoque.' : undefined}
            action={manage && !debounced && <button className="btn-primary" onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Novo produto</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Produto</th><th className="hidden md:table-cell">Categoria</th><th className="text-right">Preço</th><th className="hidden lg:table-cell text-right">Margem</th><th className="text-right">Estoque</th><th className="hidden sm:table-cell">Situação</th><th className="w-32" /></tr></thead>
                <tbody>
                  {data.data.map((p) => (
                    <tr key={p.id} className={cn(!p.active && 'opacity-60')}>
                      <td><p className="font-medium text-slate-900">{p.name}</p><p className="text-xs text-slate-500">{p.sku}{!p.active && ' · inativo'}</p></td>
                      <td className="hidden md:table-cell text-slate-600">{p.category ?? '—'}</td>
                      <td className="text-right num">{money(p.price)}</td>
                      <td className="hidden lg:table-cell text-right text-slate-600 num">{p.price > 0 ? percent((p.price - p.cost) / p.price) : '—'}</td>
                      <td className="text-right font-medium num">{int(p.stock)}</td>
                      <td className="hidden sm:table-cell"><StockBadge stock={p.stock} minStock={p.minStock} /></td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button className="btn-icon btn-ghost" onClick={() => setHistory(p)} aria-label="Histórico de estoque" title="Histórico"><History className="h-4 w-4" /></button>
                          {manage && <>
                            <button className="btn-icon btn-ghost" onClick={() => setMoving(p)} aria-label="Movimentar estoque" title="Movimentar estoque"><ArrowDownUp className="h-4 w-4" /></button>
                            <button className="btn-icon btn-ghost" onClick={() => setEditing(p)} aria-label={`Editar ${p.name}`} title="Editar"><Pencil className="h-4 w-4" /></button>
                            <button className="btn-icon btn-ghost hover:text-rose-600" onClick={() => setDeleting(p)} aria-label={`Excluir ${p.name}`} title="Excluir"><Trash2 className="h-4 w-4" /></button>
                          </>}
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

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Editar produto' : 'Novo produto'} size="lg">
        <ProductForm product={editing ?? null} categories={categories} onClose={() => setEditing(undefined)} />
      </Modal>
      <Modal open={!!moving} onClose={() => setMoving(null)} title={`Movimentar estoque · ${moving?.name ?? ''}`} size="sm">
        {moving && <StockForm product={moving} onClose={() => setMoving(null)} />}
      </Modal>
      <Modal open={!!history} onClose={() => setHistory(null)} title={`Histórico · ${history?.name ?? ''}`} size="lg">
        {history && <Movements product={history} />}
      </Modal>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} danger confirmLabel="Excluir" loading={del.isPending} title="Excluir produto"
        message={<>Excluir <strong>{deleting?.name}</strong>? Se o produto já tiver vendas, ele será apenas desativado para preservar o histórico.</>}
        onConfirm={() => deleting && del.mutate(deleting.id)} />
    </>
  );
}

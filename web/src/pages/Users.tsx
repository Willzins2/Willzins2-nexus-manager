import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { Badge, ConfirmDialog, ErrorState, Field, Input, Modal, PageHeader, PageLoader, Select, Spinner, type Tone } from '../components/ui';
import { dateTime, initials, roleLabel } from '../lib/format';
import { errorMessage, handleFormError, toastError } from '../lib/forms';
import { email, password } from '../lib/schemas';
import type { Role, User } from '../lib/types';

const roleTone: Record<Role, Tone> = { ADMIN: 'violet', MANAGER: 'blue', SELLER: 'gray' };
const permissions: { label: string; roles: Role[] }[] = [
  { label: 'Clientes, vendas e tarefas', roles: ['ADMIN', 'MANAGER', 'SELLER'] },
  { label: 'Consultar produtos e estoque', roles: ['ADMIN', 'MANAGER', 'SELLER'] },
  { label: 'Cadastrar produtos e movimentar estoque', roles: ['ADMIN', 'MANAGER'] },
  { label: 'Excluir clientes e cancelar vendas', roles: ['ADMIN', 'MANAGER'] },
  { label: 'Relatórios e lucro', roles: ['ADMIN', 'MANAGER'] },
  { label: 'Gerenciar usuários e acessos', roles: ['ADMIN'] },
];

const baseSchema = z.object({ name: z.string().trim().min(2, 'Informe o nome'), email, role: z.enum(['ADMIN', 'MANAGER', 'SELLER']), active: z.boolean() });
const createSchema = baseSchema.extend({ password });
const editSchema = baseSchema.extend({ password: password.or(z.literal('')) });
type Form = z.infer<typeof editSchema>;

function UserForm({ user, onClose }: { user: User | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(user ? editSchema : createSchema) });
  useEffect(() => {
    reset(user ? { name: user.name, email: user.email, role: user.role, active: user.active, password: '' } : { name: '', email: '', role: 'SELLER', active: true, password: '' });
  }, [user, reset]);

  const onSubmit = async (data: Form) => {
    try {
      if (user) await api.patch(`/users/${user.id}`, { name: data.name, role: data.role, active: data.active, ...(data.password ? { password: data.password } : {}) });
      else await api.post('/users', { name: data.name, email: data.email, role: data.role, password: data.password });
      toast.success(user ? 'Usuário atualizado' : 'Usuário criado');
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    } catch (e) {
      handleFormError(e, setError);
    }
  };
  const self = user?.id === me?.id;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome *" error={errors.name?.message}><Input invalid={!!errors.name} {...register('name')} autoFocus /></Field>
      <Field label="E-mail *" error={errors.email?.message} hint={user ? 'O próprio usuário altera o e-mail no perfil.' : undefined}><Input type="email" disabled={!!user} invalid={!!errors.email} {...register('email')} /></Field>
      <Field label="Perfil de acesso" error={errors.role?.message}><Select {...register('role')} disabled={self}><option value="SELLER">Vendedor</option><option value="MANAGER">Gerente</option><option value="ADMIN">Administrador</option></Select></Field>
      <Field label={user ? 'Nova senha (opcional)' : 'Senha inicial *'} error={errors.password?.message}><Input type="password" autoComplete="new-password" invalid={!!errors.password} {...register('password')} /></Field>
      {user && !self && <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" {...register('active')} /> Acesso ativo</label>}
      <p className="text-xs text-slate-500 sm:col-span-2">Alterar perfil, senha ou desativar encerra as sessões abertas desse usuário.</p>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner />} Salvar</button>
      </div>
    </form>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<User | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { toast.success('Usuário excluído'); qc.invalidateQueries({ queryKey: ['users'] }); setDeleting(null); },
    onError: (e) => toastError(e),
  });

  return (
    <>
      <PageHeader title="Usuários" subtitle="Equipe e controle de acesso por perfil."
        actions={<button className="btn-primary" onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Novo usuário</button>} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          {isLoading ? <PageLoader /> : error ? <div className="p-4"><ErrorState message={errorMessage(error)} onRetry={refetch} /></div> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Usuário</th><th>Perfil</th><th className="hidden md:table-cell">Último acesso</th><th className="w-24" /></tr></thead>
                <tbody>
                  {data?.map((u) => (
                    <tr key={u.id} className={u.active ? '' : 'opacity-60'}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{initials(u.name)}</div>
                          <div className="min-w-0"><p className="font-medium text-slate-900">{u.name} {u.id === me?.id && <span className="text-xs font-normal text-slate-400">(você)</span>}</p><p className="truncate text-xs text-slate-500">{u.email}</p></div>
                        </div>
                      </td>
                      <td><div className="flex flex-wrap gap-1"><Badge tone={roleTone[u.role]}>{roleLabel[u.role]}</Badge>{!u.active && <Badge tone="red">Inativo</Badge>}</div></td>
                      <td className="hidden md:table-cell text-slate-500">{dateTime(u.lastLoginAt)}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button className="btn-icon btn-ghost" onClick={() => setEditing(u)} aria-label={`Editar ${u.name}`}><Pencil className="h-4 w-4" /></button>
                          {u.id !== me?.id && <button className="btn-icon btn-ghost hover:text-rose-600" onClick={() => setDeleting(u)} aria-label={`Excluir ${u.name}`}><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <section className="card h-fit p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="h-4 w-4 text-brand-600" /> Permissões por perfil</h2>
          <p className="mb-4 text-sm text-slate-500">Aplicadas na API, não só na tela.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-500"><th className="pb-2 text-left font-medium">Ação</th>{(['ADMIN', 'MANAGER', 'SELLER'] as Role[]).map((r) => <th key={r} className="pb-2 text-center font-medium">{roleLabel[r].slice(0, 5)}.</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {permissions.map((p) => (
                  <tr key={p.label}><td className="py-2 pr-2 text-slate-700">{p.label}</td>{(['ADMIN', 'MANAGER', 'SELLER'] as Role[]).map((r) => <td key={r} className="text-center">{p.roles.includes(r) ? <span className="text-emerald-600" aria-label="permitido">✓</span> : <span className="text-slate-300" aria-label="sem acesso">—</span>}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Editar usuário' : 'Novo usuário'} size="lg">
        <UserForm user={editing ?? null} onClose={() => setEditing(undefined)} />
      </Modal>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} danger confirmLabel="Excluir" loading={del.isPending} title="Excluir usuário"
        message={<>Excluir <strong>{deleting?.name}</strong>? As vendas registradas por ele são mantidas. Para apenas bloquear o acesso, prefira desativar.</>}
        onConfirm={() => deleting && del.mutate(deleting.id)} />
    </>
  );
}

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { Badge, Field, Input, PageHeader, Spinner } from '../components/ui';
import { handleFormError } from '../lib/forms';
import { roleLabel } from '../lib/format';
import { email, password } from '../lib/schemas';
import type { User } from '../lib/types';

const profileSchema = z.object({ name: z.string().trim().min(2, 'Informe o nome'), email });
const pwSchema = z.object({ currentPassword: z.string().min(1, 'Informe a senha atual'), newPassword: password, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { message: 'As senhas não conferem', path: ['confirm'] });

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const p = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { name: user?.name, email: user?.email } });
  const pw = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });

  const saveProfile = async (data: z.infer<typeof profileSchema>) => {
    try {
      const r = await api.patch<{ user: User }>('/auth/me', data);
      setUser(r.user);
      toast.success('Perfil atualizado');
    } catch (e) { handleFormError(e, p.setError); }
  };
  const savePassword = async ({ confirm: _c, ...data }: z.infer<typeof pwSchema>) => {
    try {
      await api.post('/auth/me/password', data);
      pw.reset();
      toast.success('Senha alterada. Outras sessões foram encerradas.');
    } catch (e) { handleFormError(e, pw.setError); }
  };
  const logoutAll = async () => {
    await api.post('/auth/logout-all').catch(() => undefined);
    await logout();
  };

  return (
    <>
      <PageHeader title="Meu perfil" subtitle={user?.organization.name} />
      <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
        <form onSubmit={p.handleSubmit(saveProfile)} noValidate className="card space-y-4 p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Dados pessoais</h2>{user && <Badge tone="blue">{roleLabel[user.role]}</Badge>}</div>
          <Field label="Nome" error={p.formState.errors.name?.message}><Input invalid={!!p.formState.errors.name} {...p.register('name')} /></Field>
          <Field label="E-mail" error={p.formState.errors.email?.message}><Input type="email" invalid={!!p.formState.errors.email} {...p.register('email')} /></Field>
          <button className="btn-primary" disabled={p.formState.isSubmitting}>{p.formState.isSubmitting && <Spinner />} Salvar</button>
        </form>
        <form onSubmit={pw.handleSubmit(savePassword)} noValidate className="card space-y-4 p-5">
          <h2 className="font-semibold text-slate-900">Alterar senha</h2>
          <Field label="Senha atual" error={pw.formState.errors.currentPassword?.message}><Input type="password" autoComplete="current-password" invalid={!!pw.formState.errors.currentPassword} {...pw.register('currentPassword')} /></Field>
          <Field label="Nova senha" error={pw.formState.errors.newPassword?.message}><Input type="password" autoComplete="new-password" invalid={!!pw.formState.errors.newPassword} {...pw.register('newPassword')} /></Field>
          <Field label="Confirmar nova senha" error={pw.formState.errors.confirm?.message}><Input type="password" autoComplete="new-password" invalid={!!pw.formState.errors.confirm} {...pw.register('confirm')} /></Field>
          <button className="btn-primary" disabled={pw.formState.isSubmitting}>{pw.formState.isSubmitting && <Spinner />} Alterar senha</button>
        </form>
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Sessões</h2>
          <p className="mt-1 text-sm text-slate-500">Encerre o acesso em todos os dispositivos onde sua conta está conectada.</p>
          <button className="btn-secondary mt-3" onClick={logoutAll}>Sair de todos os dispositivos</button>
        </section>
      </div>
    </>
  );
}

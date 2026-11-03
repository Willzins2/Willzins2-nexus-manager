import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Download, Mail, Monitor, Moon, Sun } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { Badge, Field, Input, Modal, PageHeader, Spinner, cn } from '../components/ui';
import { useTheme, type ThemeMode } from '../lib/theme';
import { useInstallPrompt } from '../lib/pwa';
import { toastError } from '../lib/forms';
import { handleFormError } from '../lib/forms';
import { roleLabel } from '../lib/format';
import { email, password } from '../lib/schemas';
import type { User } from '../lib/types';

const profileSchema = z.object({ name: z.string().trim().min(2, 'Informe o nome'), email });
const pwSchema = z.object({ currentPassword: z.string().min(1, 'Informe a senha atual'), newPassword: password, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { message: 'As senhas não conferem', path: ['confirm'] });

const themeOptions: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Claro', icon: Sun },
  { mode: 'dark', label: 'Escuro', icon: Moon },
  { mode: 'system', label: 'Automático', icon: Monitor },
];

export default function Profile() {
  const { user, setUser, logout, can } = useAuth();
  const { mode, setMode } = useTheme();
  const pwa = useInstallPrompt();
  const [preview, setPreview] = useState<{ html: string; sentTo: string } | null>(null);
  const [sending, setSending] = useState(false);

  const toggleWeekly = async (weeklySummary: boolean) => {
    if (!user) return;
    try {
      const r = await api.patch<{ user: User }>('/auth/me', { name: user.name, email: user.email, weeklySummary });
      setUser(r.user);
      toast.success(weeklySummary ? 'Você vai receber o resumo toda segunda-feira.' : 'Resumo semanal desativado.');
    } catch (e) { toastError(e); }
  };
  const sendPreview = async () => {
    setSending(true);
    try {
      setPreview(await api.post<{ html: string; sentTo: string }>('/emails/weekly-summary/test'));
    } catch (e) { toastError(e); } finally { setSending(false); }
  };
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
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold text-slate-900">Aparência</h2>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema">
            {themeOptions.map((t) => (
              <button key={t.mode} role="radio" aria-checked={mode === t.mode} onClick={() => setMode(t.mode)}
                className={cn('flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm font-medium transition', mode === t.mode ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                <t.icon className="h-5 w-5" /> {t.label}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Aplicativo no celular e no computador</h3>
            {pwa.installed ? <p className="mt-1 text-sm text-emerald-700">Você já está usando o app instalado.</p>
              : pwa.canInstall ? <button className="btn-secondary mt-2" onClick={() => pwa.install()}><Download className="h-4 w-4" /> Instalar Nexus Manager</button>
              : <p className="mt-1 text-sm text-slate-500">{pwa.ios ? 'No iPhone/iPad: toque em Compartilhar e depois em "Adicionar à Tela de Início".' : 'No Android/Chrome: abra o menu do navegador e toque em "Instalar app" ou "Adicionar à tela inicial".'}</p>}
          </div>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold text-slate-900">E-mails</h2>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" checked={user?.weeklySummary ?? true} onChange={(e) => toggleWeekly(e.target.checked)} disabled={!can('ADMIN', 'MANAGER')} />
            <span><span className="font-medium text-slate-800">Resumo semanal de vendas</span><span className="block text-slate-500">Toda segunda-feira às 8h: faturamento, mais vendidos e estoque baixo da semana.{!can('ADMIN', 'MANAGER') && ' Disponível para administradores e gerentes.'}</span></span>
          </label>
          {can('ADMIN', 'MANAGER') && <button className="btn-secondary" onClick={sendPreview} disabled={sending}>{sending ? <Spinner /> : <Mail className="h-4 w-4" />} Enviar prévia para mim</button>}
          <p className="text-xs text-slate-500">Também enviamos e-mails de boas-vindas, convite da equipe e recuperação de senha.</p>
        </section>
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Sessões</h2>
          <p className="mt-1 text-sm text-slate-500">Encerre o acesso em todos os dispositivos onde sua conta está conectada.</p>
          <button className="btn-secondary mt-3" onClick={logoutAll}>Sair de todos os dispositivos</button>
        </section>
      </div>
      <Modal open={!!preview} onClose={() => setPreview(null)} title="Prévia do resumo semanal" size="lg">
        {preview && (
          <>
            <p className="mb-3 text-sm text-slate-500">Enviado para {preview.sentTo}. Sem servidor de e-mail configurado, ele só aparece aqui.</p>
            <iframe title="Prévia do e-mail" srcDoc={preview.html} sandbox="" className="h-[60vh] w-full rounded-lg border border-slate-200 bg-white" />
          </>
        )}
      </Modal>
    </>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { Field, Input, Spinner } from '../../components/ui';
import { handleFormError } from '../../lib/forms';
import { email } from '../../lib/schemas';
import { AuthLayout } from './AuthLayout';

const schema = z.object({ email });
type Form = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [sent, setSent] = useState<{ message: string; resetUrl?: string } | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    try {
      setSent(await api.post('/auth/forgot-password', data));
    } catch (e) {
      handleFormError(e);
    }
  };

  return (
    <AuthLayout title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha.">
      {sent ? (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <MailCheck className="h-5 w-5 shrink-0" />
            <p>{sent.message}</p>
          </div>
          {sent.resetUrl && (
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Modo demonstração</p>
              <p className="mt-0.5">Sem servidor de e-mail configurado, o link aparece aqui:</p>
              <a className="mt-1 block break-all font-medium text-brand-700 underline" href={new URL(sent.resetUrl).pathname + new URL(sent.resetUrl).search}>
                Redefinir minha senha
              </a>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="E-mail" error={errors.email?.message}>
            <Input type="email" autoComplete="email" invalid={!!errors.email} {...register('email')} />
          </Field>
          <button className="btn-primary w-full py-2.5" disabled={isSubmitting}>
            {isSubmitting && <Spinner />} Enviar link
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">Voltar para o login</Link>
      </p>
    </AuthLayout>
  );
}

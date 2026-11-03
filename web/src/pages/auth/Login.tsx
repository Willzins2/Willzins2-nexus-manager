import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../auth/AuthContext';
import { Field, Input, Spinner } from '../../components/ui';
import { errorMessage } from '../../lib/forms';
import { email } from '../../lib/schemas';
import { AuthLayout } from './AuthLayout';

const schema = z.object({ email, password: z.string().min(1, 'Informe a senha') });
type Form = z.infer<typeof schema>;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setError(null);
    try {
      await login(data.email, data.password);
      navigate((location.state as { from?: string })?.from ?? '/', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const fillDemo = () => {
    setValue('email', 'admin@demo.com');
    setValue('password', 'Demo@1234');
  };

  return (
    <AuthLayout title="Entrar" subtitle="Acesse o painel da sua empresa.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</div>}
        <Field label="E-mail" error={errors.email?.message}>
          <Input type="email" autoComplete="email" invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label="Senha" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" invalid={!!errors.password} {...register('password')} />
        </Field>
        <div className="flex justify-end">
          <Link to="/esqueci-senha" className="text-sm font-medium text-brand-600 hover:text-brand-700">Esqueci minha senha</Link>
        </div>
        <button className="btn-primary w-full py-2.5" disabled={isSubmitting}>
          {isSubmitting && <Spinner />} Entrar
        </button>
      </form>
      <div className="mt-6 rounded-lg border border-dashed border-brand-200 bg-brand-50/60 p-3 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Ambiente de demonstração</p>
        <p className="mt-0.5">admin@demo.com · Demo@1234</p>
        <button type="button" onClick={fillDemo} className="mt-1 font-medium text-brand-600 hover:text-brand-700">Preencher dados de acesso</button>
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Ainda não tem conta? <Link to="/cadastro" className="font-medium text-brand-600 hover:text-brand-700">Cadastre sua empresa</Link>
      </p>
    </AuthLayout>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../auth/AuthContext';
import { Field, Input, Spinner } from '../../components/ui';
import { handleFormError } from '../../lib/forms';
import { email, password } from '../../lib/schemas';
import { AuthLayout } from './AuthLayout';

const schema = z
  .object({
    companyName: z.string().trim().min(2, 'Informe o nome da empresa'),
    name: z.string().trim().min(2, 'Informe seu nome'),
    email,
    password,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'As senhas não conferem', path: ['confirm'] });
type Form = z.infer<typeof schema>;

export default function Register() {
  const { register: signup } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ confirm: _c, ...data }: Form) => {
    try {
      await signup(data);
      navigate('/', { replace: true });
    } catch (e) {
      handleFormError(e, setError);
    }
  };

  return (
    <AuthLayout title="Crie sua conta" subtitle="Comece a organizar seu negócio em minutos.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Nome da empresa" error={errors.companyName?.message}>
          <Input autoComplete="organization" invalid={!!errors.companyName} {...register('companyName')} />
        </Field>
        <Field label="Seu nome" error={errors.name?.message}>
          <Input autoComplete="name" invalid={!!errors.name} {...register('name')} />
        </Field>
        <Field label="E-mail" error={errors.email?.message}>
          <Input type="email" autoComplete="email" invalid={!!errors.email} {...register('email')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Senha" error={errors.password?.message}>
            <Input type="password" autoComplete="new-password" invalid={!!errors.password} {...register('password')} />
          </Field>
          <Field label="Confirmar senha" error={errors.confirm?.message}>
            <Input type="password" autoComplete="new-password" invalid={!!errors.confirm} {...register('confirm')} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">Mínimo de 8 caracteres, com letras e números.</p>
        <button className="btn-primary w-full py-2.5" disabled={isSubmitting}>
          {isSubmitting && <Spinner />} Criar conta
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Já tem conta? <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">Entrar</Link>
      </p>
    </AuthLayout>
  );
}

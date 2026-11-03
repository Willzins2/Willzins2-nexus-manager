import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Field, Input, Spinner } from '../../components/ui';
import { handleFormError } from '../../lib/forms';
import { password } from '../../lib/schemas';
import { AuthLayout } from './AuthLayout';

const schema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'As senhas não conferem', path: ['confirm'] });
type Form = z.infer<typeof schema>;

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    try {
      const r = await api.post<{ message: string }>('/auth/reset-password', { token, password: data.password });
      toast.success(r.message);
      navigate('/login', { replace: true });
    } catch (e) {
      handleFormError(e, setError);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Link inválido" subtitle="O link de recuperação está incompleto.">
        <Link to="/esqueci-senha" className="btn-primary w-full">Solicitar novo link</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Nova senha" subtitle="Escolha uma senha forte para sua conta.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Nova senha" error={errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números.">
          <Input type="password" autoComplete="new-password" invalid={!!errors.password} {...register('password')} />
        </Field>
        <Field label="Confirmar nova senha" error={errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" invalid={!!errors.confirm} {...register('confirm')} />
        </Field>
        <button className="btn-primary w-full py-2.5" disabled={isSubmitting}>
          {isSubmitting && <Spinner />} Salvar nova senha
        </button>
      </form>
    </AuthLayout>
  );
}

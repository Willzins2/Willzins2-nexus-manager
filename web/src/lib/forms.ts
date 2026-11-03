import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError } from './api';

/** Erro de limite/recurso do plano (402): toast com atalho para a página de planos. */
const upgradeToast = (err: ApiError) =>
  toast.error(err.message, {
    id: 'plan-limit',
    action: { label: 'Ver planos', onClick: () => window.location.assign('/assinatura') },
  });

/** Mostra qualquer erro da API como toast. */
export function toastError(err: unknown) {
  if (err instanceof ApiError && err.status === 402) return upgradeToast(err);
  toast.error(errorMessage(err));
}

/** Mostra erros da API: campos inválidos no formulário, demais como toast. */
export function handleFormError<T extends FieldValues>(err: unknown, setError?: UseFormSetError<T>) {
  if (err instanceof ApiError && err.details?.length && setError) {
    err.details.forEach((d) => d.field && setError(d.field as Path<T>, { message: d.message }));
  }
  toastError(err);
}

export const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : 'Erro inesperado. Tente novamente.');

import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError } from './api';

/** Mostra erros da API: campos inválidos no formulário, demais como toast. */
export function handleFormError<T extends FieldValues>(err: unknown, setError?: UseFormSetError<T>) {
  if (err instanceof ApiError) {
    if (err.details?.length && setError) {
      err.details.forEach((d) => setError(d.field as Path<T>, { message: d.message }));
      toast.error(err.message);
      return;
    }
    toast.error(err.message);
    return;
  }
  toast.error('Erro inesperado. Tente novamente.');
}

export const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : 'Erro inesperado');

import { forwardRef, useEffect, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Loader2, Search, X, type LucideIcon } from 'lucide-react';

export const cn = clsx;

/* ---------- Formulário ---------- */

export function Field({ label, error, hint, children, className }: { label?: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, invalid, ...p }, ref) => (
  <input ref={ref} className={cn('input', invalid && 'input-error', className)} aria-invalid={invalid || undefined} {...p} />
));

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };
export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, invalid, children, ...p }, ref) => (
  <select ref={ref} className={cn('input pr-8', invalid && 'input-error', className)} {...p}>
    {children}
  </select>
));

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, invalid, ...p }, ref) => (
  <textarea ref={ref} className={cn('input min-h-[84px]', invalid && 'input-error', className)} {...p} />
));

export function SearchInput({ value, onChange, placeholder = 'Buscar...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

/* ---------- Feedback ---------- */

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('h-4 w-4 animate-spin', className)} />;

export function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center text-slate-400">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-medium text-slate-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <p className="text-sm text-rose-700">{message}</p>
      {onRetry && (
        <button className="btn-secondary" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

const tones = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  blue: 'bg-brand-50 text-brand-700 ring-brand-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
};
export type Tone = keyof typeof tones;

export const Badge = ({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) => (
  <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone])}>{children}</span>
);

/* ---------- Layout ---------- */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Pagination({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-500">
      <span>
        {total} registro{total === 1 ? '' : 's'}
      </span>
      <div className="flex items-center gap-1">
        <button className="btn-icon btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 num">
          {page} / {totalPages}
        </span>
        <button className="btn-icon btn-ghost" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Próxima página">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------- Modal ---------- */

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', width)}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button className="btn-icon btn-ghost -mr-2" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', danger, loading, onConfirm, onClose }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Voltar</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={loading}>
            {loading && <Spinner />} {confirmLabel}
          </button>
        </>
      }>
      <div className="text-sm text-slate-600">{message}</div>
    </Modal>
  );
}

/* ---------- Indicadores ---------- */

export function StatCard({ label, value, icon: Icon, hint, trend, tone = 'blue' }: { label: string; value: string; icon: LucideIcon; hint?: ReactNode; trend?: number | null; tone?: 'blue' | 'green' | 'amber' | 'violet' }) {
  const iconTone = { blue: 'bg-brand-50 text-brand-600', green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', violet: 'bg-violet-50 text-violet-600' }[tone];
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-900 num">{value}</p>
        </div>
        <div className={cn('rounded-lg p-2', iconTone)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        {trend !== undefined && trend !== null && (
          <span className={cn('font-medium', trend >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend * 100).toFixed(1).replace('.', ',')}%
          </span>
        )}
        {hint}
      </div>
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

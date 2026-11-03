import type { PaymentMethod, Role, SaleStatus, TaskPriority, TaskStatus } from './types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

export const money = (v: number | null | undefined) => brl.format(Number(v ?? 0));
export const moneyCompact = (v: number) => brlCompact.format(v);
export const int = (v: number) => new Intl.NumberFormat('pt-BR').format(v);
export const percent = (v: number, digits = 1) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: digits }).format(v);

export const date = (v: string | Date | null | undefined) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
export const dateTime = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
/** "AAAA-MM-DD" (sem fuso) → dd/mm */
export const shortDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
};
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export const roleLabel: Record<Role, string> = { ADMIN: 'Administrador', MANAGER: 'Gerente', SELLER: 'Vendedor' };
export const saleStatusLabel: Record<SaleStatus, string> = { PENDING: 'Pendente', PAID: 'Paga', CANCELED: 'Cancelada' };
export const paymentLabel: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BANK_SLIP: 'Boleto',
  TRANSFER: 'Transferência',
};
export const taskStatusLabel: Record<TaskStatus, string> = { TODO: 'A fazer', IN_PROGRESS: 'Em andamento', DONE: 'Concluída' };
export const priorityLabel: Record<TaskPriority, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' };
export const movementLabel = { IN: 'Entrada', OUT: 'Saída', ADJUST: 'Ajuste', SALE: 'Venda', SALE_CANCEL: 'Estorno' } as const;

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

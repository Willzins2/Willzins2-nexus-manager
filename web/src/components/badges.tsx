import { Badge, type Tone } from './ui';
import { priorityLabel, saleStatusLabel } from '../lib/format';
import type { SaleStatus, TaskPriority } from '../lib/types';

const saleTone: Record<SaleStatus, Tone> = { PAID: 'green', PENDING: 'amber', CANCELED: 'red' };
export const SaleStatusBadge = ({ status }: { status: SaleStatus }) => <Badge tone={saleTone[status]}>{saleStatusLabel[status]}</Badge>;

const prioTone: Record<TaskPriority, Tone> = { LOW: 'gray', MEDIUM: 'blue', HIGH: 'red' };
export const PriorityBadge = ({ priority }: { priority: TaskPriority }) => <Badge tone={prioTone[priority]}>{priorityLabel[priority]}</Badge>;

export function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  if (stock <= 0) return <Badge tone="red">Sem estoque</Badge>;
  if (stock <= minStock) return <Badge tone="amber">Estoque baixo</Badge>;
  return <Badge tone="green">Disponível</Badge>;
}

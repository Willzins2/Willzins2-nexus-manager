export type Role = 'ADMIN' | 'MANAGER' | 'SELLER';
export type SaleStatus = 'PENDING' | 'PAID' | 'CANCELED';
export type PaymentMethod = 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_SLIP' | 'TRANSFER';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Paged<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  organizationId: string;
  organization: { id: string; name: string };
  createdAt: string;
  lastLoginAt: string | null;
  weeklySummary: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  company: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  createdAt: string;
  _count?: { sales: number };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  active: boolean;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUST' | 'SALE' | 'SALE_CANCEL';
  quantity: number;
  balance: number;
  reason: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
  sale: { id: string; number: number } | null;
}

export interface SaleItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: { id: string; sku: string };
}

export interface Sale {
  id: string;
  number: number;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  total: number;
  cost: number;
  notes: string | null;
  createdAt: string;
  paidAt: string | null;
  canceledAt: string | null;
  customer: { id: string; name: string; email?: string | null; phone?: string | null } | null;
  user: { id: string; name: string } | null;
  items?: SaleItem[];
  _count?: { items: number };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  assignee: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
}

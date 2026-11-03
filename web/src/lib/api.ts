/** Cliente HTTP da API. Usa cookie httpOnly (credentials: 'include'); nenhum token fica no JavaScript. */

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: FieldError[];
  constructor(status: number, message: string, code?: string, details?: FieldError[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/v1';

type Query = Record<string, string | number | boolean | undefined | null>;

const qs = (query?: Query) => {
  if (!query) return '';
  const p = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs(query)}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique sua conexão.');
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized?.();
    const err = data?.error ?? {};
    throw new ApiError(res.status, err.message ?? 'Erro inesperado', err.code, Array.isArray(err.details) ? err.details : undefined);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  url: (path: string, query?: Query) => `${BASE}${path}${qs(query)}`,
};

/** Erro de domínio com status HTTP e código legível por máquina. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'APP_ERROR',
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new AppError(400, msg, 'BAD_REQUEST', details);
export const unauthorized = (msg = 'Não autenticado') => new AppError(401, msg, 'UNAUTHORIZED');
export const forbidden = (msg = 'Você não tem permissão para esta ação') => new AppError(403, msg, 'FORBIDDEN');
export const notFound = (entity = 'Recurso') => new AppError(404, `${entity} não encontrado`, 'NOT_FOUND');
export const conflict = (msg: string) => new AppError(409, msg, 'CONFLICT');
export const unprocessable = (msg: string, details?: unknown) => new AppError(422, msg, 'UNPROCESSABLE', details);

import 'dotenv/config';
import { z } from 'zod';

/**
 * Variáveis de ambiente validadas na inicialização.
 * Se algo obrigatório estiver faltando, a aplicação nem sobe (fail fast).
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter ao menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().optional(), // lista separada por vírgula
  // SMTP opcional: sem ele, o link de recuperação é registrado no log do servidor.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Nexus Manager <no-reply@nexus.local>'),
  // Cobrança (Asaas). Sem chave, a assinatura funciona em modo simulado (somente DEMO_MODE/desenvolvimento).
  ASAAS_API_KEY: z.string().optional(),
  ASAAS_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  ASAAS_WEBHOOK_TOKEN: z.string().optional(),
  TRIAL_DAYS: z.coerce.number().int().min(0).max(90).default(14),
  // Resumo semanal: liga o agendador interno (segunda-feira, 8h de Brasília).
  WEEKLY_SUMMARY_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
  // SOMENTE para ambientes de demonstração: devolve o link de recuperação na resposta da API.
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

// No Render, a URL pública vem em RENDER_EXTERNAL_URL: usada quando APP_URL não foi definida.
const parsed = schema.safeParse({ ...process.env, APP_URL: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || undefined });
if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

import { env } from './config/env';
import { createApp } from './app';
import { prisma } from './lib/prisma';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.info(`🚀 Nexus Manager API em http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
});

// Encerramento gracioso (deploys/reinícios do provedor).
const shutdown = async (signal: string) => {
  console.info(`${signal} recebido, encerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

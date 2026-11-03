/** Execução avulsa do resumo semanal (ex.: Cron Job do Render): node dist/jobs/weekly-summary.js */
import { prisma } from '../lib/prisma';
import { runWeeklySummaries } from '../modules/emails/weekly-summary';

runWeeklySummaries()
  .then((r) => console.info('[weekly-summary]', r))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import { execSync } from 'node:child_process';

/** Aplica as migrations no banco de teste antes da suíte. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus_test';
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  });
}

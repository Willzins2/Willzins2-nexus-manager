import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './tests/global-setup.ts',
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus_test',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123',
      DEMO_MODE: 'true',
      ASAAS_WEBHOOK_TOKEN: 'test-webhook-token',
      WEEKLY_SUMMARY_ENABLED: 'false',
    },
  },
});

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/lib/prisma';
import { app, newTenant } from './helpers';
import { currentSlot, buildWeeklyData } from '../src/modules/emails/weekly-summary';

const expireTrial = (orgId: string) =>
  prisma.organization.update({ where: { id: orgId }, data: { trialEndsAt: new Date(Date.now() - 1000) } });

describe('Planos e assinatura', () => {
  it('empresa nova começa com 14 dias de teste do Profissional', async () => {
    const { agent } = await newTenant();
    const r = await agent.get('/api/v1/billing');
    expect(r.body.status).toBe('TRIALING');
    expect(r.body.effectivePlan).toBe('PRO');
    expect(r.body.trialDaysLeft).toBe(14);
    expect(r.body.plans).toHaveLength(4);
  });

  it('teste expirado cai para o Grátis: bloqueia relatórios, tarefas e limita usuários', async () => {
    const { agent, user } = await newTenant();
    await expireTrial(user.organizationId);
    expect((await agent.get('/api/v1/billing')).body.effectivePlan).toBe('FREE');

    const rep = await agent.get('/api/v1/reports/summary');
    expect(rep.status).toBe(402);
    expect(rep.body.error.code).toBe('PLAN_FEATURE');
    expect((await agent.get('/api/v1/tasks')).status).toBe(402);

    const u = await agent.post('/api/v1/users').send({ name: 'Extra', email: `x${Date.now()}@t.com`, role: 'SELLER', password: 'Senha1234' });
    expect(u.status).toBe(402);
    expect(u.body.error.code).toBe('PLAN_LIMIT');
  });

  it('assinatura simulada ativa o plano na hora e o cancelamento mantém até o fim do período', async () => {
    const { agent, user } = await newTenant();
    await expireTrial(user.organizationId);
    const sub = await agent.post('/api/v1/billing/subscribe').send({ plan: 'ESSENTIAL', cycle: 'YEARLY' });
    expect(sub.body.mode).toBe('simulated');

    const b = (await agent.get('/api/v1/billing')).body;
    expect(b.status).toBe('ACTIVE');
    expect(b.effectivePlan).toBe('ESSENTIAL');
    expect((await agent.get('/api/v1/reports/summary')).status).toBe(200);
    expect((await agent.get('/api/v1/tasks')).status).toBe(402); // tarefas só no Profissional

    const c = await agent.post('/api/v1/billing/cancel');
    expect(c.body.status).toBe('CANCELED');
    expect(c.body.effectivePlan).toBe('ESSENTIAL');
  });

  it('limite de produtos do Grátis', async () => {
    const { agent, user } = await newTenant();
    await expireTrial(user.organizationId);
    await prisma.product.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({ organizationId: user.organizationId, sku: `P${i}`, name: `Produto ${i}`, price: 1 })),
    });
    const r = await agent.post('/api/v1/products').send({ sku: 'NOVO', name: 'Mais um', price: 10 });
    expect(r.status).toBe(402);
  });

  it('webhook do Asaas exige token e é idempotente', async () => {
    const { user } = await newTenant();
    await prisma.organization.update({ where: { id: user.organizationId }, data: { billingSubscriptionId: `sub_${user.organizationId}`, pendingPlan: 'BUSINESS' } });
    const evt = { id: `evt_${Date.now()}`, event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1', subscription: `sub_${user.organizationId}`, dueDate: '2026-11-03' } };

    expect((await request(app).post('/api/v1/billing/webhook/asaas').send(evt)).status).toBe(401);

    const ok = await request(app).post('/api/v1/billing/webhook/asaas').set('asaas-access-token', 'test-webhook-token').send(evt);
    expect(ok.body.processed).toBe(true);
    const again = await request(app).post('/api/v1/billing/webhook/asaas').set('asaas-access-token', 'test-webhook-token').send(evt);
    expect(again.body.duplicate).toBe(true);

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
    expect(org.subscriptionStatus).toBe('ACTIVE');
    expect(org.plan).toBe('BUSINESS');
    expect(org.currentPeriodEnd?.toISOString().slice(0, 10)).toBe('2026-12-03');
  });
});

describe('Importação de planilhas', () => {
  it('clientes: cabeçalhos em português, prévia com erros e gravação só das linhas válidas', async () => {
    const { agent } = await newTenant();
    const rows = [
      { Nome: 'Ana Souza', 'E-mail': 'ana@x.com', Telefone: '(11) 98888-7777', UF: 'sp' },
      { Nome: '', 'E-mail': 'sem-nome@x.com' },
      { Nome: 'Bruno Lima', 'E-mail': 'ana@x.com' }, // e-mail repetido na planilha
      { Nome: 'Carla Dias', 'CPF/CNPJ': '123' },
    ];
    const preview = await agent.post('/api/v1/import/customers').send({ rows, dryRun: true });
    expect(preview.body.valid).toBe(1);
    expect(preview.body.created).toBe(0);
    expect(preview.body.errors.map((e: { row: number }) => e.row)).toEqual([3, 4, 5]);

    const done = await agent.post('/api/v1/import/customers').send({ rows, dryRun: false });
    expect(done.body.created).toBe(1);
    const list = await agent.get('/api/v1/customers');
    expect(list.body.data[0]).toMatchObject({ name: 'Ana Souza', state: 'SP' });
  });

  it('produtos: aceita "R$ 1.234,56", cria com movimento de estoque e atualiza por SKU', async () => {
    const { agent } = await newTenant();
    const first = await agent.post('/api/v1/import/products').send({
      dryRun: false,
      rows: [{ Código: 'cam-01', Produto: 'Camiseta', Preço: 'R$ 1.234,56', Custo: '10,5', Estoque: '7' }],
    });
    expect(first.body.created).toBe(1);
    const p = (await agent.get('/api/v1/products')).body.data[0];
    expect(p).toMatchObject({ sku: 'CAM-01', price: 1234.56, cost: 10.5, stock: 7 });
    expect((await agent.get(`/api/v1/products/${p.id}/movements`)).body[0].reason).toBe('Importação de planilha');

    const second = await agent.post('/api/v1/import/products').send({ dryRun: false, rows: [{ sku: 'CAM-01', nome: 'Camiseta Azul', preco: '99', estoque: '500' }] });
    expect(second.body.updated).toBe(1);
    const p2 = (await agent.get(`/api/v1/products/${p.id}`)).body;
    expect(p2).toMatchObject({ name: 'Camiseta Azul', price: 99, stock: 7 }); // estoque não muda na atualização
  });
});

describe('Boas-vindas e e-mails', () => {
  it('primeiros passos refletem os dados e podem ser dispensados', async () => {
    const { agent } = await newTenant();
    let ob = (await agent.get('/api/v1/onboarding')).body;
    expect(ob.completed).toBe(false);
    await agent.post('/api/v1/products').send({ sku: 'A1', name: 'Produto A', price: 10, stock: 5 });
    ob = (await agent.get('/api/v1/onboarding')).body;
    expect(ob.steps.find((s: { id: string }) => s.id === 'product').done).toBe(true);
    await agent.post('/api/v1/onboarding/dismiss');
    expect((await agent.get('/api/v1/onboarding')).body.dismissed).toBe(true);
  });

  it('resumo semanal: números da semana e prévia do e-mail', async () => {
    const { agent, user } = await newTenant();
    const p = (await agent.post('/api/v1/products').send({ sku: 'W1', name: 'Item Semanal', price: 50, stock: 10, minStock: 9 })).body;
    await agent.post('/api/v1/sales').send({ items: [{ productId: p.id, quantity: 2 }] });

    const data = await buildWeeklyData(user.organizationId);
    expect(data.revenue).toBe(100);
    expect(data.topProducts[0].name).toBe('Item Semanal');
    expect(data.lowStock[0].name).toBe('Item Semanal');

    const r = await agent.post('/api/v1/emails/weekly-summary/test');
    expect(r.body.html).toContain('Item Semanal');
  });

  it('agendamento: segunda-feira 8h de Brasília', () => {
    // quarta, 5/nov/2026 15:00 UTC → segunda 2/nov 11:00 UTC (08:00 BRT)
    expect(currentSlot(new Date('2026-11-05T15:00:00Z')).toISOString()).toBe('2026-11-02T11:00:00.000Z');
    // segunda 07:00 BRT ainda pertence à semana anterior? Não: o slot é o da própria semana, ainda no futuro.
    expect(currentSlot(new Date('2026-11-02T10:00:00Z')).toISOString()).toBe('2026-11-02T11:00:00.000Z');
  });

  it('preferência de resumo semanal no perfil', async () => {
    const { agent, email } = await newTenant();
    const r = await agent.patch('/api/v1/auth/me').send({ name: 'Admin Teste', email, weeklySummary: false });
    expect(r.body.user.weeklySummary).toBe(false);
  });
});

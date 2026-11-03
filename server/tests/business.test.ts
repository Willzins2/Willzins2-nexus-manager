import { describe, expect, it } from 'vitest';
import { newTenant } from './helpers';

const product = (over: Record<string, unknown> = {}) => ({
  sku: `SKU-${Math.random().toString(36).slice(2, 8)}`,
  name: 'Produto Teste',
  price: 100,
  cost: 60,
  stock: 10,
  minStock: 2,
  ...over,
});

describe('Clientes', () => {
  it('CRUD completo e isolamento entre empresas', async () => {
    const a = await newTenant();
    const b = await newTenant();

    const created = await a.agent.post('/api/v1/customers').send({ name: 'Maria Cliente', email: 'maria@x.com', phone: '(11) 99999-0000', state: 'sp' });
    expect(created.status).toBe(201);
    expect(created.body.state).toBe('SP');

    const upd = await a.agent.put(`/api/v1/customers/${created.body.id}`).send({ name: 'Maria Atualizada' });
    expect(upd.body.name).toBe('Maria Atualizada');

    // outra empresa não enxerga
    const other = await b.agent.get(`/api/v1/customers/${created.body.id}`);
    expect(other.status).toBe(404);

    const list = await a.agent.get('/api/v1/customers?search=maria');
    expect(list.body.meta.total).toBe(1);

    const del = await a.agent.delete(`/api/v1/customers/${created.body.id}`);
    expect(del.status).toBe(204);
  });
});

describe('Produtos e estoque', () => {
  it('registra movimentações e impede saldo negativo', async () => {
    const { agent } = await newTenant();
    const p = (await agent.post('/api/v1/products').send(product())).body;
    expect(p.stock).toBe(10);

    const out = await agent.post(`/api/v1/products/${p.id}/movements`).send({ type: 'OUT', quantity: 4, reason: 'Perda' });
    expect(out.body.product.stock).toBe(6);

    const tooMuch = await agent.post(`/api/v1/products/${p.id}/movements`).send({ type: 'OUT', quantity: 50 });
    expect(tooMuch.status).toBe(422);

    const adj = await agent.post(`/api/v1/products/${p.id}/movements`).send({ type: 'ADJUST', quantity: 1 });
    expect(adj.body.product.stock).toBe(1);

    const low = await agent.get('/api/v1/products?stock=low');
    expect(low.body.data.map((x: { id: string }) => x.id)).toContain(p.id);

    const hist = await agent.get(`/api/v1/products/${p.id}/movements`);
    expect(hist.body).toHaveLength(3); // inicial + saída + ajuste
  });

  it('SKU duplicado retorna 409', async () => {
    const { agent } = await newTenant();
    await agent.post('/api/v1/products').send(product({ sku: 'DUP-1' }));
    const res = await agent.post('/api/v1/products').send(product({ sku: 'dup-1' }));
    expect(res.status).toBe(409);
  });
});

describe('Vendas', () => {
  it('baixa estoque, calcula totais e devolve estoque ao cancelar', async () => {
    const { agent } = await newTenant();
    const p = (await agent.post('/api/v1/products').send(product({ price: 50, cost: 20, stock: 5 }))).body;

    const sale = await agent.post('/api/v1/sales').send({ items: [{ productId: p.id, quantity: 3 }], discount: 10, paymentMethod: 'PIX' });
    expect(sale.status).toBe(201);
    expect(sale.body.number).toBe(1);
    expect(sale.body.subtotal).toBe(150);
    expect(sale.body.total).toBe(140);
    expect(sale.body.cost).toBe(60);
    expect((await agent.get(`/api/v1/products/${p.id}`)).body.stock).toBe(2);

    const insufficient = await agent.post('/api/v1/sales').send({ items: [{ productId: p.id, quantity: 3 }] });
    expect(insufficient.status).toBe(422);
    expect(insufficient.body.error.details[0].field).toBe('items.0.quantity');

    const cancel = await agent.patch(`/api/v1/sales/${sale.body.id}/status`).send({ status: 'CANCELED' });
    expect(cancel.body.status).toBe('CANCELED');
    expect((await agent.get(`/api/v1/products/${p.id}`)).body.stock).toBe(5);
  });

  it('desconto maior que o subtotal é rejeitado', async () => {
    const { agent } = await newTenant();
    const p = (await agent.post('/api/v1/products').send(product({ price: 10 }))).body;
    const res = await agent.post('/api/v1/sales').send({ items: [{ productId: p.id, quantity: 1 }], discount: 50 });
    expect(res.status).toBe(422);
  });

  it('reflete no dashboard e no relatório', async () => {
    const { agent } = await newTenant();
    const p = (await agent.post('/api/v1/products').send(product({ price: 200, cost: 50 }))).body;
    await agent.post('/api/v1/sales').send({ items: [{ productId: p.id, quantity: 2 }] });

    const dash = await agent.get('/api/v1/dashboard');
    expect(dash.body.kpis.revenueMonth).toBe(400);
    expect(dash.body.salesByDay).toHaveLength(30);

    const rep = await agent.get('/api/v1/reports/summary');
    expect(rep.body.totals.grossProfit).toBe(300);
    expect(rep.body.totals.margin).toBeCloseTo(0.75);

    const csv = await agent.get('/api/v1/reports/sales.csv');
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('Número;Data');
  });
});

describe('Usuários e permissões', () => {
  it('vendedor não acessa relatórios, gestão de usuários nem cria produtos', async () => {
    const { agent } = await newTenant();
    const created = await agent.post('/api/v1/users').send({ name: 'Vendedor', email: `v${Date.now()}@t.com`, role: 'SELLER', password: 'Senha1234' });
    expect(created.status).toBe(201);

    const { default: request } = await import('supertest');
    const { app } = await import('./helpers');
    const seller = request.agent(app);
    await seller.post('/api/v1/auth/login').send({ email: created.body.email, password: 'Senha1234' });

    expect((await seller.get('/api/v1/reports/summary')).status).toBe(403);
    expect((await seller.get('/api/v1/users')).status).toBe(403);
    expect((await seller.post('/api/v1/products').send(product())).status).toBe(403);
    expect((await seller.get('/api/v1/customers')).status).toBe(200);
  });

  it('não permite remover o último administrador', async () => {
    const { agent, user } = await newTenant();
    const res = await agent.patch(`/api/v1/users/${user.id}`).send({ role: 'SELLER' });
    expect(res.status).toBe(422);
  });

  it('desativar usuário derruba a sessão dele', async () => {
    const { agent } = await newTenant();
    const u = (await agent.post('/api/v1/users').send({ name: 'Temp', email: `t${Date.now()}@t.com`, role: 'MANAGER', password: 'Senha1234' })).body;
    const { default: request } = await import('supertest');
    const { app } = await import('./helpers');
    const login = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: 'Senha1234' });
    await agent.patch(`/api/v1/users/${u.id}`).send({ active: false });
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(401);
  });
});

describe('Tarefas', () => {
  it('cria, move no quadro e conclui', async () => {
    const { agent, user } = await newTenant();
    const t = await agent.post('/api/v1/tasks').send({ title: 'Ligar para cliente', priority: 'HIGH', dueDate: '2030-01-10', assigneeId: user.id });
    expect(t.status).toBe(201);
    const done = await agent.patch(`/api/v1/tasks/${t.body.id}/status`).send({ status: 'DONE' });
    expect(done.body.completedAt).not.toBeNull();
    const mine = await agent.get('/api/v1/tasks?mine=true');
    expect(mine.body).toHaveLength(1);
  });

  it('rejeita responsável de outra empresa', async () => {
    const a = await newTenant();
    const b = await newTenant();
    const res = await a.agent.post('/api/v1/tasks').send({ title: 'Teste', assigneeId: b.user.id });
    expect(res.status).toBe(422);
  });
});

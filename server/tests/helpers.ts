import request from 'supertest';
import { createApp } from '../src/app';

export const app = createApp();
let n = 0;

/** Cria uma empresa nova e devolve um agente autenticado (cookie) como ADMIN. */
export async function newTenant() {
  const agent = request.agent(app);
  const email = `admin${Date.now()}${n++}@teste.com`;
  const res = await agent
    .post('/api/v1/auth/register')
    .send({ companyName: 'Empresa Teste', name: 'Admin Teste', email, password: 'Senha1234' });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return { agent, email, user: res.body.user, token: res.body.token as string };
}

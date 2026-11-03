import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, newTenant } from './helpers';

describe('Autenticação', () => {
  it('cadastra empresa + admin e retorna o usuário sem a senha', async () => {
    const { user } = await newTenant();
    expect(user.role).toBe('ADMIN');
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('rejeita senha fraca com erro de validação por campo', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ companyName: 'X Ltda', name: 'Fulano', email: 'fraca@teste.com', password: '123' });
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('password');
  });

  it('não permite e-mail duplicado', async () => {
    const { email } = await newTenant();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ companyName: 'Outra', name: 'Fulano', email, password: 'Senha1234' });
    expect(res.status).toBe(409);
  });

  it('login com senha errada retorna 401 genérico', async () => {
    const { email } = await newTenant();
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'Errada123' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('E-mail ou senha incorretos');
  });

  it('bloqueia rotas protegidas sem token', async () => {
    const res = await request(app).get('/api/v1/customers');
    expect(res.status).toBe(401);
  });

  it('aceita token via header Bearer', async () => {
    const { token } = await newTenant();
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('fluxo completo de recuperação de senha invalida a sessão antiga', async () => {
    const { email, token } = await newTenant();
    const forgot = await request(app).post('/api/v1/auth/forgot-password').send({ email });
    expect(forgot.status).toBe(200);
    const resetToken = new URL(forgot.body.resetUrl).searchParams.get('token');

    const reset = await request(app).post('/api/v1/auth/reset-password').send({ token: resetToken, password: 'NovaSenha99' });
    expect(reset.status).toBe(200);

    // token de uso único
    const again = await request(app).post('/api/v1/auth/reset-password').send({ token: resetToken, password: 'OutraSenha99' });
    expect(again.status).toBe(400);

    // JWT emitido antes da troca deixa de valer
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(401);

    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'NovaSenha99' });
    expect(login.status).toBe(200);
  });

  it('forgot-password não revela se o e-mail existe', async () => {
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'ninguem@teste.com' });
    expect(res.status).toBe(200);
    expect(res.body.resetUrl).toBeUndefined();
  });
});

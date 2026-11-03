# API REST — Nexus Manager

Base: `/api/v1` · JSON · datas em ISO 8601 · valores monetários como número (2 casas).

**Autenticação:** cookie httpOnly `nexus_token` (definido no login) **ou** header `Authorization: Bearer <token>` (o token também volta no corpo do login/cadastro).

**Erros** (todos no mesmo formato):

| Status | `code` | Quando |
|---|---|---|
| 400 | `BAD_REQUEST` | JSON malformado, link de recuperação inválido |
| 401 | `UNAUTHORIZED` | sem sessão, sessão expirada/revogada, credenciais erradas |
| 403 | `FORBIDDEN` | perfil sem permissão |
| 404 | `NOT_FOUND` | recurso inexistente (ou de outra empresa) |
| 409 | `CONFLICT` | e-mail/SKU duplicado |
| 422 | `VALIDATION_ERROR` / `UNPROCESSABLE` | dados inválidos (com `details[]` por campo) ou regra de negócio (ex.: estoque insuficiente) |
| 429 | `TOO_MANY_REQUESTS` | excesso de tentativas de login |

**Listagens paginadas** aceitam `page`, `pageSize` (máx. 100), `search` e respondem `{ data: [...], meta: { page, pageSize, total, totalPages } }`.

Perfis: **A** = Administrador, **G** = Gerente, **V** = Vendedor.

## Auth

| Método | Rota | Perfis | Corpo / observações |
|---|---|---|---|
| POST | `/auth/register` | público | `{ companyName, name, email, password }` → cria empresa + ADMIN |
| POST | `/auth/login` | público | `{ email, password }` → `{ user, token }` |
| POST | `/auth/logout` | — | limpa o cookie |
| POST | `/auth/logout-all` | todos | revoga todas as sessões do usuário |
| POST | `/auth/forgot-password` | público | `{ email }` → resposta sempre igual; `resetUrl` só com `DEMO_MODE=true` |
| POST | `/auth/reset-password` | público | `{ token, password }` |
| GET | `/auth/me` | todos | usuário logado + empresa |
| PATCH | `/auth/me` | todos | `{ name, email }` |
| POST | `/auth/me/password` | todos | `{ currentPassword, newPassword }` |

## Dashboard

| GET | `/dashboard` | todos | `kpis`, `salesByDay` (30 dias), `topProducts`, `byPaymentMethod`, `recentSales`, `lowStockProducts` |
|---|---|---|---|

## Clientes

| Método | Rota | Perfis | Observações |
|---|---|---|---|
| GET | `/customers` | todos | `search` (nome, e-mail, empresa, telefone, documento), `sort=name\|createdAt` |
| GET | `/customers/:id` | todos | inclui últimas vendas e `stats.totalSpent` |
| POST | `/customers` | todos | `{ name*, email, phone, document (CPF/CNPJ), company, address, city, state (UF), notes }` |
| PUT | `/customers/:id` | todos | mesmo corpo |
| DELETE | `/customers/:id` | A, G | vendas são preservadas sem o vínculo |

## Produtos e estoque

| Método | Rota | Perfis | Observações |
|---|---|---|---|
| GET | `/products` | todos | filtros `category`, `stock=all\|low\|out`, `active=all\|true\|false` |
| GET | `/products/categories` | todos | lista de categorias existentes |
| GET | `/products/:id` | todos | |
| POST | `/products` | A, G | `{ sku*, name*, price*, cost, category, description, minStock, active, stock }` (`stock` = estoque inicial) |
| PUT | `/products/:id` | A, G | mesmo corpo, **sem** `stock` (estoque só muda por movimentação) |
| DELETE | `/products/:id` | A, G | exclui; se já houver vendas, **desativa** → `{ deleted, deactivated }` |
| GET | `/products/:id/movements` | todos | últimas 100 movimentações |
| POST | `/products/:id/movements` | A, G | `{ type: IN\|OUT\|ADJUST, quantity, reason }` — `ADJUST` define o saldo absoluto |

## Vendas

| Método | Rota | Perfis | Observações |
|---|---|---|---|
| GET | `/sales` | todos | filtros `status`, `customerId`, `from`, `to` (AAAA-MM-DD), `search` (nº ou cliente); traz `summary.total` |
| GET | `/sales/:id` | todos | itens, cliente, vendedor |
| POST | `/sales` | todos | `{ items: [{ productId, quantity, unitPrice? }], customerId?, paymentMethod, status: PAID\|PENDING, discount, notes }` |
| PATCH | `/sales/:id/status` | todos / A, G | `{ status: PAID }` (todos) · `{ status: CANCELED }` (A, G; devolve estoque) |

`paymentMethod`: `CASH`, `PIX`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_SLIP`, `TRANSFER`.

Exemplo:

```bash
curl -X POST https://<host>/api/v1/sales \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"cmw...","quantity":2}],"paymentMethod":"PIX","discount":5}'
```

## Relatórios (A, G)

| GET | `/reports/summary?from=&to=` | totais, `byMonth`, `byProduct`, `bySeller`, `byCustomer`, `byPaymentMethod`, `byCategory` (padrão: últimos 6 meses) |
|---|---|---|
| GET | `/reports/sales.csv?from=&to=` | exportação CSV (`;`, UTF-8 com BOM — abre direto no Excel) |

## Tarefas

| Método | Rota | Observações |
|---|---|---|
| GET | `/tasks` | `mine=true`, `assigneeId`, `search` |
| POST | `/tasks` | `{ title*, description, status, priority: LOW\|MEDIUM\|HIGH, dueDate, assigneeId, customerId }` |
| PUT | `/tasks/:id` | mesmo corpo |
| PATCH | `/tasks/:id/status` | `{ status: TODO\|IN_PROGRESS\|DONE }` |
| DELETE | `/tasks/:id` | |

## Usuários

| Método | Rota | Perfis | Observações |
|---|---|---|---|
| GET | `/users/options` | todos | `[{ id, name }]` para seleção |
| GET | `/users` | A | |
| POST | `/users` | A | `{ name, email, role, password }` |
| PATCH | `/users/:id` | A | `{ name?, role?, active?, password? }` — sempre mantém ≥ 1 admin ativo |
| DELETE | `/users/:id` | A | não permite excluir a si mesmo |

## Saúde

`GET /health` → `{ status: "ok" }` (verifica conexão com o banco).

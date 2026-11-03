# Nexus Manager

SaaS de gestão empresarial para pequenos negócios: **clientes, vendas, produtos e estoque, tarefas da equipe e resultados financeiros** em um único lugar, com várias empresas (multi-tenant) isoladas no mesmo sistema.

> **Demo:** `admin@demo.com` / `Demo@1234` (também `gerente@demo.com` e `vendedor@demo.com`, mesma senha, para ver os perfis de acesso).

## Funcionalidades

| Módulo | O que entrega |
|---|---|
| **Autenticação** | Cadastro da empresa + administrador, login, recuperação de senha por link de uso único (30 min), troca de senha, "sair de todos os dispositivos" |
| **Dashboard** | Faturamento, lucro bruto, nº de vendas, ticket médio, valores a receber (com variação vs. mesmo período do mês anterior), gráfico diário de 30 dias, mais vendidos, alertas de estoque baixo, formas de pagamento |
| **Clientes** | Cadastro, edição, exclusão, busca, paginação; ficha com total comprado e histórico |
| **Produtos** | Catálogo com SKU, categoria, preço, custo e margem; estoque mínimo; movimentações (entrada, saída, inventário) com histórico e saldo; filtros de estoque baixo/zerado |
| **Vendas** | PDV com busca de produtos e clientes, preço negociado, desconto, forma de pagamento; baixa automática de estoque; status pendente → paga; cancelamento com estorno de estoque; impressão |
| **Relatórios** | Período livre ou atalhos (mês, 3, 6, 12 meses): faturamento, custo, lucro bruto, margem, ticket médio, cancelamentos; faturamento × lucro por mês; ranking de produtos, clientes, vendedores, categorias e formas de pagamento; **exportação CSV** |
| **Tarefas** | Quadro kanban (a fazer / em andamento / concluída) com arrastar e soltar, prioridade, prazo (destaque de atraso), responsável e cliente relacionado |
| **Usuários** | Gestão da equipe com perfis **Administrador, Gerente e Vendedor**; ativar/desativar; matriz de permissões |

## Stack e justificativa

| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem | **TypeScript** (front e back) | Um só idioma no projeto, tipos compartilham o mesmo vocabulário e pegam erros antes de rodar. Facilita manutenção por equipes pequenas. |
| API | **Node.js 22 + Express** | Maduro, simples, enorme ecossistema e fácil de contratar. Organização por módulos de domínio (rotas → schemas → serviços). |
| Banco | **PostgreSQL** | Relacional e transacional: vendas e estoque precisam de consistência (transações + `SELECT … FOR UPDATE`). Agregações de relatório direto em SQL. Disponível em qualquer provedor. |
| ORM | **Prisma** | Schema declarativo como fonte de verdade, migrations versionadas, consultas tipadas e SQL parametrizado (sem injeção). |
| Validação | **Zod** | Mesma biblioteca no back e no front; regras de negócio escritas uma vez, mensagens em português por campo. |
| Autenticação | **JWT em cookie httpOnly + bcrypt** | Token inacessível ao JavaScript (mitiga XSS), `SameSite=Lax` (mitiga CSRF), `Secure` em produção. Versão do token no banco permite revogar sessões. Também aceita `Authorization: Bearer` para integrações. |
| Frontend | **React 19 + Vite + Tailwind CSS** | SPA rápida, build pequeno com divisão de código por página, design consistente e responsivo sem CSS solto. |
| Dados no front | **TanStack Query + React Hook Form** | Cache, revalidação e atualizações otimistas; formulários performáticos com validação Zod. |
| Gráficos | **Recharts** | Declarativo, responsivo, com tooltip. |
| Testes | **Vitest + Supertest** | Testes de integração da API contra um PostgreSQL real. |
| Deploy | **Render (Blueprint)** ou **Docker** | Um único serviço serve API e frontend (mesma origem: sem CORS, cookie simples). `render.yaml` cria banco + app; `Dockerfile` roda em qualquer lugar (Railway, Fly.io, VPS). |

## Arquitetura

```
nexus-manager/
├── server/                 API REST (Express + Prisma)
│   ├── prisma/             schema.prisma + migrations
│   ├── src/
│   │   ├── config/env.ts   variáveis de ambiente validadas (falha cedo)
│   │   ├── lib/            prisma, erros de domínio, paginação, e-mail
│   │   ├── middleware/     auth (JWT + papéis), validate (Zod), error handler
│   │   ├── modules/        um diretório por domínio
│   │   │   └── <módulo>/   *.routes.ts · *.schemas.ts · *.service.ts
│   │   ├── app.ts          monta a aplicação (segurança, rotas, frontend)
│   │   ├── server.ts       inicialização e encerramento gracioso
│   │   └── seed.ts         dados de demonstração
│   └── tests/              testes de integração
├── web/                    SPA React
│   └── src/
│       ├── auth/           contexto de sessão
│       ├── components/     UI base, layout, gráficos
│       ├── lib/            cliente HTTP, formatação pt-BR, tipos
│       └── pages/          uma página por módulo
├── docs/                   API.md, DATABASE.md
├── render.yaml · Dockerfile · docker-compose.yml
```

Fluxo de uma requisição: `rota → requireAuth → requireRole → validate(Zod) → serviço (regras + Prisma) → JSON`. Qualquer erro vira uma resposta padronizada:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dados inválidos", "details": [{ "field": "email", "message": "E-mail inválido" }] } }
```

Mais detalhes: [docs/API.md](docs/API.md) (endpoints) e [docs/DATABASE.md](docs/DATABASE.md) (modelo de dados).

## Segurança

- Senhas com **bcrypt** (custo 12); política mínima de 8 caracteres com letras e números.
- **Rate limit** nas rotas públicas de autenticação (20 tentativas / 15 min por IP).
- Mensagem de login genérica e recuperação de senha que não revela se o e-mail existe.
- Token de recuperação aleatório (256 bits), salvo apenas como **hash SHA-256**, uso único, expira em 30 min.
- Troca/redefinição de senha, mudança de papel e desativação **revogam as sessões** existentes.
- **Isolamento multi-tenant**: todo acesso filtra pela organização do usuário; referências cruzadas são rejeitadas.
- Permissões verificadas **na API** (o front apenas esconde o que o usuário não pode usar).
- `helmet` (CSP e cabeçalhos), CORS restrito, limite de 1 MB no corpo, CSV protegido contra injeção de fórmulas.
- Estoque e numeração de vendas com transação + lock de linha (sem venda dupla do último item).

## Rodando localmente

Pré-requisitos: Node.js 20+ e PostgreSQL 14+ (ou Docker).

**Opção A — Docker (mais simples)**

```bash
docker compose up --build
docker compose exec app node server/dist/seed.js   # dados de demonstração
# abra http://localhost:3333
```

**Opção B — desenvolvimento**

```bash
npm run install:all
cp server/.env.example server/.env        # ajuste DATABASE_URL e JWT_SECRET
cd server && npx prisma migrate dev && npm run seed && cd ..
npm run dev:server                        # API em http://localhost:3333/api/v1
npm run dev:web                           # app em http://localhost:5173
```

**Testes**

```bash
# usa TEST_DATABASE_URL (padrão: postgresql://nexus:nexus@localhost:5432/nexus_test)
npm test
```

## Deploy (Render)

1. Suba este repositório para o GitHub.
2. No Render: **New → Blueprint** → selecione o repositório. O `render.yaml` cria o PostgreSQL e o serviço web.
3. Ajuste `APP_URL` para a URL gerada (ex.: `https://nexus-manager.onrender.com`).
4. O start (`npm run start:demo`) aplica as migrations e cria a empresa de demonstração se ela não existir.

Para produção real: remova `DEMO_MODE`, configure `SMTP_*` para enviar os e-mails de recuperação, e use `npm start` (sem seed).

> O plano gratuito do Render hiberna após 15 min sem acesso (a primeira requisição leva ~1 min) e o banco gratuito expira em 30 dias.

## Variáveis de ambiente

Veja [`server/.env.example`](server/.env.example). Obrigatórias: `DATABASE_URL`, `JWT_SECRET` (≥ 32 caracteres).

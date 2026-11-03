/**
 * Popula o banco com uma empresa de demonstração.
 * Uso: npm run seed   (apaga e recria SOMENTE a organização de demonstração)
 */
import { Prisma, PaymentMethod, SaleStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';

const DEMO_EMAIL = 'admin@demo.com';
export const DEMO_PASSWORD = 'Demo@1234';

// PRNG determinístico: a demo fica igual a cada execução.
let s = 42;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

const firstNames = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Larissa', 'Marcos', 'Natália', 'Otávio', 'Paula', 'Rafael', 'Sofia', 'Thiago', 'Vanessa', 'Wagner'];
const lastNames = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Lima', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Carvalho', 'Ribeiro'];
const companies = ['Padaria Pão Quente', 'Mercadinho Bom Preço', 'Studio Fit', 'Ótica Visão', 'Clínica Sorriso', 'Café Central', 'Pet Shop Amigo', null, null, null];
const cities: [string, string][] = [['São Paulo', 'SP'], ['Campinas', 'SP'], ['Rio de Janeiro', 'RJ'], ['Belo Horizonte', 'MG'], ['Curitiba', 'PR'], ['Porto Alegre', 'RS'], ['Recife', 'PE']];

const catalog: [string, string, number, number][] = [
  // [nome, categoria, preço, custo]
  ['Notebook Pro 14"', 'Informática', 5299.9, 3900],
  ['Mouse sem fio', 'Informática', 89.9, 38],
  ['Teclado mecânico', 'Informática', 349.9, 180],
  ['Monitor 24" Full HD', 'Informática', 899, 610],
  ['Headset USB', 'Informática', 199.9, 95],
  ['Webcam HD', 'Informática', 249, 120],
  ['SSD 1TB', 'Informática', 459.9, 290],
  ['Cadeira ergonômica', 'Escritório', 1290, 760],
  ['Mesa em L', 'Escritório', 980, 540],
  ['Luminária LED', 'Escritório', 129.9, 55],
  ['Caderno universitário', 'Papelaria', 24.9, 9.5],
  ['Caneta gel (cx 12)', 'Papelaria', 32, 14],
  ['Agenda 2027', 'Papelaria', 49.9, 21],
  ['Papel A4 (resma)', 'Papelaria', 29.9, 18],
  ['Smartphone X10', 'Celulares', 2199, 1650],
  ['Capinha silicone', 'Celulares', 39.9, 8],
  ['Carregador turbo', 'Celulares', 119.9, 45],
  ['Fone Bluetooth', 'Celulares', 279, 140],
  ['Película de vidro', 'Celulares', 29.9, 4],
  ['Roteador Wi-Fi 6', 'Redes', 599, 380],
  ['Cabo de rede 5m', 'Redes', 24.9, 7],
  ['Switch 8 portas', 'Redes', 219, 130],
  ['Consultoria (hora)', 'Serviços', 180, 60],
  ['Instalação de rede', 'Serviços', 350, 120],
];

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  // --if-empty: usado no start do ambiente de demonstração; não recria se a demo já existir.
  if (existing && process.argv.includes('--if-empty')) {
    console.info('ℹ️  Demo já existe, nada a fazer.');
    return;
  }
  if (existing) await prisma.organization.delete({ where: { id: existing.organizationId } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const org = await prisma.organization.create({ data: { name: 'Nexus Demo Comércio Ltda' } });
  const mk = (name: string, email: string, role: 'ADMIN' | 'MANAGER' | 'SELLER') =>
    prisma.user.create({ data: { organizationId: org.id, name, email, role, passwordHash } });
  const admin = await mk('Ana Administradora', DEMO_EMAIL, 'ADMIN');
  const manager = await mk('Gustavo Gerente', 'gerente@demo.com', 'MANAGER');
  const seller1 = await mk('Vitória Vendedora', 'vendedor@demo.com', 'SELLER');
  const seller2 = await mk('Caio Comercial', 'caio@demo.com', 'SELLER');
  const sellers = [admin, manager, seller1, seller1, seller2, seller2];

  const now = Date.now();
  const DAY = 86_400_000;

  const customers = [];
  for (let i = 0; i < 32; i++) {
    const name = `${pick(firstNames)} ${pick(lastNames)}`;
    const [city, state] = pick(cities);
    customers.push(
      await prisma.customer.create({
        data: {
          organizationId: org.id,
          name,
          email: `${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(' ', '.')}${i}@email.com`,
          phone: `(${int(11, 99)}) 9${int(1000, 9999)}-${int(1000, 9999)}`,
          company: pick(companies),
          city,
          state,
          createdAt: new Date(now - int(0, 200) * DAY),
        },
      }),
    );
  }

  const products: (Prisma.ProductGetPayload<object> & { current: number })[] = [];
  for (const [i, [name, category, price, cost]] of catalog.entries()) {
    const stock = category === 'Serviços' ? 9999 : int(40, 160);
    const p = await prisma.product.create({
      data: {
        organizationId: org.id,
        sku: `${category.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
        name,
        category,
        price,
        cost,
        stock,
        minStock: category === 'Serviços' ? 0 : int(5, 15),
        createdAt: new Date(now - 210 * DAY),
      },
    });
    await prisma.stockMovement.create({
      data: { organizationId: org.id, productId: p.id, userId: admin.id, type: 'IN', quantity: stock, balance: stock, reason: 'Estoque inicial', createdAt: p.createdAt },
    });
    products.push({ ...p, current: stock });
  }

  // ~6 meses de vendas, com leve tendência de crescimento.
  const methods: PaymentMethod[] = ['PIX', 'PIX', 'PIX', 'CREDIT_CARD', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'BANK_SLIP'];
  let number = 0;
  for (let d = 180; d >= 0; d--) {
    const perDay = Math.max(0, Math.round(rnd() * 3 + (180 - d) / 70));
    for (let k = 0; k < perDay; k++) {
      const chosen = new Map<string, number>();
      const nItems = int(1, 3);
      for (let j = 0; j < nItems; j++) {
        const p = rnd() < 0.55 ? pick(products.filter((x) => x.price.lt(500))) : pick(products);
        chosen.set(p.id, int(1, p.price.lt(100) ? 4 : 2));
      }
      const lines = [...chosen].map(([pid, qty]) => {
        const p = products.find((x) => x.id === pid)!;
        return { p, qty: Math.min(qty, p.current) };
      }).filter((l) => l.qty > 0);
      if (!lines.length) continue;

      const createdAt = new Date(now - d * DAY - (8 - k) * 3_600_000 - int(0, 50) * 60_000);
      const status: SaleStatus = d < 4 && rnd() < 0.5 ? 'PENDING' : rnd() < 0.05 ? 'CANCELED' : 'PAID';
      const subtotal = lines.reduce((a, l) => a.add(l.p.price.mul(l.qty)), new Prisma.Decimal(0));
      const discount = rnd() < 0.2 ? subtotal.mul(0.05).toDecimalPlaces(2) : new Prisma.Decimal(0);
      const cost = lines.reduce((a, l) => a.add(l.p.cost.mul(l.qty)), new Prisma.Decimal(0));
      const seller = pick(sellers);

      const sale = await prisma.sale.create({
        data: {
          organizationId: org.id,
          number: ++number,
          customerId: rnd() < 0.85 ? pick(customers).id : null,
          userId: seller.id,
          status,
          paymentMethod: pick(methods),
          subtotal,
          discount,
          total: subtotal.sub(discount),
          cost,
          paidAt: status === 'PAID' ? createdAt : null,
          canceledAt: status === 'CANCELED' ? createdAt : null,
          createdAt,
          items: {
            create: lines.map((l) => ({
              productId: l.p.id,
              name: l.p.name,
              quantity: l.qty,
              unitPrice: l.p.price,
              unitCost: l.p.cost,
              subtotal: l.p.price.mul(l.qty),
            })),
          },
        },
      });
      if (status !== 'CANCELED') {
        for (const l of lines) {
          l.p.current -= l.qty;
          await prisma.stockMovement.create({
            data: { organizationId: org.id, productId: l.p.id, userId: seller.id, saleId: sale.id, type: 'SALE', quantity: -l.qty, balance: l.p.current, reason: `Venda #${sale.number}`, createdAt },
          });
        }
      }
    }
  }
  // Deixa alguns produtos abaixo do mínimo para o alerta de estoque aparecer.
  for (const p of products.slice(0, 24)) {
    let stock = p.current;
    if (['Mouse sem fio', 'SSD 1TB', 'Película de vidro', 'Agenda 2027'].includes(p.name)) stock = int(0, 4);
    if (stock !== p.current) {
      await prisma.stockMovement.create({
        data: { organizationId: org.id, productId: p.id, userId: manager.id, type: 'ADJUST', quantity: stock - p.current, balance: stock, reason: 'Inventário mensal' },
      });
    }
    await prisma.product.update({ where: { id: p.id }, data: { stock } });
  }

  const tasks: [string, 'TODO' | 'IN_PROGRESS' | 'DONE', 'LOW' | 'MEDIUM' | 'HIGH', number | null][] = [
    ['Ligar para clientes com pedidos pendentes', 'TODO', 'HIGH', 1],
    ['Repor estoque de mouses e SSDs', 'IN_PROGRESS', 'HIGH', 2],
    ['Enviar proposta para Studio Fit', 'TODO', 'MEDIUM', 4],
    ['Atualizar tabela de preços de informática', 'TODO', 'MEDIUM', 7],
    ['Organizar vitrine de celulares', 'IN_PROGRESS', 'LOW', 3],
    ['Fechamento financeiro do mês', 'TODO', 'HIGH', 10],
    ['Treinar novo vendedor no sistema', 'DONE', 'MEDIUM', -3],
    ['Conferir inventário de papelaria', 'DONE', 'LOW', -5],
    ['Responder avaliações dos clientes', 'TODO', 'LOW', null],
  ];
  const team = [admin, manager, seller1, seller2];
  for (const [title, status, priority, due] of tasks) {
    await prisma.task.create({
      data: {
        organizationId: org.id,
        title,
        status,
        priority,
        dueDate: due === null ? null : new Date(now + due * DAY),
        assigneeId: pick(team).id,
        customerId: title.includes('Studio') ? customers[0].id : null,
        createdById: admin.id,
        completedAt: status === 'DONE' ? new Date(now - DAY) : null,
      },
    });
  }

  console.info(`✅ Demo criada: ${number} vendas, ${customers.length} clientes, ${products.length} produtos.`);
  console.info(`   Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (também gerente@demo.com e vendedor@demo.com)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import type { ZodError } from 'zod';
import { prisma } from '../../lib/prisma';
import { customerSchema } from '../customers/customers.schemas';
import { createProductSchema } from '../products/products.schemas';
import { assertLimit } from '../billing/billing.service';

/**
 * Importação de planilhas. O navegador lê o arquivo (CSV/XLSX) e envia as linhas como objetos;
 * aqui os cabeçalhos são normalizados (aceita nomes em português), cada linha é validada
 * com o MESMO schema do cadastro manual, e só as linhas válidas são gravadas.
 */

export type Row = Record<string, unknown>;
export interface ImportError {
  row: number; // número da linha na planilha (cabeçalho = 1)
  field: string;
  message: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

const CUSTOMER_ALIASES: Record<string, string[]> = {
  name: ['nome', 'name', 'cliente', 'razaosocial', 'nomecompleto'],
  email: ['email', 'e-mail', 'mail'],
  phone: ['telefone', 'phone', 'celular', 'whatsapp', 'fone', 'tel'],
  document: ['cpf', 'cnpj', 'cpfcnpj', 'documento', 'document'],
  company: ['empresa', 'company', 'nomefantasia'],
  address: ['endereco', 'address', 'logradouro'],
  city: ['cidade', 'city', 'municipio'],
  state: ['uf', 'estado', 'state'],
  notes: ['observacoes', 'observacao', 'obs', 'notas', 'notes'],
};

const PRODUCT_ALIASES: Record<string, string[]> = {
  sku: ['sku', 'codigo', 'cod', 'referencia', 'ref', 'code'],
  name: ['nome', 'name', 'produto', 'descricaocurta'],
  description: ['descricao', 'description', 'detalhes'],
  category: ['categoria', 'category', 'grupo'],
  price: ['preco', 'precovenda', 'precodevenda', 'price', 'valor', 'valorvenda'],
  cost: ['custo', 'precocusto', 'precodecusto', 'cost', 'valorcusto'],
  stock: ['estoque', 'stock', 'quantidade', 'qtd', 'saldo', 'estoqueinicial'],
  minStock: ['estoqueminimo', 'minimo', 'minstock', 'estoquemin'],
};

function mapRow(row: Row, aliases: Record<string, string[]>) {
  const lookup = new Map<string, string>();
  for (const [field, names] of Object.entries(aliases)) for (const n of names) lookup.set(norm(n), field);
  lookup.forEach((v) => lookup.set(norm(v), v));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const field = lookup.get(norm(k));
    if (field && out[field] === undefined) out[field] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

/** "R$ 1.234,56" → 1234.56 ; "59.9" → 59.9 */
const parseNumber = (v: unknown) => {
  if (typeof v === 'number') return v;
  if (v === undefined || v === null || v === '') return undefined;
  let s = String(v).replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : s; // valor inválido segue como texto para o Zod apontar o erro
};

const toText = (v: unknown) => (v === undefined || v === null ? undefined : String(v));

const zodErrors = (rowNum: number, err: ZodError): ImportError[] =>
  err.issues.map((i) => ({ row: rowNum, field: String(i.path[0] ?? ''), message: i.message }));

export async function importCustomers(orgId: string, rows: Row[], dryRun: boolean) {
  const errors: ImportError[] = [];
  const valid: { rowNum: number; data: ReturnType<typeof customerSchema.parse> }[] = [];

  rows.forEach((raw, i) => {
    const m = mapRow(raw, CUSTOMER_ALIASES);
    const input = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, toText(v)]));
    const r = customerSchema.safeParse(input);
    if (r.success) valid.push({ rowNum: i + 2, data: r.data });
    else errors.push(...zodErrors(i + 2, r.error));
  });

  // Ignora e-mails que já existem na empresa (ou repetidos na própria planilha).
  const emails = valid.map((v) => v.data.email).filter(Boolean) as string[];
  const existing = new Set(
    (await prisma.customer.findMany({ where: { organizationId: orgId, email: { in: emails } }, select: { email: true } })).map((c) => c.email),
  );
  const seen = new Set<string>();
  const toCreate = valid.filter((v) => {
    const e = v.data.email;
    if (!e) return true;
    if (existing.has(e) || seen.has(e)) {
      errors.push({ row: v.rowNum, field: 'email', message: 'Cliente com este e-mail já existe — linha ignorada' });
      return false;
    }
    seen.add(e);
    return true;
  });

  if (!dryRun && toCreate.length) {
    await prisma.customer.createMany({ data: toCreate.map((v) => ({ ...v.data, organizationId: orgId })) });
  }
  return { total: rows.length, valid: toCreate.length, created: dryRun ? 0 : toCreate.length, updated: 0, errors: errors.sort((a, b) => a.row - b.row) };
}

export async function importProducts(orgId: string, userId: string, rows: Row[], dryRun: boolean) {
  const errors: ImportError[] = [];
  const valid: { rowNum: number; data: ReturnType<typeof createProductSchema.parse> }[] = [];

  rows.forEach((raw, i) => {
    const m = mapRow(raw, PRODUCT_ALIASES);
    const input = {
      ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, toText(v)])),
      price: parseNumber(m.price),
      cost: parseNumber(m.cost),
      stock: parseNumber(m.stock),
      minStock: parseNumber(m.minStock),
    };
    const r = createProductSchema.safeParse(input);
    if (r.success) valid.push({ rowNum: i + 2, data: r.data });
    else errors.push(...zodErrors(i + 2, r.error));
  });

  // SKU repetido na planilha: vale a primeira ocorrência.
  const seen = new Set<string>();
  const unique = valid.filter((v) => {
    if (seen.has(v.data.sku)) {
      errors.push({ row: v.rowNum, field: 'sku', message: 'SKU repetido na planilha — linha ignorada' });
      return false;
    }
    seen.add(v.data.sku);
    return true;
  });

  // SKU já cadastrado → atualiza dados do produto (o estoque não é alterado na atualização).
  const existing = new Map(
    (await prisma.product.findMany({ where: { organizationId: orgId, sku: { in: unique.map((v) => v.data.sku) } }, select: { id: true, sku: true } })).map(
      (p) => [p.sku, p.id],
    ),
  );
  const toCreate = unique.filter((v) => !existing.has(v.data.sku));
  const toUpdate = unique.filter((v) => existing.has(v.data.sku));

  if (!dryRun) {
    await assertLimit(orgId, 'products', toCreate.length);
    await prisma.$transaction(async (tx) => {
      for (const v of toCreate) {
        const p = await tx.product.create({ data: { ...v.data, organizationId: orgId } });
        if (v.data.stock > 0) {
          await tx.stockMovement.create({
            data: { organizationId: orgId, productId: p.id, userId, type: 'IN', quantity: v.data.stock, balance: v.data.stock, reason: 'Importação de planilha' },
          });
        }
      }
      for (const v of toUpdate) {
        const { stock: _ignored, ...data } = v.data;
        await tx.product.update({ where: { id: existing.get(v.data.sku)! }, data });
      }
    });
  }
  return {
    total: rows.length,
    valid: unique.length,
    created: dryRun ? 0 : toCreate.length,
    updated: dryRun ? 0 : toUpdate.length,
    toCreate: toCreate.length,
    toUpdate: toUpdate.length,
    errors: errors.sort((a, b) => a.row - b.row),
  };
}

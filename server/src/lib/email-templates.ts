import { env } from '../config/env';

/** Templates de e-mail em HTML com estilos inline (compatível com Gmail/Outlook). */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const appUrl = (path = '') => `${env.APP_URL.replace(/\/$/, '')}${path}`;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function layout({ preheader, title, body, cta }: { preheader: string; title: string; body: string; cta?: { label: string; url: string } }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1e293b">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:#0b1220;padding:18px 24px"><span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:7px;background:#2552eb;color:#fff;font-weight:700;font-size:14px">N</span>
<span style="color:#fff;font-weight:600;font-size:15px;margin-left:8px;vertical-align:middle">Nexus <span style="color:#93b4fd">Manager</span></span></td></tr>
<tr><td style="padding:28px 24px 8px"><h1 style="margin:0 0 12px;font-size:20px;color:#0f172a">${esc(title)}</h1>${body}</td></tr>
${cta ? `<tr><td style="padding:8px 24px 28px"><a href="${cta.url}" style="display:inline-block;background:#2552eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:8px">${esc(cta.label)}</a></td></tr>` : ''}
<tr><td style="padding:16px 24px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8">Você recebeu este e-mail porque tem uma conta no Nexus Manager.</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (t: string) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#334155">${t}</p>`;

export function welcomeEmail(name: string, company: string, trialDays: number) {
  return {
    subject: `Bem-vindo ao Nexus Manager, ${name.split(' ')[0]}!`,
    html: layout({
      preheader: 'Sua conta está pronta. Veja como começar em 3 passos.',
      title: `Sua conta da ${esc(company)} está pronta`,
      body:
        p(`Olá, ${esc(name)}. Você tem <strong>${trialDays} dias grátis do plano Profissional</strong> para testar tudo, sem cartão.`) +
        p('Para tirar o máximo do sistema logo no primeiro dia:') +
        `<ol style="margin:0 0 12px;padding-left:20px;font-size:14px;line-height:1.8;color:#334155"><li>Cadastre seus produtos (ou importe uma planilha)</li><li>Cadastre seus clientes</li><li>Registre a primeira venda e veja o dashboard ganhar vida</li></ol>`,
      cta: { label: 'Acessar o painel', url: appUrl('/') },
    }),
  };
}

export function inviteEmail(name: string, company: string, invitedBy: string, email: string) {
  return {
    subject: `${invitedBy} convidou você para o Nexus Manager`,
    html: layout({
      preheader: `Acesse a conta da ${company} no Nexus Manager.`,
      title: `Você foi adicionado à equipe da ${esc(company)}`,
      body:
        p(`Olá, ${esc(name)}. <strong>${esc(invitedBy)}</strong> criou seu acesso ao Nexus Manager.`) +
        p(`Entre com o e-mail <strong>${esc(email)}</strong> e a senha que recebeu de quem te convidou. Se preferir, crie uma nova senha em "Esqueci minha senha".`),
      cta: { label: 'Entrar no Nexus Manager', url: appUrl('/login') },
    }),
  };
}

export function resetEmail(name: string, url: string, minutes: number) {
  return {
    subject: 'Recuperação de senha — Nexus Manager',
    html: layout({
      preheader: 'Crie uma nova senha para sua conta.',
      title: 'Redefinir sua senha',
      body: p(`Olá, ${esc(name)}. Recebemos um pedido para redefinir sua senha. O link vale por <strong>${minutes} minutos</strong> e só pode ser usado uma vez.`) + p('Se não foi você, ignore este e-mail: sua senha continua a mesma.'),
      cta: { label: 'Criar nova senha', url },
    }),
  };
}

export interface WeeklyData {
  company: string;
  periodLabel: string;
  revenue: number;
  revenuePrev: number;
  sales: number;
  salesPrev: number;
  averageTicket: number;
  pendingAmount: number;
  newCustomers: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  lowStock: { name: string; stock: number; minStock: number }[];
}

const delta = (cur: number, prev: number) => {
  if (prev <= 0) return '';
  const d = (cur - prev) / prev;
  const color = d >= 0 ? '#047857' : '#be123c';
  return `<span style="color:${color};font-size:12px;font-weight:600">${d >= 0 ? '▲' : '▼'} ${Math.abs(d * 100).toFixed(1).replace('.', ',')}%</span>`;
};

export function weeklySummaryEmail(name: string, d: WeeklyData) {
  const kpi = (label: string, value: string, extra = '') =>
    `<td style="padding:12px;border:1px solid #e2e8f0;border-radius:10px;width:50%"><div style="font-size:12px;color:#64748b">${label}</div><div style="font-size:18px;font-weight:700;color:#0f172a;margin-top:2px">${value}</div>${extra}</td>`;
  const rows = (items: string[]) => items.join('') || `<tr><td style="padding:6px 0;font-size:13px;color:#94a3b8">Nada no período.</td></tr>`;
  return {
    subject: `Resumo semanal: ${brl(d.revenue)} em vendas — ${d.company}`,
    html: layout({
      preheader: `${d.sales} vendas e ${brl(d.revenue)} faturados ${d.periodLabel}.`,
      title: `Seu resumo da semana`,
      body:
        p(`Olá, ${esc(name.split(' ')[0])}. Veja como foi a ${esc(d.company)} ${esc(d.periodLabel)}, comparado à semana anterior.`) +
        `<table role="presentation" width="100%" cellspacing="8" cellpadding="0" style="margin:0 -8px 8px"><tr>${kpi('Faturamento', brl(d.revenue), delta(d.revenue, d.revenuePrev))}${kpi('Vendas pagas', String(d.sales), delta(d.sales, d.salesPrev))}</tr>
         <tr>${kpi('Ticket médio', brl(d.averageTicket))}${kpi('A receber', brl(d.pendingAmount))}</tr></table>` +
        p(`<strong>${d.newCustomers}</strong> cliente(s) novo(s) na semana.`) +
        `<h2 style="font-size:14px;margin:16px 0 6px;color:#0f172a">Mais vendidos</h2><table role="presentation" width="100%" style="border-collapse:collapse">${rows(
          d.topProducts.map((t) => `<tr><td style="padding:6px 0;font-size:13px;border-bottom:1px solid #f1f5f9">${esc(t.name)} <span style="color:#94a3b8">· ${t.quantity} un.</span></td><td align="right" style="font-size:13px;font-weight:600;border-bottom:1px solid #f1f5f9">${brl(t.revenue)}</td></tr>`),
        )}</table>` +
        `<h2 style="font-size:14px;margin:16px 0 6px;color:#0f172a">Estoque baixo</h2><table role="presentation" width="100%" style="border-collapse:collapse">${rows(
          d.lowStock.map((l) => `<tr><td style="padding:6px 0;font-size:13px;border-bottom:1px solid #f1f5f9">${esc(l.name)}</td><td align="right" style="font-size:13px;font-weight:600;color:${l.stock <= 0 ? '#be123c' : '#b45309'};border-bottom:1px solid #f1f5f9">${l.stock} un. (mín. ${l.minStock})</td></tr>`),
        )}</table>`,
      cta: { label: 'Abrir o dashboard', url: appUrl('/') },
    }),
  };
}

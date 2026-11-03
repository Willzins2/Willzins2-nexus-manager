import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, CheckSquare, CreditCard, Download, LayoutDashboard, Lock, LogOut, Menu, Monitor, Moon, Package, ShoppingCart, Sun, UserCog, Users, X, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useBilling, type Feature } from '../lib/billing';
import { useTheme, type ThemeMode } from '../lib/theme';
import { useInstallPrompt } from '../lib/pwa';
import { date } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { initials, roleLabel } from '../lib/format';
import type { Role } from '../lib/types';
import { cn } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  feature?: Feature;
}

const nav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/produtos', label: 'Produtos e estoque', icon: Package },
  { to: '/tarefas', label: 'Tarefas', icon: CheckSquare, feature: 'tasks' },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, roles: ['ADMIN', 'MANAGER'], feature: 'reports' },
  { to: '/usuarios', label: 'Usuários', icon: UserCog, roles: ['ADMIN'] },
  { to: '/assinatura', label: 'Assinatura', icon: CreditCard, roles: ['ADMIN'] },
];

export const Logo = ({ light }: { light?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-sm shadow-brand-900/30">N</div>
    <span className={cn('text-[15px] font-semibold tracking-tight', light ? 'text-white' : 'text-slate-900')}>
      Nexus <span className={light ? 'text-brand-300' : 'text-brand-600'}>Manager</span>
    </span>
  </div>
);

const themes: { mode: ThemeMode; icon: LucideIcon; label: string }[] = [
  { mode: 'light', icon: Sun, label: 'Claro' },
  { mode: 'dark', icon: Moon, label: 'Escuro' },
  { mode: 'system', icon: Monitor, label: 'Automático' },
];

function ThemeSwitch() {
  const { mode, setMode } = useTheme();
  return (
    <div className="flex rounded-lg bg-white/5 p-0.5" role="radiogroup" aria-label="Tema">
      {themes.map((t) => (
        <button key={t.mode} role="radio" aria-checked={mode === t.mode} title={t.label} aria-label={`Tema ${t.label.toLowerCase()}`} onClick={() => setMode(t.mode)}
          className={cn('flex flex-1 items-center justify-center rounded-md py-1.5 transition', mode === t.mode ? 'bg-white/10 text-white' : 'text-mist-500 hover:text-mist-200')}>
          <t.icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

function InstallButton() {
  const { canInstall, installed, ios, install } = useInstallPrompt();
  if (installed || (!canInstall && !ios)) return null;
  const onClick = async () => {
    if (canInstall) {
      if (await install()) toast.success('App instalado! Abra pelo ícone na tela inicial.');
    } else {
      toast.info('No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".', { duration: 8000 });
    }
  };
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-mist-400 hover:bg-white/5 hover:text-white">
      <Download className="h-4 w-4" /> Instalar app
    </button>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout, can } = useAuth();
  const { has } = useBilling();
  if (!user) return null;
  return (
    <div className="flex h-full flex-col bg-ink-900 text-mist-300">
      <div className="flex h-16 items-center px-5">
        <Logo light />
      </div>
      <div className="mx-3 mb-3 rounded-lg bg-white/5 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wider text-mist-500">Empresa</p>
        <p className="truncate text-sm font-medium text-mist-200">{user.organization.name}</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Principal">
        {nav
          .filter((n) => !n.roles || can(...n.roles))
          .map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-mist-400 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <n.icon className="h-[18px] w-[18px]" />
              {n.label}
              {n.feature && !has(n.feature) && <Lock className="ml-auto h-3.5 w-3.5 opacity-60" aria-label="Não incluso no plano" />}
            </NavLink>
          ))}
      </nav>
      <div className="border-t border-white/5 p-3">
        <div className="mb-2 px-1"><ThemeSwitch /></div>
        <InstallButton />
        <NavLink to="/perfil" onClick={onNavigate} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500/20 text-sm font-semibold text-brand-200">{initials(user.name)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-mist-500">{roleLabel[user.role]}</p>
          </div>
        </NavLink>
        <button onClick={logout} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-mist-400 hover:bg-white/5 hover:text-white">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </div>
  );
}

/** Aviso de teste, atraso ou fim do período, visível só para quem pode resolver (admin). */
function BillingBanner() {
  const { can } = useAuth();
  const { data } = useBilling();
  if (!data || !can('ADMIN')) return null;
  let tone = 'border-brand-200 bg-brand-50 text-brand-900';
  let text: string | null = null;
  if (data.status === 'TRIALING' && data.effectivePlan === 'PRO') {
    text = `Teste grátis do plano Profissional: ${data.trialDaysLeft} dia(s) restante(s).`;
  } else if (data.status === 'TRIALING') {
    tone = 'border-amber-200 bg-amber-50 text-amber-900';
    text = 'Seu teste terminou e a conta está no plano Grátis. Escolha um plano para liberar tudo de novo.';
  } else if (data.status === 'PAST_DUE') {
    tone = 'border-rose-200 bg-rose-50 text-rose-900';
    text = 'Não identificamos o pagamento da sua assinatura. Regularize para não perder os recursos do plano.';
  } else if (data.status === 'CANCELED' && data.effectivePlan !== 'FREE') {
    tone = 'border-amber-200 bg-amber-50 text-amber-900';
    text = `Assinatura cancelada. O plano continua ativo até ${date(data.currentPeriodEnd)}.`;
  }
  if (!text) return null;
  return (
    <div className={cn('mb-6 flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between', tone)}>
      <span>{text}</span>
      <Link to="/assinatura" className="font-semibold underline-offset-2 hover:underline">Ver planos</Link>
    </div>
  );
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const current = nav.find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)));

  return (
    <div className="min-h-screen">
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-xl">
            <button className="btn-icon absolute right-2 top-3 z-10 text-mist-400 hover:text-white" onClick={() => setOpen(false)} aria-label="Fechar menu">
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-surface/90 px-4 backdrop-blur lg:hidden">
          <button className="btn-icon btn-ghost -ml-2" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-slate-900">{current?.label ?? 'Nexus Manager'}</span>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <BillingBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

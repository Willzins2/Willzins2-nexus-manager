import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, CheckSquare, LayoutDashboard, LogOut, Menu, Package, ShoppingCart, UserCog, Users, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { initials, roleLabel } from '../lib/format';
import type { Role } from '../lib/types';
import { cn } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
}

const nav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/produtos', label: 'Produtos e estoque', icon: Package },
  { to: '/tarefas', label: 'Tarefas', icon: CheckSquare },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, roles: ['ADMIN', 'MANAGER'] },
  { to: '/usuarios', label: 'Usuários', icon: UserCog, roles: ['ADMIN'] },
];

export const Logo = ({ light }: { light?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-sm shadow-brand-900/30">N</div>
    <span className={cn('text-[15px] font-semibold tracking-tight', light ? 'text-white' : 'text-slate-900')}>
      Nexus <span className={light ? 'text-brand-300' : 'text-brand-600'}>Manager</span>
    </span>
  </div>
);

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout, can } = useAuth();
  if (!user) return null;
  return (
    <div className="flex h-full flex-col bg-ink-900 text-slate-300">
      <div className="flex h-16 items-center px-5">
        <Logo light />
      </div>
      <div className="mx-3 mb-3 rounded-lg bg-white/5 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">Empresa</p>
        <p className="truncate text-sm font-medium text-slate-200">{user.organization.name}</p>
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
                  isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <n.icon className="h-[18px] w-[18px]" />
              {n.label}
            </NavLink>
          ))}
      </nav>
      <div className="border-t border-white/5 p-3">
        <NavLink to="/perfil" onClick={onNavigate} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500/20 text-sm font-semibold text-brand-200">{initials(user.name)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{roleLabel[user.role]}</p>
          </div>
        </NavLink>
        <button onClick={logout} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
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
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-xl">
            <button className="btn-icon absolute right-2 top-3 z-10 text-slate-400 hover:text-white" onClick={() => setOpen(false)} aria-label="Fechar menu">
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button className="btn-icon btn-ghost -ml-2" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-slate-900">{current?.label ?? 'Nexus Manager'}</span>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

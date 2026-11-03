import type { ReactNode } from 'react';
import { BarChart3, Package, ShieldCheck, Users } from 'lucide-react';
import { Logo } from '../../components/Layout';

const features = [
  { icon: Users, text: 'Clientes e contatos organizados' },
  { icon: Package, text: 'Catálogo e estoque com alertas' },
  { icon: BarChart3, text: 'Vendas e resultados em tempo real' },
  { icon: ShieldCheck, text: 'Acesso por perfil para sua equipe' },
];

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-900 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <Logo light />
        <div className="relative">
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-white">
            Tudo o que o seu negócio precisa, em um só lugar.
          </h2>
          <ul className="mt-8 space-y-4">
            {features.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-slate-300">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-brand-300">
                  <f.icon className="h-[18px] w-[18px]" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} Nexus Manager</p>
      </div>
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

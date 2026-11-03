import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { PageLoader } from './components/ui';
import { FeatureGate } from './components/Upgrade';
import type { Role } from './lib/types';

// Divisão de código por página: carrega só o que o usuário abre.
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const Products = lazy(() => import('./pages/Products'));
const Sales = lazy(() => import('./pages/Sales'));
const NewSale = lazy(() => import('./pages/NewSale'));
const SaleDetail = lazy(() => import('./pages/SaleDetail'));
const Reports = lazy(() => import('./pages/Reports'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Users = lazy(() => import('./pages/Users'));
const Profile = lazy(() => import('./pages/Profile'));
const Billing = lazy(() => import('./pages/Billing'));

function Private({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading, can } = useAuth();
  const location = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center"><PageLoader /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !can(...roles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><PageLoader /></div>;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-5xl font-semibold text-slate-300">404</p>
      <p className="mt-2 text-slate-600">Página não encontrada.</p>
      <a href="/" className="btn-primary mt-6">Voltar ao início</a>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/cadastro" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/esqueci-senha" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
        <Route path="/redefinir-senha" element={<ResetPassword />} />
        <Route element={<Private><Layout /></Private>}>
          <Route index element={<Dashboard />} />
          <Route path="clientes" element={<Customers />} />
          <Route path="produtos" element={<Products />} />
          <Route path="vendas" element={<Sales />} />
          <Route path="vendas/nova" element={<NewSale />} />
          <Route path="vendas/:id" element={<SaleDetail />} />
          <Route path="tarefas" element={<FeatureGate feature="tasks"><Tasks /></FeatureGate>} />
          <Route path="relatorios" element={<Private roles={['ADMIN', 'MANAGER']}><FeatureGate feature="reports"><Reports /></FeatureGate></Private>} />
          <Route path="assinatura" element={<Private roles={['ADMIN']}><Billing /></Private>} />
          <Route path="usuarios" element={<Private roles={['ADMIN']}><Users /></Private>} />
          <Route path="perfil" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

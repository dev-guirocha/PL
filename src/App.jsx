// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import LoteriasPage from './pages/LoteriasPage';
import LoteriasDatePage from './pages/LoteriasDatePage';
import LoteriasModalidadesPage from './pages/LoteriasModalidadesPage';
import LoteriasColocacaoPage from './pages/LoteriasColocacaoPage';
import LoteriasPalpitesPage from './pages/LoteriasPalpitesPage';
import LoteriasValorPage from './pages/LoteriasValorPage';
import LoteriasResumoPage from './pages/LoteriasResumoPage';
import LoteriasSorteiosPage from './pages/LoteriasSorteiosPage';
import LoteriasFinalPage from './pages/LoteriasFinalPage';
import PulesPage from './pages/PulesPage';
import ReportsPage from './pages/ReportsPage';
import BalanceReportPage from './pages/BalanceReportPage';
import QuotesPage from './pages/QuotesPage';
import QuoteDetailPage from './pages/QuoteDetailPage';
import { ToastContainer } from 'react-toastify';
import AdminDashboard from './pages/AdminDashboard';
import { AuthProvider } from './context/AuthContext';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminBetsPage from './pages/admin/AdminBetsPage';
import AdminSupervisorsPage from './pages/admin/AdminSupervisorsPage';
import AdminResultsPage from './pages/admin/AdminResultsPage';
import AdminWithdrawalsPage from './pages/admin/AdminWithdrawalsPage';
import AdminCouponsPage from './pages/admin/AdminCouponsPage';
import SupervisorDashboard from './pages/SupervisorDashboard';

const getStoredToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('loggedIn') || sessionStorage.getItem('loggedIn');
};

const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const RequireAuth = ({ children }) => {
  const token = getStoredToken();
  return token ? children : <Navigate to="/" replace />;
};

const RequireAdmin = ({ children }) => {
  const token = getStoredToken();
  // Permitimos se há token; o back (adminOnly) valida isAdmin. Evita redirecionar por cache antigo.
  if (!token) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route
          path="/home"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/perfil"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/configuracoes"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/loterias"
          element={
            <RequireAuth>
              <LoteriasPage />
            </RequireAuth>
          }
        />
        <Route
          path="/loterias/:jogo"
          element={
            <RequireAuth>
              <LoteriasDatePage />
            </RequireAuth>
          }
        />
        <Route
          path="/loterias/:jogo/modalidades"
          element={
            <RequireAuth>
              <LoteriasModalidadesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/loterias/:jogo/colocacao"
          element={
            <RequireAuth>
              <LoteriasColocacaoPage />
            </RequireAuth>
          }
        />
        <Route
          path="/loterias/:jogo/palpites"
          element={
            <RequireAuth>
              <LoteriasPalpitesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/loterias/:jogo/valor"
          element={
            <RequireAuth>
              <LoteriasValorPage />
            </RequireAuth>
          }
        />
        <Route
          path="/loterias/:jogo/resumo"
          element={
            <RequireAuth>
              <LoteriasResumoPage />
            </RequireAuth>
          }
        />
        <Route
          path="/loterias-sorteios"
          element={
            <RequireAuth>
              <LoteriasSorteiosPage />
            </RequireAuth>
          }
        />
        <Route
          path="/loterias-final"
          element={
            <RequireAuth>
              <LoteriasFinalPage />
            </RequireAuth>
          }
        />
        <Route
        path="/pules"
        element={
          <RequireAuth>
            <PulesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/relatorios"
        element={
          <RequireAuth>
            <ReportsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/relatorios/consulta-saldo"
        element={
          <RequireAuth>
            <BalanceReportPage />
          </RequireAuth>
        }
      />
      <Route
        path="/relatorios/cotacoes"
        element={
          <RequireAuth>
            <QuotesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/relatorios/cotacoes/:slug"
        element={
          <RequireAuth>
            <QuoteDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAdmin>
            <AdminUsersPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/bets"
        element={
          <RequireAdmin>
            <AdminBetsPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/supervisors"
        element={
          <RequireAdmin>
            <AdminSupervisorsPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/results"
        element={
          <RequireAdmin>
            <AdminResultsPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/withdrawals"
        element={
          <RequireAdmin>
            <AdminWithdrawalsPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/coupons"
        element={
          <RequireAdmin>
            <AdminCouponsPage />
          </RequireAdmin>
        }
      />
      <Route path="/supervisor" element={<SupervisorDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <ToastContainer position="top-center" autoClose={3000} hideProgressBar />
  </AuthProvider>
  );
}

export default App;

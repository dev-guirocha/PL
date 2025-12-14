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
import ResultPulesPage from './pages/ResultPulesPage';
import { ToastContainer } from 'react-toastify';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminBetsPage from './pages/admin/AdminBetsPage';
import AdminSupervisorsPage from './pages/admin/AdminSupervisorsPage';
import AdminResultsPage from './pages/admin/AdminResultsPage';
import AdminWithdrawalsPage from './pages/admin/AdminWithdrawalsPage';
import AdminCouponsPage from './pages/admin/AdminCouponsPage';
import SupervisorDashboard from './pages/SupervisorDashboard';
import UserLayout from './components/UserLayout';
import PixRechargePage from './pages/PixRechargePage';
import LoteriasRepetirPage from './pages/LoteriasRepetirPage';
import LoteriasRepetirValorPage from './pages/LoteriasRepetirValorPage';
import LoteriasRepetirDatePage from './pages/LoteriasRepetirDatePage';

const getStoredToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('loggedIn') || sessionStorage.getItem('loggedIn');
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
    <>
      <Routes>
        <Route path="/" element={<AuthPage />} />

        <Route
          element={
            <RequireAuth>
              <UserLayout />
            </RequireAuth>
          }
        >
          <Route path="home" element={<HomePage />} />
          <Route path="perfil" element={<ProfilePage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
          <Route path="loterias" element={<LoteriasPage />} />
          <Route path="loterias/repetir" element={<LoteriasRepetirPage />} />
          <Route path="loterias/repetir/valor" element={<LoteriasRepetirValorPage />} />
          <Route path="loterias/repetir/data" element={<LoteriasRepetirDatePage />} />
          <Route path="loterias/:jogo" element={<LoteriasDatePage />} />
          <Route path="loterias/:jogo/modalidades" element={<LoteriasModalidadesPage />} />
          <Route path="loterias/:jogo/colocacao" element={<LoteriasColocacaoPage />} />
          <Route path="loterias/:jogo/palpites" element={<LoteriasPalpitesPage />} />
          <Route path="loterias/:jogo/valor" element={<LoteriasValorPage />} />
          <Route path="loterias/:jogo/resumo" element={<LoteriasResumoPage />} />
          <Route path="loterias-sorteios" element={<LoteriasSorteiosPage />} />
          <Route path="loterias-final" element={<LoteriasFinalPage />} />
          <Route path="pules" element={<PulesPage />} />
          <Route path="relatorios" element={<ReportsPage />} />
          <Route path="relatorios/consulta-saldo" element={<BalanceReportPage />} />
          <Route path="relatorios/cotacoes" element={<QuotesPage />} />
          <Route path="relatorios/cotacoes/:slug" element={<QuoteDetailPage />} />
          <Route path="relatorios/pules-resultado" element={<ResultPulesPage />} />
          <Route path="pix/recarga" element={<PixRechargePage />} />
        </Route>

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
    </>
  );
}

export default App;

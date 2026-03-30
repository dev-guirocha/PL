import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import Spinner from './components/Spinner';
import UserLayout from './components/UserLayout';
import AdminDashboard from './pages/AdminDashboard';
import AuthPage from './pages/AuthPage';
import BalanceReportPage from './pages/BalanceReportPage';
import HomePage from './pages/HomePage';
import LoteriasColocacaoPage from './pages/LoteriasColocacaoPage';
import LoteriasDatePage from './pages/LoteriasDatePage';
import LoteriasFinalPage from './pages/LoteriasFinalPage';
import LoteriasModalidadesPage from './pages/LoteriasModalidadesPage';
import LoteriasPage from './pages/LoteriasPage';
import LoteriasPalpitesPage from './pages/LoteriasPalpitesPage';
import LoteriasRepetirDatePage from './pages/LoteriasRepetirDatePage';
import LoteriasRepetirPage from './pages/LoteriasRepetirPage';
import LoteriasRepetirValorPage from './pages/LoteriasRepetirValorPage';
import LoteriasResumoPage from './pages/LoteriasResumoPage';
import LoteriasSorteiosPage from './pages/LoteriasSorteiosPage';
import LoteriasValorPage from './pages/LoteriasValorPage';
import PixRechargePage from './pages/PixRechargePage';
import ProfilePage from './pages/ProfilePage';
import PulesPage from './pages/PulesPage';
import QuoteDetailPage from './pages/QuoteDetailPage';
import QuotesPage from './pages/QuotesPage';
import ReportsPage from './pages/ReportsPage';
import ResultPulesPage from './pages/ResultPulesPage';
import SettingsPage from './pages/SettingsPage';
import StatementPage from './pages/StatementPage';
import SupervisorDashboard from './pages/SupervisorDashboard';
import WithdrawPage from './pages/WithdrawPage';
import WonBetsPage from './pages/WonBetsPage';

const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminBetsPage = lazy(() => import('./pages/admin/AdminBetsPage'));
const AdminWonBetsPage = lazy(() => import('./pages/admin/AdminWonBetsPage'));
const AdminSupervisorsPage = lazy(() => import('./pages/admin/AdminSupervisorsPage'));
const AdminResultsPage = lazy(() => import('./pages/admin/AdminResultsPage'));
const AdminWithdrawalsPage = lazy(() => import('./pages/admin/AdminWithdrawalsPage'));
const AdminCouponsPage = lazy(() => import('./pages/admin/AdminCouponsPage'));
const LoteriasQuininhaPage = lazy(() => import('./pages/LoteriasQuininhaPage'));
const LoteriasSeninhaPage = lazy(() => import('./pages/LoteriasSeninhaPage'));
const LoteriasSuper15Page = lazy(() => import('./pages/LoteriasSuper15Page'));
const LoteriasQuininhaQuantidadePage = lazy(() => import('./pages/LoteriasQuininhaQuantidadePage'));
const LoteriasSeninhaQuantidadePage = lazy(() => import('./pages/LoteriasSeninhaQuantidadePage'));

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
  if (!token) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Spinner />
        </div>
      }
    >
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
          <Route path="loterias/quininha/jogar" element={<LoteriasQuininhaPage />} />
          <Route path="loterias/quininha/quantidade" element={<LoteriasQuininhaQuantidadePage />} />
          <Route path="loterias/seninha/jogar" element={<LoteriasSeninhaPage />} />
          <Route path="loterias/seninha/quantidade" element={<LoteriasSeninhaQuantidadePage />} />
          <Route path="loterias/super15/jogar" element={<LoteriasSuper15Page />} />
          <Route path="pules" element={<PulesPage />} />
          <Route path="premiadas" element={<WonBetsPage />} />
          <Route path="extrato" element={<StatementPage />} />
          <Route path="relatorios" element={<ReportsPage />} />
          <Route path="relatorios/consulta-saldo" element={<BalanceReportPage />} />
          <Route path="relatorios/cotacoes" element={<QuotesPage />} />
          <Route path="relatorios/cotacoes/:slug" element={<QuoteDetailPage />} />
          <Route path="relatorios/pules-resultado" element={<ResultPulesPage />} />
          <Route path="pix/recarga" element={<PixRechargePage />} />
          <Route path="saque" element={<WithdrawPage />} />
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
          path="/admin/bets/winners"
          element={
            <RequireAdmin>
              <AdminWonBetsPage />
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
    </Suspense>
  );
}

export default App;

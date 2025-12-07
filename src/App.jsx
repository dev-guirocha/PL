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

const getStoredToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

const RequireAuth = ({ children }) => {
  const token = getStoredToken();
  return token ? children : <Navigate to="/" replace />;
};

function App() {
  return (
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

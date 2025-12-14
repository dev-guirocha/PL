import React, { useEffect, useMemo, useState } from 'react';
import { FaBars, FaEye, FaEyeSlash, FaHome, FaTicketAlt, FaReceipt, FaUser, FaSignOutAlt, FaChartBar, FaWallet, FaMobileAlt } from 'react-icons/fa';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';
import logo from '../assets/images/logo.png';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const navLinks = [
  { label: 'Início', icon: <FaHome />, path: '/home' },
  { label: 'Apostar', icon: <FaTicketAlt />, path: '/loterias-sorteios' },
  { label: 'Pules', icon: <FaReceipt />, path: '/pules' },
  { label: 'Perfil', icon: <FaUser />, path: '/perfil' },
];

const extraMenuLinks = [
  { label: 'Relatórios', icon: <FaChartBar />, path: '/relatorios' },
  { label: 'Consulta saldo', icon: <FaWallet />, path: '/relatorios/consulta-saldo' },
];

const UserLayout = ({ children }) => {
  const outlet = useOutlet();
  const content = children || outlet;
  const navigate = useNavigate();
  const location = useLocation();
  const { balance, bonus, loadingUser, refreshUser, logout, user } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const { canInstall, promptInstall } = useInstallPrompt();

  const activePath = useMemo(() => location.pathname, [location.pathname]);
  const numericBalance = Number(balance ?? 0);
  const numericBonus = Number(bonus ?? 0);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activePath]);

  const handleNav = (path) => {
    navigate(path);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="fixed inset-x-0 top-0 z-40 bg-emerald-700 text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="flex flex-none items-center gap-3">
            <img
              src={logo}
              alt="Logo"
              className="h-12 w-auto object-contain"
              style={{ transform: 'scale(2.5)', transformOrigin: 'left center' }}
            />
          </div>

          <div className="flex flex-1 items-center justify-center">
            {user?.id ? (
              <span className="rounded-full bg-emerald-800/60 px-3 py-1 text-xs font-semibold">ID: {user.id}</span>
            ) : null}
          </div>

          <div className="flex flex-none items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-emerald-800/60 px-3 py-1 text-sm font-semibold">
              <span>Saldo:</span>
              {loadingUser ? (
                <Spinner size={16} color="#fff" />
              ) : (
                <span>{showBalance ? `R$ ${numericBalance.toFixed(2).replace('.', ',')}` : '••••'}</span>
              )}
              <button
                type="button"
                aria-label="Alternar visibilidade do saldo"
                className="text-white/80 transition hover:text-white"
                onClick={() => setShowBalance((prev) => !prev)}
              >
                {showBalance ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <div className="hidden items-center rounded-full bg-emerald-800/60 px-3 py-1 text-xs font-semibold md:flex">
              Bônus: {showBalance ? `R$ ${numericBonus.toFixed(2).replace('.', ',')}` : '••••'}
            </div>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <FaBars />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-screen max-w-6xl px-4 pb-24 pt-20">{content}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
          {navLinks.map((link) => {
            const isActive = activePath === link.path || activePath.startsWith(`${link.path}/`);
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => handleNav(link.path)}
                className={`flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  isActive ? 'text-emerald-700' : 'text-slate-500 hover:text-emerald-700'
                }`}
              >
                <span className={`text-lg ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>{link.icon}</span>
                {link.label}
              </button>
            );
          })}
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute right-0 top-0 flex h-full w-72 max-w-full flex-col gap-3 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-emerald-700">Olá, {user?.name || 'Usuário'}</span>
                <span className="text-xs text-slate-500">ID: {user?.id || '---'}</span>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                onClick={() => setMenuOpen(false)}
              >
                Fechar
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {[...navLinks, ...extraMenuLinks].map((item) => (
                <button
                  key={item.path || item.label}
                  type="button"
                  onClick={() => (item.path ? handleNav(item.path) : null)}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 text-left text-slate-700 transition hover:border-emerald-100 hover:bg-emerald-50"
                >
                  <span className="text-emerald-700">{item.icon}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{item.label}</span>
                    {item.path === '/relatorios/consulta-saldo' ? (
                      <span className="text-xs text-slate-500">
                        Bônus: {showBalance ? `R$ ${numericBonus.toFixed(2).replace('.', ',')}` : '••••'}
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
              {canInstall && (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await promptInstall();
                    if (res?.outcome === 'accepted') {
                      navigate('/home');
                    }
                  }}
                  className="flex items-center gap-3 rounded-xl border border-emerald-100 px-3 py-2 text-left text-emerald-800 transition hover:border-emerald-200 hover:bg-emerald-50"
                >
                  <span className="text-emerald-700">
                    <FaMobileAlt />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">Adicionar atalho do app</span>
                    <span className="text-xs text-emerald-700">Instale na tela inicial do celular</span>
                  </div>
                </button>
              )}
            </div>

            <div className="mt-auto">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-800"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                <FaSignOutAlt />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserLayout;

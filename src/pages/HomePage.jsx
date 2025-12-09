import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChartBar, FaFileAlt, FaTrophy, FaWallet } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../utils/api';
import casinoImg from '../assets/images/casino.jpeg';
import bingoImg from '../assets/images/bingo.jpeg';
import suporteImg from '../assets/images/suporte.jpeg';
import pixImg from '../assets/images/pix.jpeg';
import loteriasImg from '../assets/images/loterias.jpeg';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

const HomePage = () => {
  const navigate = useNavigate();
  const { user, loadingUser, refreshUser, authError } = useAuth();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const createPixCharge = async () => {
    if (!user) {
      navigate('/');
      return;
    }
    try {
      const res = await api.post('/pix/charge', { amount: 20 });
      const copy = res.data?.copyAndPaste || 'Cobrança Pix criada.';
      let copied = false;
      if (navigator?.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(copy);
          copied = true;
          toast.success('Código Pix copiado!');
        } catch {
          copied = false;
        }
      }
      if (!copied) {
        toast.info(`Copie e cole no seu app bancário:\n${copy}`, { autoClose: 5000 });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar cobrança Pix.');
    }
  };

  const openSupport = () => {
    const phone = '55799989357214'; // (79) 99893-57214
    const message = `Olá Promotor, preciso de ajuda, meu código de unidade é: ${user?.id || 'ID'}`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const shortcutItems = [
    { label: 'Resultados', icon: <FaChartBar />, action: () => navigate('/relatorios/pules-resultado') },
    { label: 'Relatórios', icon: <FaFileAlt />, action: () => navigate('/relatorios') },
    { label: 'Premiadas', icon: <FaTrophy />, action: () => {} },
    { label: 'Saldo', icon: <FaWallet />, action: () => navigate('/relatorios/consulta-saldo') },
  ];

  useEffect(() => {
    refreshUser();
  }, [refreshUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const tiles = [
    { title: 'Loterias', image: loteriasImg, action: () => navigate('/loterias') },
    { title: 'Cassino', image: casinoImg, action: () => window.open('https://pandaloterias.com.br', '_blank') },
    { title: 'Bingo', image: bingoImg, action: () => toast.info('Bingo ainda está em implementação.') },
    { title: 'Suporte', image: suporteImg, action: openSupport },
    { title: 'Recarga Pix', image: pixImg, action: createPixCharge },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center space-y-6 px-3">
      {showShortcuts && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowShortcuts(false)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-base font-bold text-emerald-700">Atalhos</div>
            <div className="grid grid-cols-2 gap-3">
              {shortcutItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="flex items-center gap-2 rounded-xl border border-emerald-50 bg-emerald-50 px-3 py-3 text-left text-emerald-800 transition hover:border-emerald-100 hover:bg-emerald-100"
                  onClick={() => {
                    setShowShortcuts(false);
                    item.action();
                  }}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm font-semibold">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-r from-emerald-50 via-white to-emerald-50 px-5 py-4 shadow-lg">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Bem-vindo</p>
            <h2 className="text-2xl font-extrabold text-emerald-800">Olá, {user?.name || 'jogador'}!</h2>
            <p className="text-sm text-slate-600">Escolha um produto para começar.</p>
          </div>
          {loadingUser ? (
            <div className="flex items-center gap-2 rounded-xl bg-white/80 px-4 py-3 text-emerald-700 shadow">
              <Spinner size={18} />
              <span className="text-sm font-semibold">Carregando saldo</span>
            </div>
          ) : null}
        </div>
        {authError ? <div className="mt-3 text-sm font-semibold text-red-600">{authError}</div> : null}
      </div>

      <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((card) => (
          <button
            key={card.title}
            type="button"
            aria-label={card.title}
            className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-emerald-100 text-left shadow-md transition hover:-translate-y-1 hover:shadow-xl"
            style={{
              backgroundImage: `url(${card.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            onClick={card.action}
          >
          </button>
        ))}
      </div>

      <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-2">
        <button
          type="button"
          className="grid aspect-[4/5] w-full grid-cols-2 grid-rows-2 gap-2 rounded-xl border border-emerald-50 bg-white p-3 text-emerald-800 shadow-md transition hover:-translate-y-1 hover:shadow-xl"
          onClick={() => setShowShortcuts(true)}
        >
          {[<FaChartBar key="1" />, <FaFileAlt key="2" />, <FaTrophy key="3" />, <FaWallet key="4" />].map((icon, idx) => (
            <div
              key={idx}
              className="flex items-center justify-center rounded-lg bg-emerald-50 text-xl font-bold text-emerald-700 shadow-inner"
            >
              {icon}
            </div>
          ))}
        </button>

        <div className="grid aspect-[4/5] w-full grid-cols-2 grid-rows-2 gap-2 rounded-xl border border-emerald-50 bg-white p-3 text-emerald-800 shadow-md">
          {['🎁', '♌', '💤', '⏰'].map((emoji) => (
            <div
              key={emoji}
              className="flex items-center justify-center rounded-lg bg-emerald-50 text-2xl"
              role="presentation"
            >
              {emoji}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomePage;

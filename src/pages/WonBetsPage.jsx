import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDateTimeBR } from '../utils/date';

const WonBetsPage = () => {
  const navigate = useNavigate();
  const { refreshUser, authError } = useAuth();
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWon = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/bets/public-winners', { params: { take: 80, skip: 0 } });
      setWinners(res.data?.winners || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar premiadas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
    fetchWon();
  }, [refreshUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 px-4 py-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <button
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-lg transition hover:from-emerald-800 hover:to-emerald-700"
          onClick={() => navigate('/home')}
        >
          Voltar
        </button>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase text-emerald-700">Premiadas</p>
          <h1 className="text-lg font-extrabold text-emerald-900">Últimas apostas ganhadoras</h1>
          <p className="text-xs text-slate-500">Transparência sem expor nomes dos usuários.</p>
        </div>
      </div>

      {(error || authError) && (
        <div className="mx-auto mt-3 max-w-4xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow">
          {error || authError}
        </div>
      )}

      <div className="mx-auto mt-4 flex max-w-5xl flex-col gap-3">
        {loading && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-slate-600 shadow">
            <Spinner size={32} />
          </div>
        )}

        {!loading && winners.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-slate-600 shadow">
            Nenhuma aposta premiada encontrada.
          </div>
        )}

        {winners.map((winner, idx) => (
          <div
            key={`${winner.userId}-${winner.createdAt || idx}`}
            className="flex flex-col gap-2 rounded-2xl border border-emerald-50 bg-white px-4 py-4 text-emerald-800 shadow-lg"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
              <span className="text-base">Usuário #{winner.userId}</span>
              <span className="text-sm font-semibold">{formatDateTimeBR(winner.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold">
              <span>Modalidade:</span>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-extrabold text-emerald-700 uppercase">
                {winner.modalidade || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold">
              <span>Prêmio:</span>
              <span className="text-emerald-700">{formatCurrency(winner.prize || 0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WonBetsPage;

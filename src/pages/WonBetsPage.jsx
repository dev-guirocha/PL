import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDateBR, formatDateTimeBR } from '../utils/date';

const WonBetsPage = () => {
  const navigate = useNavigate();
  const { refreshUser, authError } = useAuth();
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWon = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/bets/my-bets', { params: { take: 50, skip: 0, statuses: 'won,paid' } });
      setBets(res.data?.bets || []);
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
          <h1 className="text-lg font-extrabold text-emerald-900">Minhas apostas premiadas</h1>
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

        {!loading && bets.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-slate-600 shadow">
            Nenhuma aposta premiada encontrada.
          </div>
        )}

        {bets.map((pule) => (
          <div
            key={pule.id}
            className="flex flex-col gap-2 rounded-2xl border border-emerald-50 bg-white px-4 py-4 text-emerald-800 shadow-lg"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
              <span className="text-base">{pule.loteria || 'Loteria'}</span>
              <span className="text-xs text-gray-600">{pule.betRef || `${pule.userId || ''}-${pule.id}`}</span>
              <span className="text-sm font-semibold">{formatDateTimeBR(pule.createdAt)}</span>
            </div>
            {pule.codigoHorario && <span className="text-xs text-slate-500">Horário: {pule.codigoHorario}</span>}
            <div className="flex items-center justify-between text-sm font-bold">
              <span>Status:</span>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-extrabold text-emerald-700 uppercase">
                {pule.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold">
              <span>Prêmio:</span>
              <span className="text-emerald-700">{formatCurrency(pule.prize || 0)}</span>
            </div>
            {(pule.apostas || []).map((ap, i) => (
              <div key={`${pule.id}-ap-${i}`} className="mt-2 border-t border-dashed border-emerald-100 pt-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{ap.modalidade || ap.jogo || 'Aposta'}</span>
                  <span className="text-xs text-slate-500">{formatDateBR(ap.data) || ''}</span>
                </div>
                {ap.colocacao && <span className="text-xs text-slate-500">Prêmio: {ap.colocacao}</span>}
                {ap.palpites?.length ? (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {ap.palpites.map((n, j) => (
                      <span
                        key={`${n}-${j}`}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WonBetsPage;

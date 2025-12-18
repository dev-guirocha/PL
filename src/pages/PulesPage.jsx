import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import api from '../utils/api';
import { generatePulePDF } from '../utils/pdfGenerator';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { formatDateBR, formatDateTimeBR } from '../utils/date';

const PulesPage = () => {
  const navigate = useNavigate();
  const { balance, loadingUser, refreshUser, authError } = useAuth();
  const [bets, setBets] = useState([]);
  const [showBalance, setShowBalance] = useState(true);
  const [error, setError] = useState('');
  const [loadingBets, setLoadingBets] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const take = 10;

  const fetchBets = async ({ replace = false } = {}) => {
    setLoadingBets(true);
    try {
      const skip = replace ? 0 : bets.length;
      const res = await api.get('/bets/my-bets', { params: { take, skip } });
      const newBets = res.data?.bets || [];
      setBets((prev) => (replace ? newBets : [...prev, ...newBets]));
      const total = res.data?.total ?? 0;
      setHasMore(skip + newBets.length < total);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar pules.');
    } finally {
      setLoadingBets(false);
    }
  };

  useEffect(() => {
    refreshUser();
    fetchBets({ replace: true });
  }, [refreshUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;
  const isInitialBetsLoading = loadingBets && bets.length === 0;
  const deriveTotals = (ap) => {
    const valorBase = Number(ap?.valorAposta ?? ap?.valorPorNumero ?? ap?.total ?? 0) || 0;
    const qtd = ap?.palpites?.length || 0;
    const isCada = ap?.modoValor === 'cada';
    const total = isCada ? valorBase * Math.max(qtd, 1) : valorBase;
    const valorPorNumero = isCada ? valorBase : qtd ? valorBase / qtd : valorBase;
    return { total, valorPorNumero };
  };

  const handleSharePdf = (pule) => {
    generatePulePDF(pule);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 px-4 py-6">
      <div className="mx-auto flex max-w-5xl items-center justify-end">
        <button
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-lg transition hover:from-emerald-800 hover:to-emerald-700"
          onClick={() => navigate('/home')}
        >
          Voltar
        </button>
      </div>

      {(error || authError) && (
        <div className="mx-auto mt-3 max-w-4xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow">
          {error || authError}
        </div>
      )}

      <div className="mx-auto mt-4 flex max-w-5xl flex-col gap-3">
        {isInitialBetsLoading && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-slate-600 shadow">
            <Spinner size={32} />
          </div>
        )}

        {!isInitialBetsLoading && bets.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-slate-600 shadow">
            Nenhuma PULE encontrada.
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
            {(pule.apostas || []).map((ap, i) => (
              <div key={`${pule.id}-ap-${i}`} className="mt-2 border-t border-dashed border-emerald-100 pt-2 text-sm">
                {(() => {
                  const { total: apTotal, valorPorNumero } = deriveTotals(ap);
                  return (
                    <>
              <div className="flex items-center justify-between">
                <span className="font-semibold">{ap.modalidade || ap.jogo || 'Aposta'}</span>
                <span className="text-xs text-slate-500">{formatDateBR(ap.data) || ''}</span>
              </div>
              {ap.colocacao && <span className="text-xs text-slate-500">Prêmio: {ap.colocacao}</span>}
              <span className="text-xs text-slate-500">Qtd palpites: {ap.palpites?.length || 0}</span>
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
              <div className="mt-1 flex items-center justify-between font-semibold">
                <span>Valor por número:</span>
                <span>{formatCurrency(valorPorNumero)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Valor da aposta:</span>
                <span>{formatCurrency(apTotal)}</span>
              </div>
                    </>
                  );
                })()}
              </div>
            ))}
            <div className="flex items-center justify-between text-sm font-bold">
              <span>Total:</span>
              <span>{formatCurrency(pule.total)}</span>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition"
                onClick={() => handleSharePdf(pule)}
              >
                Compartilhar / PDF
              </button>
            </div>
          </div>
        ))}

        {hasMore ? (
          <div className="flex justify-center">
            <button
              disabled={loadingBets}
              onClick={() => !loadingBets && fetchBets()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm font-bold text-emerald-800 shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingBets ? <Spinner size={18} /> : 'Carregar mais'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PulesPage;

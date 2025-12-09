import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';
import api from '../utils/api';
import { formatDateBR, formatDateTimeBR } from '../utils/date';

const ResultPulesPage = () => {
  const navigate = useNavigate();
  const [pules, setPules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterLottery, setFilterLottery] = useState('');

  const LOTERIAS = [
    'LT PT RIO',
    'LT MALUQ RIO',
    'LT NACIONAL',
    'LT LOOK',
    'LT BOASORTE',
    'PT SP',
    'LT BAND',
    'LT LOTEP',
    'LT LOTECE',
    'LT BAHIA',
    'LT BA MALUCA',
    'LT CAPITAL',
    'LT ALVORADA',
    'LT MINAS DIA',
    'LT MINAS NOITE',
    'LT SORTE',
    'LT URUGUAI',
  ];

  const fetchPules = async ({ loteria = filterLottery, date = filterDate } = {}) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/bets/result-pules', { params: { take: 100, skip: 0, loteria, date } });
      const list = res.data?.pules || [];
      setPules(list);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar pules de resultados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPules();
  }, []);

  const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;
  const deriveTotals = (ap) => {
    const valorBase = Number(ap?.valorAposta ?? ap?.valorPorNumero ?? ap?.total ?? 0) || 0;
    const qtd = ap?.palpites?.length || 0;
    const isCada = ap?.modoValor === 'cada';
    const total = isCada ? valorBase * Math.max(qtd, 1) : valorBase;
    const valorPorNumero = isCada ? valorBase : qtd ? valorBase / qtd : valorBase;
    return { total, valorPorNumero };
  };

  const buildPairs = (pule) => {
    const nums = Array.isArray(pule.numeros) ? pule.numeros : [];
    const groups = Array.isArray(pule.grupos) ? pule.grupos : [];
    const max = Math.max(nums.length, groups.length, 7);
    return Array.from({ length: max }).map((_, idx) => {
      const num = nums[idx] ?? '—';
      let group = groups[idx];
      if (!group) {
        const digits = String(num).replace(/\D/g, '').slice(-2);
        if (digits) {
          const val = parseInt(digits, 10);
          if (!Number.isNaN(val)) {
            const g = val === 0 ? 25 : Math.ceil(val / 4);
            group = String(g).padStart(2, '0');
          }
        }
      }
      return { label: `N${idx + 1}`, number: num || '—', group: group || '—' };
    });
  };

  const isEmpty = !loading && pules.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 px-4 py-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <button
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-lg transition hover:from-emerald-800 hover:to-emerald-700"
          onClick={() => navigate('/relatorios')}
        >
          Voltar
        </button>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase text-emerald-700">Relatório</p>
          <h1 className="text-lg font-extrabold text-emerald-900">Pules de Resultados</h1>
        </div>
      </div>

      {error && (
        <div className="mx-auto mt-3 max-w-4xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow">
          {error}
        </div>
      )}

      <div className="mx-auto mt-4 max-w-5xl rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:gap-3 flex-1">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Data</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de loteria</label>
              <select
                value={filterLottery}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterLottery(val);
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
              >
                <option value="">Todas</option>
                {LOTERIAS.map((lot) => (
                  <option key={lot} value={lot}>
                    {lot}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchPules({ loteria: filterLottery, date: filterDate })}
              className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
              disabled={loading}
            >
              Buscar
            </button>
            <button
              onClick={() => {
                setFilterDate('');
                setFilterLottery('');
                fetchPules({ loteria: '', date: '' });
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              disabled={loading}
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 flex max-w-5xl flex-col gap-3">
        {loading && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-slate-600 shadow">
            <Spinner size={32} />
          </div>
        )}

        {isEmpty && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-slate-600 shadow">
            Nenhuma PULE de resultado encontrada.
          </div>
        )}

        {pules.map((pule) => (
          <div
            key={pule.id}
            className="flex flex-col gap-2 rounded-2xl border border-emerald-50 bg-white px-4 py-4 text-emerald-800 shadow-lg"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
              <span className="text-base">{pule.loteria || 'Loteria'}</span>
              <span className="text-xs text-gray-600">{pule.betRef || `RESULT-${pule.id}`}</span>
              {pule.dataJogo ? (
                <span className="text-xs font-semibold text-emerald-700">Data do jogo: {formatDateBR(pule.dataJogo)}</span>
              ) : null}
            </div>
            {pule.codigoHorario && <span className="text-xs text-slate-500">Horário: {pule.codigoHorario}</span>}
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
              Comparativo (Resultado)
            </span>

            <div className="mt-2 grid grid-cols-1 gap-2 border-t border-dashed border-emerald-100 pt-2 text-sm md:grid-cols-2">
              {buildPairs(pule).map((pair, i) => (
                <div key={`${pule.id}-pair-${i}`} className="flex items-center justify-between rounded-lg border border-emerald-50 bg-emerald-50/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-bold uppercase text-white">{pair.label}</span>
                    <span className="text-sm font-semibold text-emerald-800">{pair.number}</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700">Grupo: {pair.group}</span>
                </div>
              ))}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultPulesPage;

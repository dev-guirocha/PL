import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { formatDateBR, formatDateTimeBR } from '../utils/date';
import { setDraft } from '../utils/receipt';
import api from '../utils/api';

const LoteriasRepetirPage = () => {
  const navigate = useNavigate();
  const { refreshUser, authError } = useAuth();
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterModalidade, setFilterModalidade] = useState('');

  const fetchBets = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/bets/my-bets', { params: { take: 100, skip: 0 } });
      setBets(res.data?.bets || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar PULES.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
    fetchBets();
  }, [refreshUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const modalities = useMemo(() => {
    const set = new Set();
    bets.forEach((b) => {
      (b.apostas || []).forEach((ap) => {
        if (ap.modalidade) set.add(ap.modalidade.toUpperCase());
      });
    });
    return Array.from(set).sort();
  }, [bets]);

  const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;

  const buildDraftFromPule = (pule) => {
    const all = pule?.apostas || [];
    if (!all.length) return null;

    const base = all[0];
    const valorBase = Number(base?.valorAposta ?? base?.valorPorNumero ?? base?.total ?? 0) || 0;
    const modoValor = base?.modoValor || (base?.palpites?.length > 1 ? 'cada' : 'todos');

    const apostasNorm = all.map((ap) => {
      const vb = Number(ap?.valorAposta ?? ap?.valorPorNumero ?? ap?.total ?? valorBase) || valorBase;
      const mv = ap?.modoValor || modoValor;
      const qtd = ap?.palpites?.length || 0;
      const total = mv === 'cada' ? vb * Math.max(qtd, 1) : vb;
      return {
        ...ap,
        data: ap?.data || null,
        modalidade: ap?.modalidade || ap?.jogo || '',
        colocacao: ap?.colocacao || null,
        palpites: ap?.palpites || [],
        valorAposta: vb,
        modoValor: mv,
        total,
      };
    });

    const hasValendoShape = apostasNorm.length > 1;
    const allPalpites = apostasNorm
      .flatMap((a) => a?.palpites || [])
      .map((p) => String(p || '').replace(/\D/g, ''));
    const base4 = allPalpites.filter((p) => p.length === 4);
    const base3 = allPalpites.filter((p) => p.length === 3);
    const baseDigits = base4.length ? 4 : base3.length ? 3 : null;
    const basePalpites = base4.length ? base4 : base3;

    return {
      jogo: base?.jogo || pule.loteria || '',
      slug: null,
      data: base?.data || null,
      codigoHorario: pule.codigoHorario || null,
      selecoes: [],
      loteria: pule.loteria || null,
      modalidade: base?.modalidade || base?.jogo || '',
      colocacao: base?.colocacao || null,
      palpites: base?.palpites || [],
      valorAposta: valorBase,
      modoValor,
      currentSaved: false,
      apostas: apostasNorm,
      valendo: hasValendoShape
        ? { locked: true, baseDigits, basePalpites }
        : { locked: false, baseDigits, basePalpites },
      repeatSource: {
        betId: pule.id,
        betRef: pule.betRef || `${pule.userId || ''}-${pule.id}`,
        loteria: pule.loteria || null,
        codigoHorario: pule.codigoHorario || null,
        createdAt: pule.createdAt || null,
      },
    };
  };

  const handleRepeat = (pule, ap) => {
    const valorBase = Number(ap?.valorAposta ?? ap?.valorPorNumero ?? ap?.total ?? 0) || 0;
    const modoValor = ap?.modoValor || (ap?.palpites?.length > 1 ? 'cada' : 'todos');
    const newDraft = {
      jogo: ap?.jogo || pule.loteria || '',
      slug: null,
      data: ap?.data || null,
      codigoHorario: pule.codigoHorario || null,
      selecoes: [],
      loteria: pule.loteria || null,
      modalidade: ap?.modalidade || ap?.jogo || '',
      colocacao: ap?.colocacao || null,
      palpites: ap?.palpites || [],
      valorAposta: valorBase,
      modoValor,
      currentSaved: false,
      apostas: [
        {
          ...ap,
          data: ap?.data || null,
          modalidade: ap?.modalidade || ap?.jogo || '',
          colocacao: ap?.colocacao || null,
          palpites: ap?.palpites || [],
          valorAposta: valorBase,
          modoValor,
          total: ap?.total ?? valorBase,
        },
      ],
      repeatSource: {
        betId: pule.id,
        betRef: pule.betRef || `${pule.userId || ''}-${pule.id}`,
        loteria: pule.loteria || null,
        codigoHorario: pule.codigoHorario || null,
        createdAt: pule.createdAt || null,
      },
    };
    setDraft(newDraft);
    toast.success(`PULE ${newDraft.repeatSource.betRef} carregada. Informe o valor e prossiga.`);
    navigate('/loterias/repetir/valor');
  };

  const handleRepeatFullPule = (pule) => {
    const newDraft = buildDraftFromPule(pule);
    if (!newDraft) return;
    setDraft(newDraft);
    toast.success(`PULE ${newDraft.repeatSource.betRef} carregada (PULE inteira). Informe o valor e prossiga.`);
    navigate('/loterias/repetir/valor');
  };

  const filteredBets = useMemo(() => {
    if (!filterModalidade) return bets;
    return bets
      .map((b) => ({
        ...b,
        apostas: (b.apostas || []).filter(
          (ap) => (ap.modalidade || '').toUpperCase() === filterModalidade,
        ),
      }))
      .filter((b) => b.apostas && b.apostas.length);
  }, [bets, filterModalidade]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 px-4 py-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <button
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-lg transition hover:from-emerald-800 hover:to-emerald-700"
          onClick={() => navigate('/loterias')}
        >
          Voltar
        </button>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase text-emerald-700">Repetir PULE</p>
          <h1 className="text-lg font-extrabold text-emerald-900">Escolha uma aposta para repetir</h1>
        </div>
      </div>

      {(error || authError) && (
        <div className="mx-auto mt-3 max-w-4xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow">
          {error || authError}
        </div>
      )}

      <div className="mx-auto mt-4 max-w-5xl rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Filtrar por modalidade</label>
            <select
              value={filterModalidade}
              onChange={(e) => setFilterModalidade(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
            >
              <option value="">Todas</option>
              {modalities.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 flex max-w-5xl flex-col gap-3">
        {loading && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-slate-600 shadow">
            <Spinner size={32} />
          </div>
        )}

        {!loading && filteredBets.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-slate-600 shadow">
            Nenhuma PULE encontrada para repetir.
          </div>
        )}

        {filteredBets.map((pule) => (
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

            {(pule.apostas || []).length > 1 && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="rounded-lg border border-emerald-400 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
                  onClick={() => handleRepeatFullPule(pule)}
                >
                  Repetir PULE inteira (VALENDO)
                </button>
              </div>
            )}

            {(pule.apostas || []).map((ap, i) => {
              const { total: apTotal, valorPorNumero } = (() => {
                const valorBase = Number(ap?.valorAposta ?? ap?.valorPorNumero ?? ap?.total ?? 0) || 0;
                const qtd = ap?.palpites?.length || 0;
                const isCada = ap?.modoValor === 'cada';
                const total = isCada ? valorBase * Math.max(qtd, 1) : valorBase;
                const vPorNumero = isCada ? valorBase : qtd ? valorBase / qtd : valorBase;
                return { total, valorPorNumero: vPorNumero };
              })();
              return (
                <div key={`${pule.id}-ap-${i}`} className="mt-2 border-t border-dashed border-emerald-100 pt-2 text-sm">
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
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                      onClick={() => handleRepeat(pule, ap)}
                    >
                      Repetir esta aposta
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoteriasRepetirPage;

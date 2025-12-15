import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDraft, updateDraft } from '../utils/receipt';
import { useAuth } from '../context/AuthContext';

const QUANTIDADES = [13, 14, 15, 16, 17, 18, 19, 20, 25, 30, 35, 40, 45];

const LoteriasQuininhaQuantidadePage = () => {
  const navigate = useNavigate();
  const { refreshUser, authError } = useAuth();
  const [draft, setDraft] = useState({});
  const [selectedQtd, setSelectedQtd] = useState(13);

  useEffect(() => {
    refreshUser();
    const d = getDraft();
    setDraft(d);
    if (d?.quininhaQtd) setSelectedQtd(Number(d.quininhaQtd));
  }, [refreshUser]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-xl bg-white shadow-lg rounded-2xl p-6 space-y-4 border border-slate-100">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-emerald-700">Quininha - Quantidade de números</h1>
          <button
            type="button"
            className="text-sm text-emerald-700 font-bold underline"
            onClick={() => navigate('/loterias')}
          >
            Voltar
          </button>
        </div>

        {authError && <div className="text-red-600 text-sm font-semibold">{authError}</div>}

        <p className="text-sm text-slate-600">
          Escolha quantos números deseja cercar (mais números aumentam a chance, mas reduzem a cotação).
        </p>

        <div className="flex flex-col divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
          {QUANTIDADES.map((qtd) => {
            const active = selectedQtd === qtd;
            return (
              <button
                key={qtd}
                type="button"
                onClick={() => setSelectedQtd(qtd)}
                className={`flex items-center justify-between px-4 py-3 text-left transition ${
                  active ? 'bg-emerald-50 text-emerald-800 font-bold' : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Jogar com {qtd} números</span>
                {active && <span className="text-xs font-bold uppercase text-emerald-700">Selecionado</span>}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-sm font-extrabold uppercase text-white shadow-xl transition hover:-translate-y-0.5 hover:from-emerald-700 hover:to-emerald-600"
          onClick={() => {
            updateDraft({ ...draft, quininhaQtd: selectedQtd });
            navigate('/loterias/quininha/jogar');
          }}
        >
          Continuar para escolher números
        </button>
      </div>
    </div>
  );
};

export default LoteriasQuininhaQuantidadePage;

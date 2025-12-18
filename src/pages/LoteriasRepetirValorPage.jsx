import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import { getDraft, updateDraft } from '../utils/receipt';
import { useAuth } from '../context/AuthContext';
import { formatDateBR } from '../utils/date';

const LoteriasRepetirValorPage = () => {
  const navigate = useNavigate();
  const { authError, refreshUser } = useAuth();
  const [draft, setDraft] = useState({});
  const [valor, setValor] = useState('');
  const [modoValor, setModoValor] = useState('todos');
  const source = draft?.repeatSource;

  useEffect(() => {
    refreshUser();
    const d = getDraft();
    if (!d?.apostas || !d.apostas.length) {
      navigate('/loterias/repetir');
      return;
    }
    setDraft(d);
    const first = d.apostas[0];
    if (first?.valorAposta) setValor(String(first.valorAposta));
    if (first?.modoValor) setModoValor(first.modoValor);
  }, [refreshUser, navigate]);

  const formatInputMoney = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    const number = Number(digits) / 100;
    return number.toFixed(2);
  };

  const parsedValor = Number(valor) || 0;

  const applyValue = () => {
    if (!draft?.apostas?.length) return;
    const apostasAtualizadas = draft.apostas.map((ap) => {
      const qtd = ap?.palpites?.length || 0;
      const isCada = modoValor === 'cada' || ap?.modoValor === 'cada';
      const total = isCada ? parsedValor * Math.max(qtd, 1) : parsedValor;
      return {
        ...ap,
        valorAposta: parsedValor,
        modoValor: isCada ? 'cada' : 'todos',
        total,
      };
    });
    updateDraft({ ...draft, apostas: apostasAtualizadas, currentSaved: false });
  };

  const handleContinue = () => {
    if (!parsedValor || parsedValor <= 0) return;
    applyValue();
    navigate('/loterias/repetir/data');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 pb-20 font-sans">
      <div className="w-full max-w-4xl flex justify-start">
        <button
          className="bg-emerald-700 text-white font-semibold px-3 py-2 rounded-lg shadow hover:bg-emerald-800 transition"
          onClick={() => navigate('/loterias/repetir')}
        >
          Voltar
        </button>
      </div>

      {authError && <div className="text-red-600 mt-3">{authError}</div>}

      <Card className="w-full max-w-lg flex flex-col gap-4 mt-4">
        <h2 className="text-xl font-bold text-emerald-800 border-b pb-2">Repetir PULE - Valor</h2>

        {source && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <div className="font-semibold">PULE selecionada: {source.betRef}</div>
            {source.loteria && <div>Loteria original: {source.loteria}</div>}
            {source.codigoHorario && <div>Horário original: {source.codigoHorario}</div>}
          </div>
        )}

        {draft?.apostas?.map((ap, idx) => (
          <div key={idx} className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-sm flex flex-col gap-1">
            {ap?.jogo && <span className="font-semibold">Jogo: {ap.jogo}</span>}
            {ap?.data && <span>Data original: {formatDateBR(ap.data)}</span>}
            {ap?.modalidade && <span>Modalidade: {ap.modalidade}</span>}
            {ap?.colocacao && <span>Colocação: {ap.colocacao}</span>}
            <span>Palpites: {ap?.palpites?.length || 0}</span>
            {ap?.palpites?.length ? <span>Meus palpites: {ap.palpites.join(', ')}</span> : null}
          </div>
        ))}

        <p className="text-sm text-gray-600">Digite o valor para repetir esta PULE.</p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            inputMode="decimal"
            min="0"
            value={valor}
            onChange={(e) => {
              const formatted = formatInputMoney(e.target.value);
              setValor(formatted);
            }}
            placeholder="0,00"
            className="flex-1 min-w-[160px] px-3 py-3 border border-gray-300 rounded-lg text-lg focus:ring-emerald-500 focus:border-emerald-500 transition"
          />
        </div>

        <div className="text-sm text-gray-600">Aplicar valor em:</div>
        <div className="flex gap-3 mt-1">
          <button
            className={`flex-1 px-3 py-3 rounded-lg font-semibold border transition ${
              modoValor === 'todos'
                ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                : 'border-gray-300 bg-white text-emerald-800'
            }`}
            onClick={() => setModoValor('todos')}
            type="button"
          >
            Todos
          </button>
          <button
            className={`flex-1 px-3 py-3 rounded-lg font-semibold border transition ${
              modoValor === 'cada'
                ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                : 'border-gray-300 bg-white text-emerald-800'
            }`}
            onClick={() => setModoValor('cada')}
            type="button"
          >
            Cada número
          </button>
        </div>

        <button
          type="button"
          disabled={!parsedValor || parsedValor <= 0}
          onClick={() => {
            applyValue();
            handleContinue();
          }}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-sm font-extrabold uppercase text-white shadow-xl transition hover:-translate-y-0.5 hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-60"
        >
          Escolher data
        </button>
      </Card>
    </div>
  );
};

export default LoteriasRepetirValorPage;

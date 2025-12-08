import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { getDraft, updateDraft } from '../utils/receipt';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import Card from '../components/Card';

const quickAdds = [5, 20, 50, 100];

const LoteriasValorPage = () => {
  const navigate = useNavigate();
  const { jogo } = useParams();
  const { balance, loadingUser, refreshUser, authError } = useAuth();
  const [draft, setDraft] = useState({});
  const [showBalance, setShowBalance] = useState(true);
  const [valor, setValor] = useState('');
  const [modoValor, setModoValor] = useState('todos'); // 'todos' ou 'cada'

  useEffect(() => {
    const d = getDraft();
    setDraft(d);
    if (d?.valorAposta) setValor(String(d.valorAposta));
    if (d?.modoValor) setModoValor(d.modoValor);
    refreshUser();
  }, [refreshUser]);

  const parsedValor = Number(valor) || 0;

  const addQuick = (n) => {
    const current = Number(valor) || 0;
    const next = current + n;
    setValor(String(next));
    updateDraft({ valorAposta: next, modoValor });
  };

  const handleContinue = () => {
    updateDraft({ valorAposta: parsedValor, modoValor, currentSaved: false });
    navigate(`/loterias/${jogo}/resumo`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 pb-20 font-sans">
      <div className="w-full max-w-4xl flex justify-start">
        <button
          className="bg-emerald-700 text-white font-semibold px-3 py-2 rounded-lg shadow hover:bg-emerald-800 transition"
          onClick={() => navigate(`/loterias/${jogo}/palpites`)}
        >
          Voltar
        </button>
      </div>

      {authError && <div className="text-red-600 mt-3">{authError}</div>}

      <Card className="w-full max-w-lg flex flex-col gap-4 mt-4">
        <h2 className="text-xl font-bold text-emerald-800 border-b pb-2">Valor da aposta</h2>

        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-sm flex flex-col gap-1">
          {draft?.jogo && <span className="font-semibold">Jogo: {draft.jogo}</span>}
          {draft?.data && <span>Data: {draft.data}</span>}
          {draft?.modalidade && <span>Modalidade: {draft.modalidade}</span>}
          {draft?.colocacao && <span>Colocação: {draft.colocacao}</span>}
          <span>Palpites: {draft?.palpites?.length || 0}</span>
          {draft?.palpites?.length ? <span>Meus palpites: {draft.palpites.join(', ')}</span> : null}
        </div>

        <p className="text-sm text-gray-600">Digite o valor ou use os atalhos.</p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            className="flex-1 min-w-[160px] px-3 py-3 border border-gray-300 rounded-lg text-lg focus:ring-emerald-500 focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {quickAdds.map((q) => (
            <button
              key={q}
              className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-semibold hover:bg-emerald-100 transition"
              onClick={() => addQuick(q)}
              type="button"
            >
              +{q}
            </button>
          ))}
        </div>

        <div className="text-sm text-gray-600">Aplicar valor em:</div>
        <div className="flex gap-3 mt-1">
          <button
            className={`flex-1 px-3 py-3 rounded-lg font-semibold border transition ${
              modoValor === 'todos'
                ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                : 'border-gray-300 bg-white text-emerald-800'
            }`}
            onClick={() => {
              setModoValor('todos');
              updateDraft({ modoValor: 'todos', valorAposta: parsedValor });
            }}
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
            onClick={() => {
              setModoValor('cada');
              updateDraft({ modoValor: 'cada', valorAposta: parsedValor });
            }}
            type="button"
          >
            Cada
          </button>
        </div>

        <button
          className="w-full py-3 bg-emerald-700 text-white font-semibold rounded-lg shadow hover:bg-emerald-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleContinue}
          disabled={!parsedValor || parsedValor < 1}
          type="button"
        >
          Avançar
        </button>
      </Card>
    </div>
  );
};

export default LoteriasValorPage;

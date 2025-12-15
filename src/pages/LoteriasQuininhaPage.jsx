import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getDraft, updateDraft } from '../utils/receipt';
import { useAuth } from '../context/AuthContext';
import PAYOUTS from '../constants/payouts.json';

const CUTOFF_HOUR = 18;
const CUTOFF_MINUTE = 50; // Encerramento às 18:50 para sorteio das 19:00

const LoteriasQuininhaPage = () => {
  const navigate = useNavigate();
  const { refreshUser, authError } = useAuth();
  const [draft, setDraft] = useState({});
  const [qtdeDezenas, setQtdeDezenas] = useState(13);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [valorAposta, setValorAposta] = useState('');

  useEffect(() => {
    refreshUser();
    const d = getDraft();
    setDraft(d);
    if (d?.quininhaQtd) setQtdeDezenas(Number(d.quininhaQtd));
    const dayCheck = new Date(`${d?.data || ''}T12:00:00`).getDay();
    if (dayCheck === 0) {
      toast.warn('Quininha não corre aos domingos!');
      navigate('/loterias');
    }
  }, [refreshUser, navigate]);

  const toggleNumber = (num) => {
    const n = String(num).padStart(2, '0');
    if (selectedNumbers.includes(n)) {
      setSelectedNumbers(selectedNumbers.filter((i) => i !== n));
    } else {
      if (selectedNumbers.length >= qtdeDezenas) {
        toast.info(`Você já selecionou ${qtdeDezenas} números.`);
        return;
      }
      setSelectedNumbers([...selectedNumbers, n]);
    }
  };

  const handleFinalize = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (draft?.data === todayStr) {
      const now = new Date();
      if (now.getHours() > CUTOFF_HOUR || (now.getHours() === CUTOFF_HOUR && now.getMinutes() >= CUTOFF_MINUTE)) {
        toast.error('Apostas para a Quininha Federal encerram às 18:50.');
        return;
      }
    }

    if (selectedNumbers.length !== qtdeDezenas) {
      toast.error(`Selecione exatamente ${qtdeDezenas} números.`);
      return;
    }
    if (!valorAposta || Number(valorAposta) <= 0) {
      toast.error('Informe o valor da aposta.');
      return;
    }

    const modalidadeName = `QUININHA ${qtdeDezenas}`;
    const aposta = {
      jogo: 'Quininha',
      data: draft.data,
      modalidade: modalidadeName,
      colocacao: 'UNICA',
      palpites: selectedNumbers.sort(),
      modoValor: 'todos',
      valorAposta: Number(valorAposta),
      valorPorNumero: 0,
      total: Number(valorAposta),
    };

    updateDraft({
      ...draft,
      loteria: 'QUININHA',
      codigoHorario: '19:00',
      apostas: [aposta],
      selecoes: [
        {
          key: 'quininha-1900',
          slug: 'quininha',
          nome: 'QUININHA',
          horario: '19:00',
        },
      ],
    });

    navigate('/loterias-final');
  };

  const multiplicador = PAYOUTS[`QUININHA ${qtdeDezenas}`] || 0;
  const premioEstimado = (Number(valorAposta) || 0) * multiplicador;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 pb-32 font-sans">
      <div className="w-full max-w-lg flex items-center justify-between mb-4">
        <button onClick={() => navigate('/loterias')} className="text-emerald-700 font-bold">
          Voltar
        </button>
        <span className="font-bold text-emerald-800">Quininha Federal (19h)</span>
        <div className="w-10" />
      </div>

      {(authError || !draft?.data) && (
        <div className="mb-3 text-sm text-red-600 font-semibold">
          {authError || 'Selecione uma data antes de jogar.'}
        </div>
      )}

      <div className="w-full max-w-lg bg-white p-4 rounded-xl shadow-sm border border-emerald-100 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">Quantidade</p>
            <p className="text-lg font-extrabold text-emerald-700">{qtdeDezenas} números</p>
          </div>
          <button
            type="button"
            className="text-sm text-emerald-700 font-bold underline"
            onClick={() => navigate('/loterias/quininha/quantidade')}
          >
            Alterar
          </button>
        </div>

        <div className="grid grid-cols-10 gap-1 sm:gap-2">
          {Array.from({ length: 80 }, (_, i) => i + 1).map((num) => {
            const nStr = String(num).padStart(2, '0');
            const isSelected = selectedNumbers.includes(nStr);
            return (
              <button
                key={num}
                onClick={() => toggleNumber(num)}
                className={`aspect-square flex items-center justify-center rounded-full text-xs sm:text-sm font-bold transition ${
                  isSelected ? 'bg-emerald-600 text-white shadow-md transform scale-105' : 'bg-slate-100 text-slate-700 hover:bg-emerald-50'
                }`}
              >
                {nStr}
              </button>
            );
          })}
        </div>

        <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 mt-2">
          <div className="flex justify-between text-sm mb-2">
            <span>
              Selecionados: <strong>{selectedNumbers.length}</strong> / {qtdeDezenas}
            </span>
            <button type="button" className="text-emerald-700 font-bold text-xs" onClick={() => setSelectedNumbers([])}>
              Limpar
            </button>
          </div>

          <label className="text-xs font-bold text-slate-500 uppercase">Valor da Aposta (R$)</label>
          <input
            type="number"
            value={valorAposta}
            onChange={(e) => setValorAposta(e.target.value)}
            placeholder="0,00"
            className="w-full p-2 rounded border border-emerald-200 font-bold text-lg outline-none focus:ring-2 focus:ring-emerald-400"
          />

          {premioEstimado > 0 && (
            <div className="mt-2 text-sm text-emerald-800 text-center">
              Prêmio Estimado: <strong>R$ {premioEstimado.toFixed(2)}</strong> (Cotação {multiplicador}x)
            </div>
          )}
          <button
            type="button"
            className="mt-2 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition"
            onClick={() => {
              const pool = Array.from({ length: 80 }, (_, i) => String(i + 1).padStart(2, '0'));
              const shuffled = pool.sort(() => 0.5 - Math.random());
              setSelectedNumbers(shuffled.slice(0, qtdeDezenas));
            }}
          >
            Surpreenda-me (escolha aleatória)
          </button>
        </div>

        <button onClick={handleFinalize} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 transition">
          Confirmar Aposta
        </button>
      </div>
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-emerald-100 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div className="text-sm">
            <p className="text-gray-500">Prêmio Estimado</p>
            <p className="font-bold text-emerald-700 text-lg">R$ {premioEstimado.toFixed(2)}</p>
          </div>
          <button
            onClick={handleFinalize}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow hover:bg-emerald-700 transition"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoteriasQuininhaPage;

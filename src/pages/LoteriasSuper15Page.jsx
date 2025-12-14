import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getDraft, updateDraft } from '../utils/receipt';
import { useAuth } from '../context/AuthContext';
import PAYOUTS from '../constants/payouts.json';

const QUANTIDADES = [17, 18, 19, 20, 21, 22, 23];

const LoteriasSuper15Page = () => {
  const navigate = useNavigate();
  const { refreshUser, authError } = useAuth();
  const [draft, setDraft] = useState({});
  const [qtdeDezenas, setQtdeDezenas] = useState(17);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [valorAposta, setValorAposta] = useState('');

  useEffect(() => {
    refreshUser();
    const d = getDraft();
    setDraft(d);
    if (d?.data) {
      const dia = new Date(`${d.data}T12:00:00`).getDay();
      if (dia === 0) {
        toast.warn('Super15 não corre aos domingos!');
        navigate('/loterias');
      }
    }
  }, [refreshUser, navigate]);

  const toggleNumber = (num) => {
    const n = String(num).padStart(2, '0');
    if (selectedNumbers.includes(n)) {
      setSelectedNumbers(selectedNumbers.filter((i) => i !== n));
    } else {
      if (selectedNumbers.length >= qtdeDezenas) {
        toast.info(`Limite de ${qtdeDezenas} números atingido.`);
        return;
      }
      setSelectedNumbers([...selectedNumbers, n]);
    }
  };

  const handleFinalize = () => {
    if (selectedNumbers.length !== qtdeDezenas) {
      toast.error(`Selecione exatamente ${qtdeDezenas} números.`);
      return;
    }
    if (!valorAposta || Number(valorAposta) <= 0) {
      toast.error('Informe o valor da aposta.');
      return;
    }

    const modalidadeName = `SUPER15 ${qtdeDezenas}`;
    const aposta = {
      jogo: 'Super15',
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
      loteria: 'SUPER 15',
      codigoHorario: 'SEG-SAB',
      apostas: [aposta],
      selecoes: [
        {
          key: 'super15-daily',
          slug: 'super15',
          nome: 'SUPER 15',
          horario: 'SEG-SAB',
        },
      ],
    });

    navigate('/loterias-final');
  };

  const multiplicador = PAYOUTS[`SUPER15 ${qtdeDezenas}`] || 0;
  const premioEstimado = (Number(valorAposta) || 0) * multiplicador;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 pb-32 font-sans">
      <div className="w-full max-w-lg flex items-center justify-between mb-4">
        <button onClick={() => navigate('/loterias')} className="text-pink-700 font-bold">
          Voltar
        </button>
        <span className="font-bold text-pink-800">Super 15 (Lotofácil)</span>
        <div className="w-10" />
      </div>

      {(authError || !draft?.data) && (
        <div className="mb-3 text-sm text-red-600 font-semibold">{authError || 'Selecione uma data antes de jogar.'}</div>
      )}

      <div className="w-full max-w-lg bg-white p-4 rounded-xl shadow-sm border border-pink-100 flex flex-col gap-4">
        <div>
          <label className="text-sm font-bold text-slate-600 block mb-2">Quantos números?</label>
          <div className="flex flex-wrap gap-2">
            {QUANTIDADES.map((qtd) => (
              <button
                key={qtd}
                onClick={() => {
                  setQtdeDezenas(qtd);
                  setSelectedNumbers([]);
                }}
                className={`px-3 py-1 rounded-lg text-sm font-bold border transition ${
                  qtdeDezenas === qtd ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300'
                }`}
              >
                {qtd}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 25 }, (_, i) => i + 1).map((num) => {
            const nStr = String(num).padStart(2, '0');
            const isSelected = selectedNumbers.includes(nStr);
            return (
              <button
                key={num}
                onClick={() => toggleNumber(num)}
                className={`aspect-square flex items-center justify-center rounded-full text-lg font-bold transition ${
                  isSelected ? 'bg-pink-600 text-white shadow-md transform scale-105' : 'bg-slate-100 text-slate-700 hover:bg-pink-50'
                }`}
              >
                {nStr}
              </button>
            );
          })}
        </div>

        <div className="bg-pink-50 p-3 rounded-lg border border-pink-100 mt-2">
          <div className="flex justify-between text-sm mb-2">
            <span>
              Selecionados: <strong>{selectedNumbers.length}</strong> / {qtdeDezenas}
            </span>
            <button type="button" className="text-pink-700 font-bold text-xs" onClick={() => setSelectedNumbers([])}>
              Limpar
            </button>
          </div>

          <label className="text-xs font-bold text-slate-500 uppercase">Valor (R$)</label>
          <input
            type="number"
            value={valorAposta}
            onChange={(e) => setValorAposta(e.target.value)}
            placeholder="0,00"
            className="w-full p-2 rounded border border-pink-200 font-bold text-lg outline-none focus:ring-2 focus:ring-pink-400"
          />

          {premioEstimado > 0 && (
            <div className="mt-2 text-sm text-pink-800 text-center">
              Prêmio Estimado: <strong>R$ {premioEstimado.toFixed(2)}</strong> ({multiplicador}x)
            </div>
          )}
        </div>

        <button onClick={handleFinalize} className="w-full py-3 bg-pink-600 text-white font-bold rounded-xl shadow-lg hover:bg-pink-700 transition">
          Confirmar Aposta
        </button>
      </div>
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-pink-100 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div className="text-sm">
            <p className="text-gray-500">Prêmio Estimado</p>
            <p className="font-bold text-pink-700 text-lg">R$ {premioEstimado.toFixed(2)}</p>
          </div>
          <button
            onClick={handleFinalize}
            className="px-4 py-2 rounded-xl bg-pink-600 text-white text-sm font-bold shadow hover:bg-pink-700 transition"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoteriasSuper15Page;

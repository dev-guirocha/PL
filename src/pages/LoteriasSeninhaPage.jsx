import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getDraft, updateDraft } from '../utils/receipt';
import { useAuth } from '../context/AuthContext';
import PAYOUTS from '../constants/payouts.json';

const QUANTIDADES = [13, 14, 15, 16, 17, 18, 19, 20, 25, 30, 35, 40];
const DIAS_PERMITIDOS = [2, 4, 6]; // Terça, Quinta, Sábado

const LoteriasSeninhaPage = () => {
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

    if (d?.data) {
      const diaSemana = new Date(`${d.data}T12:00:00`).getDay();
      if (!DIAS_PERMITIDOS.includes(diaSemana)) {
        toast.warn('A Seninha só corre às Terças, Quintas e Sábados.');
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

    const modalidadeName = `SENINHA ${qtdeDezenas}`;
    const aposta = {
      jogo: 'Seninha',
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
      loteria: 'SENINHA',
      codigoHorario: 'TER-QUI-SAB',
      apostas: [aposta],
      selecoes: [
        {
          key: 'seninha-tqs',
          slug: 'seninha',
          nome: 'SENINHA',
          horario: 'TER-QUI-SAB',
        },
      ],
    });

    navigate('/loterias-final');
  };

  const multiplicador = PAYOUTS[`SENINHA ${qtdeDezenas}`] || 0;
  const premioEstimado = (Number(valorAposta) || 0) * multiplicador;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 pb-24 font-sans">
      <div className="w-full max-w-lg flex items-center justify-between mb-4">
        <button onClick={() => navigate('/loterias')} className="text-emerald-700 font-bold">
          Voltar
        </button>
        <span className="font-bold text-emerald-800">Seninha (Ter/Qui/Sab)</span>
        <div className="w-10" />
      </div>

      {(authError || !draft?.data) && (
        <div className="mb-3 text-sm text-red-600 font-semibold">{authError || 'Selecione uma data antes de jogar.'}</div>
      )}

      <div className="w-full max-w-lg bg-white p-4 rounded-xl shadow-sm border border-emerald-100 flex flex-col gap-4">
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
                  qtdeDezenas === qtd
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                }`}
              >
                {qtd}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-10 gap-1 sm:gap-2">
          {Array.from({ length: 60 }, (_, i) => i + 1).map((num) => {
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

          <label className="text-xs font-bold text-slate-500 uppercase">Valor (R$)</label>
          <input
            type="number"
            value={valorAposta}
            onChange={(e) => setValorAposta(e.target.value)}
            placeholder="0,00"
            className="w-full p-2 rounded border border-emerald-200 font-bold text-lg outline-none focus:ring-2 focus:ring-emerald-400"
          />

          {premioEstimado > 0 && (
            <div className="mt-2 text-sm text-emerald-800 text-center">
              Prêmio Estimado: <strong>R$ {premioEstimado.toFixed(2)}</strong> ({multiplicador}x)
            </div>
          )}
        </div>

        <button onClick={handleFinalize} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 transition">
          Confirmar Aposta
        </button>
      </div>
    </div>
  );
};

export default LoteriasSeninhaPage;

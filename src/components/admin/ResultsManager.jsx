import React, { useState, useEffect } from 'react';

// Função auxiliar para calcular o grupo do bicho
const calculateGroup = (numberStr) => {
  if (!numberStr || numberStr.length < 2) return '';
  const number = parseInt(numberStr.slice(-2), 10);
  if (isNaN(number)) return '';
  if (number === 0) return '25';
  return String(Math.ceil(number / 4));
};

const ResultsManager = ({ resultForm, setResultForm, results, createResult }) => {
  const [prizes, setPrizes] = useState(Array.from({ length: 7 }, () => ({ numero: '', grupo: '' })));
  const [rawInput, setRawInput] = useState(''); // Estado para o campo de colagem

  useEffect(() => {
    const numerosArray = prizes.map((p) => p.numero).filter((n) => n !== '');
    const gruposArray = prizes.map((p) => p.grupo).filter((g) => g !== '');

    setResultForm((prev) => ({
      ...prev,
      numeros: numerosArray.join(','),
      grupos: gruposArray.join(','),
    }));
  }, [prizes, setResultForm]);

  // --- O PARSER INTELIGENTE V2 ---
  const handleSmartPaste = (e) => {
    const text = e.target.value;
    setRawInput(text);

    // Limpa tudo que não for número
    const cleanData = text.replace(/\D/g, '');
    if (!cleanData) return;

    const newPrizes = Array.from({ length: 7 }, () => ({ numero: '', grupo: '' }));
    let cursor = 0;

    for (let i = 0; i < 7; i++) {
      if (cursor >= cleanData.length) break;

      // Pega 4 dígitos para o milhar
      let numLength = 4;
      // Se sobrar pouco no final, pega o que tem
      if (cleanData.length - cursor < 4) numLength = cleanData.length - cursor;

      const rawNum = cleanData.substr(cursor, numLength);

      if (rawNum) {
        newPrizes[i].numero = rawNum;
        const calculatedGroup = calculateGroup(rawNum);
        newPrizes[i].grupo = calculatedGroup;

        cursor += numLength;

        // VERIFICAÇÃO INTELIGENTE DE GRUPO
        // Olha os próximos 2 digitos. Se bater com o grupo calculado, consome eles.
        const nextTwo = cleanData.substr(cursor, 2);
        const nextOne = cleanData.substr(cursor, 1);

        const padGroup = calculatedGroup.padStart(2, '0');

        if (nextTwo === padGroup) {
          cursor += 2; // Era o grupo, pula ele
        } else if (nextTwo.length === 2 && nextTwo === calculatedGroup) {
          cursor += 2;
        } else if (nextOne === calculatedGroup) {
          cursor += 1;
        }
      }
    }
    setPrizes(newPrizes);
  };

  const handleChange = (index, field, value) => {
    const newPrizes = [...prizes];
    newPrizes[index][field] = value;
    if (field === 'numero') {
      newPrizes[index].grupo = calculateGroup(value);
    }
    setPrizes(newPrizes);
  };

  return (
    <div className="admin-card results">
      <div className="admin-card-header">Lançamento de Resultados</div>

      <form className="admin-form" onSubmit={createResult}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          <input
            placeholder="Nome da Loteria (ex: PT-RIO)"
            value={resultForm.loteria}
            onChange={(e) => setResultForm({ ...resultForm, loteria: e.target.value })}
            className="p-2 border rounded"
            required
          />
          <input
            placeholder="Horário (ex: 11:00)"
            value={resultForm.codigoHorario}
            onChange={(e) => setResultForm({ ...resultForm, codigoHorario: e.target.value })}
            className="p-2 border rounded"
          />
          <input
            placeholder="Data (DD/MM/AAAA)"
            value={resultForm.dataJogo}
            onChange={(e) => setResultForm({ ...resultForm, dataJogo: e.target.value })}
            className="p-2 border rounded"
          />
        </div>

        {/* --- ÁREA DE IMPORTAÇÃO RÁPIDA --- */}
        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200 mb-6">
          <label className="block text-xs font-bold text-emerald-800 uppercase mb-2">
            ⚡ Importação Rápida (Cole a linha inteira aqui)
          </label>
          <textarea
            value={rawInput}
            onChange={handleSmartPaste}
            placeholder="Ex: 269023296817837619935981942431631698321..."
            className="w-full p-3 border border-emerald-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono text-slate-700 h-24 resize-none"
          />
          <p className="text-[10px] text-emerald-600 mt-1">
            O sistema separa automaticamente Milhar e Grupo, mesmo se estiverem tudo junto.
          </p>
        </div>

        {/* Grid de Prêmios */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
          <div className="grid grid-cols-[40px_1fr_80px] gap-2 mb-1 font-bold text-xs text-slate-600 uppercase text-center">
            <span>Pos</span>
            <span>Milhar</span>
            <span>Gr</span>
          </div>

          {prizes.map((prize, index) => (
            <div key={index} className="grid grid-cols-[40px_1fr_80px] gap-2 mb-2 items-center">
              <span className="text-slate-500 font-bold text-center">{index + 1}º</span>

              <input
                type="text"
                value={prize.numero}
                onChange={(e) => handleChange(index, 'numero', e.target.value)}
                className="p-2 border rounded text-center font-mono font-bold text-slate-800 bg-white"
                maxLength={4}
                placeholder="0000"
              />

              <input
                type="text"
                value={prize.grupo}
                readOnly
                className="p-2 border rounded text-center bg-slate-200 text-slate-600 font-bold"
                tabIndex={-1}
              />
            </div>
          ))}
        </div>

        {/* Campo oculto para validação */}
        <input
          value={resultForm.numeros || ''}
          onChange={() => {}}
          className="sr-only"
          required
          onInvalid={(e) => e.target.setCustomValidity('Preencha os resultados acima')}
        />

        <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded font-bold hover:bg-emerald-700 transition">
          Registrar Resultado
        </button>
      </form>

      <div className="admin-list mt-6 border-t pt-4">
        <h3 className="text-sm font-bold text-slate-700 mb-2">Últimos Lançamentos</h3>
        {results.map((r) => (
          <div key={r.id} className="admin-list-item flex flex-col md:flex-row justify-between items-start md:items-center p-3 border-b text-sm">
            <div>
              <strong className="text-emerald-700">{r.loteria}</strong>
              <span className="mx-1 text-slate-400">|</span>
              {r.codigoHorario}
              <span className="mx-1 text-slate-400">|</span>
              {r.dataJogo}
            </div>
            <div className="font-mono text-slate-600 mt-1 md:mt-0">
              {(r.numeros || []).slice(0, 5).join(', ')}...
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultsManager;

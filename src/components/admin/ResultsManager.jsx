import React, { useState, useEffect } from 'react';

// Calcula o grupo (bicho) usando a dezena
const calculateGroup = (numberStr) => {
  if (!numberStr || numberStr.length < 2) return '';
  const number = parseInt(numberStr.slice(-2), 10);
  if (Number.isNaN(number)) return '';
  if (number === 0) return '25'; // 00 é Vaca (25)
  return String(Math.ceil(number / 4));
};

const ResultsManager = ({ resultForm, setResultForm, results, createResult }) => {
  const [prizes, setPrizes] = useState(Array.from({ length: 7 }, () => ({ numero: '', grupo: '' })));

  useEffect(() => {
    const numerosArray = prizes.map((p) => p.numero).filter((n) => n !== '');
    const gruposArray = prizes.map((p) => p.grupo).filter((g) => g !== '');
    setResultForm((prev) => ({
      ...prev,
      numeros: numerosArray.join(','),
      grupos: gruposArray.join(','),
    }));
  }, [prizes, setResultForm]);

  // Parser inteligente: lê a string inteira, consome milhar e grupo (se vier colado)
  const handlePaste = (e, startIndex) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!digits) return;

    const newPrizes = [...prizes];
    let cursor = 0;

    for (let i = startIndex; i < 7; i++) {
      if (cursor >= digits.length) break;

      // Pega 4 dígitos (ou o restante se for menos de 4)
      const remaining = digits.length - cursor;
      const numLen = remaining >= 4 ? 4 : remaining;
      const rawNum = digits.substr(cursor, numLen);
      if (!rawNum) break;

      const group = calculateGroup(rawNum);
      newPrizes[i].numero = rawNum;
      newPrizes[i].grupo = group;
      cursor += numLen;

      // Tenta consumir grupo explícito se a cola tiver intercalado numero/grupo
      const nextTwo = digits.substr(cursor, 2);
      const nextOne = digits.substr(cursor, 1);
      if (nextTwo === group.padStart(2, '0') || nextTwo === group) {
        cursor += 2;
      } else if (nextOne === group) {
        cursor += 1;
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

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
          <p className="text-xs text-slate-500 mb-2 font-bold uppercase">
            🚀 Cole a coluna ou a sequência contínua (ex: 26902329...) no 1º campo.
          </p>

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
                onPaste={(e) => index === 0 && handlePaste(e, 0)}
                className="p-2 border rounded text-center font-mono font-bold text-slate-800"
                maxLength={6} // permite colas acidentais maiores, mas usa os 4-6 primeiros dígitos
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
          <div
            key={r.id}
            className="admin-list-item flex flex-col md:flex-row justify-between items-start md:items-center p-3 border-b text-sm"
          >
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

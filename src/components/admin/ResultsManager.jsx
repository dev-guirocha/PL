import React, { useState, useEffect } from 'react';

// Função auxiliar para calcular o grupo (bicho) com base na dezena
const calculateGroup = (numberStr) => {
  if (!numberStr || numberStr.length < 2) return '';
  const number = parseInt(numberStr.slice(-2), 10);
  if (Number.isNaN(number)) return '';
  if (number === 0) return '25'; // 00 é Vaca (25)
  return String(Math.ceil(number / 4));
};

const ResultsManager = ({ resultForm, setResultForm, results, createResult }) => {
  // Estado local para 7 prêmios com número/grupo
  const [prizes, setPrizes] = useState(Array.from({ length: 7 }, () => ({ numero: '', grupo: '' })));

  // Sincroniza com o form principal (compatível com backend atual)
  useEffect(() => {
    const numerosArray = prizes.map((p) => p.numero).filter((n) => n !== '');
    const gruposArray = prizes.map((p) => p.grupo).filter((g) => g !== '');

    setResultForm((prev) => ({
      ...prev,
      numeros: numerosArray.join(','), // formato esperado pelo backend
      grupos: gruposArray.join(','), // opcional, se backend suportar
    }));
  }, [prizes, setResultForm]);

  // Paste inteligente: detecta colunas de números ou número/grupo intercalados
  const handlePaste = (e, startIndex) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    let lines = pastedData.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
    if (lines.length === 0) return;

    // Caso tenha vindo tudo em uma linha contínua (coluna copiada sem quebras), tenta fatiar
    if (lines.length === 1) {
      const digits = lines[0].replace(/\D/g, '');
      // Decide tamanho dos blocos: prioriza 5 dígitos (ex.: 26902...), senão 4
      const chunkSize = digits.length % 5 === 0 || digits.length >= 35 ? 5 : digits.length % 4 === 0 ? 4 : null;
      if (chunkSize) {
        const chunks = [];
        for (let i = 0; i < digits.length; i += chunkSize) {
          chunks.push(digits.slice(i, i + chunkSize));
        }
        lines = chunks;
      }
    }

    const newPrizes = [...prizes];
    let lineIndex = 0;
    const isInterleaved = lines.length > 7;

    for (let i = startIndex; i < 7; i++) {
      if (lineIndex >= lines.length) break;
      const rawNum = lines[lineIndex].replace(/\D/g, '');
      if (rawNum) {
        newPrizes[i].numero = rawNum;
        if (isInterleaved && lines[lineIndex + 1]) {
          lineIndex++;
          const rawGroup = lines[lineIndex].replace(/\D/g, '');
          newPrizes[i].grupo = rawGroup;
        } else {
          newPrizes[i].grupo = calculateGroup(rawNum);
        }
      }
      lineIndex++;
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
            🚀 Dica: Copie a coluna inteira do Excel/Site e cole no 1º campo de Número.
          </p>

          <div className="grid grid-cols-[40px_1fr_80px] gap-2 mb-1 font-bold text-xs text-slate-600 uppercase text-center">
            <span>Pos</span>
            <span>Milhar / Número</span>
            <span>Grupo</span>
          </div>

          {prizes.map((prize, index) => (
            <div key={index} className="grid grid-cols-[40px_1fr_80px] gap-2 mb-2 items-center">
              <span className="text-slate-500 font-bold text-center">{index + 1}º</span>
              <input
                type="text"
                placeholder={`Prêmio ${index + 1}`}
                value={prize.numero}
                onChange={(e) => handleChange(index, 'numero', e.target.value)}
                onPaste={(e) => index === 0 && handlePaste(e, 0)}
                className="p-2 border rounded text-center font-mono font-bold text-slate-800"
                maxLength={4}
              />
              <input
                type="text"
                placeholder="Gr"
                value={prize.grupo}
                onChange={(e) => handleChange(index, 'grupo', e.target.value)}
                className="p-2 border rounded text-center bg-slate-100 text-slate-600"
                maxLength={2}
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

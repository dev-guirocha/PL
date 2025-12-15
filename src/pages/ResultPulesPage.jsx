import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';
import api from '../utils/api';
import { formatDateBR, formatDateTimeBR } from '../utils/date';
import { getNomeBicho } from '../utils/bichos';
import { generateResultPDF } from '../utils/pdfGenerator';

const ResultPulesPage = () => {
  const navigate = useNavigate();
  const [pules, setPules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterLottery, setFilterLottery] = useState('');

  const LOTERIAS = [
    'LT PT RIO',
    'LT MALUQ RIO',
    'LT NACIONAL',
    'LT LOOK',
    'LT BOASORTE',
    'PT SP',
    'LT BAND',
    'LT LOTEP',
    'LT LOTECE',
    'LT BAHIA',
    'LT BA MALUCA',
    'LT CAPITAL',
    'LT ALVORADA',
    'LT MINAS DIA',
    'LT MINAS NOITE',
    'LT SORTE',
    'LT URUGUAI',
  ];

  const fetchPules = async ({ loteria = filterLottery, date = filterDate } = {}) => {
    if (!date || !loteria) {
      setError('Selecione data e loteria.');
      setPules([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/bets/result-pules', { params: { take: 100, skip: 0, loteria, date } });
      const list = res.data?.pules || [];
      setPules(list);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar resultados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // limpa lista até que filtros sejam preenchidos; data já inicia como hoje
    setPules([]);
  }, []);

  const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;
  const deriveTotals = (ap) => {
    const valorBase = Number(ap?.valorAposta ?? ap?.valorPorNumero ?? ap?.total ?? 0) || 0;
    const qtd = ap?.palpites?.length || 0;
    const isCada = ap?.modoValor === 'cada';
    const total = isCada ? valorBase * Math.max(qtd, 1) : valorBase;
    const valorPorNumero = isCada ? valorBase : qtd ? valorBase / qtd : valorBase;
    return { total, valorPorNumero };
  };

  const buildPairs = (pule) => {
    const nums = Array.isArray(pule.numeros) ? pule.numeros : [];
    const groups = Array.isArray(pule.grupos) ? pule.grupos : [];
    const max = Math.max(nums.length, groups.length, 7);
    return Array.from({ length: max }).map((_, idx) => {
      const num = nums[idx] ?? '—';
      let group = groups[idx];
      if (!group) {
        const digits = String(num).replace(/\D/g, '').slice(-2);
        if (digits) {
          const val = parseInt(digits, 10);
          if (!Number.isNaN(val)) {
            const g = val === 0 ? 25 : Math.ceil(val / 4);
            group = String(g).padStart(2, '0');
          }
        }
      }
      let bicho = '—';
      if (group && group !== '—') {
        const gNum = Number(String(group).replace(/\D/g, ''));
        const normalized = gNum === 0 ? 25 : gNum;
        const nome = getNomeBicho(normalized);
        if (nome) bicho = nome;
      }
      return { label: `N${idx + 1}`, number: num || '—', group: group || '—', bicho };
    });
  };

  const isEmpty = !loading && pules.length === 0;

  const handleDownload = (pule) => {
    const pairs = buildPairs(pule);
    const linhas = [];
    linhas.push(`Loteria: ${pule.loteria || '—'}`);
    if (pule.codigoHorario) linhas.push(`Horário: ${pule.codigoHorario}`);
    if (pule.dataJogo) linhas.push(`Data do jogo: ${formatDateBR(pule.dataJogo)}`);
    linhas.push(`Referência: ${pule.betRef || `RESULT-${pule.id}`}`);
    linhas.push('--- Resultados ---');
    pairs.forEach((p) => {
      linhas.push(`${p.label}: ${p.number} | Grupo: ${p.group} | Bicho: ${p.bicho}`);
    });
    const blob = new Blob([linhas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resultado-${pule.loteria || 'loteria'}-${pule.dataJogo || 'hoje'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = (pule) => {
    const pairs = buildPairs(pule);
    const win = window.open('', '_blank', 'noopener,noreferrer,width=700,height=900');
    if (!win) return;
    const titulo = `Resultado - ${pule.loteria || 'Loteria'} - ${pule.dataJogo ? formatDateBR(pule.dataJogo) : ''}`;
    const rows = pairs
      .map(
        (p) =>
          `<tr>
            <td style="padding:6px 8px;border:1px solid #e5e7eb;">${p.label}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb;">${p.number}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb;">${p.group}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb;">${p.bicho}</td>
          </tr>`,
      )
      .join('');
    win.document.write(`
      <html>
        <head>
          <title>${titulo}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 16px; }
            h1 { font-size: 18px; margin: 0 0 6px; color: #065f46; }
            h2 { font-size: 14px; margin: 0 0 8px; color: #0f172a; }
            table { border-collapse: collapse; width: 100%; margin-top: 10px; }
            th { background: #ecfdf3; border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            td { padding: 6px 8px; }
          </style>
        </head>
        <body>
          <h1>${pule.loteria || 'Loteria'}</h1>
          <h2>Horário: ${pule.codigoHorario || '—'} | Data: ${pule.dataJogo ? formatDateBR(pule.dataJogo) : '—'}</h2>
          <div style="font-size:12px;margin-bottom:8px;">Ref: ${pule.betRef || `RESULT-${pule.id}`}</div>
          <table>
            <thead>
              <tr>
                <th>Posição</th>
                <th>Resultado</th>
                <th>Grupo</th>
                <th>Bicho</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 px-4 py-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <button
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-lg transition hover:from-emerald-800 hover:to-emerald-700"
          onClick={() => navigate('/relatorios')}
        >
          Voltar
        </button>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase text-emerald-700">Resultados</p>
          <h1 className="text-lg font-extrabold text-emerald-900">Consultar resultados</h1>
        </div>
      </div>

      {error && (
        <div className="mx-auto mt-3 max-w-4xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow">
          {error}
        </div>
      )}

      <div className="mx-auto mt-4 max-w-5xl rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Data</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de loteria</label>
            <select
              value={filterLottery}
              onChange={(e) => setFilterLottery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
            >
              <option value="">Selecione</option>
              {LOTERIAS.map((lot) => (
                <option key={lot} value={lot}>
                  {lot}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => fetchPules({ loteria: filterLottery, date: filterDate })}
            className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            disabled={loading}
          >
            Buscar
          </button>
          <button
            onClick={() => {
              setFilterDate('');
              setFilterLottery('');
              setPules([]);
              setError('');
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            disabled={loading}
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="mx-auto mt-4 flex max-w-5xl flex-col gap-3">
        {loading && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-slate-600 shadow">
            <Spinner size={32} />
          </div>
        )}

        {isEmpty && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-slate-600 shadow">
            Nenhuma PULE de resultado encontrada.
          </div>
        )}

        {pules.map((pule) => (
          <div
            key={pule.id}
            className="flex flex-col gap-2 rounded-2xl border border-emerald-50 bg-white px-4 py-4 text-emerald-800 shadow-lg"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
              <span className="text-base">{pule.loteria || 'Loteria'}</span>
              <span className="text-xs text-gray-600">{pule.betRef || `RESULT-${pule.id}`}</span>
              {pule.dataJogo ? (
                <span className="text-xs font-semibold text-emerald-700">Data do jogo: {formatDateBR(pule.dataJogo)}</span>
              ) : null}
            </div>
            {pule.codigoHorario && <span className="text-xs text-slate-500">Horário: {pule.codigoHorario}</span>}
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
              Comparativo (Resultado)
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleDownload(pule)}
                className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                Baixar resultado (.txt)
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPdf(pule)}
                className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                Baixar PDF (print)
              </button>
              <button
                type="button"
                onClick={() => generateResultPDF(pule)}
                className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                Baixar PDF (nativo)
              </button>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 border-t border-dashed border-emerald-100 pt-2 text-sm md:grid-cols-2">
              {buildPairs(pule).map((pair, i) => (
                <div key={`${pule.id}-pair-${i}`} className="flex items-center justify-between rounded-lg border border-emerald-50 bg-emerald-50/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-bold uppercase text-white">{pair.label}</span>
                    <span className="text-sm font-semibold text-emerald-800">{pair.number}</span>
                  </div>
                  <div className="text-right text-xs font-semibold text-emerald-700">
                    <div>Grupo: {pair.group}</div>
                    <div className="text-[11px] text-emerald-600">{pair.bicho}</div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultPulesPage;

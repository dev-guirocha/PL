import React, { useMemo, useState } from 'react';
import { FaFilePdf, FaTimes } from 'react-icons/fa';
import api from '../../utils/api';
import { generatePulePDF } from '../../utils/pdfGenerator';
import { formatDateBR, formatDateTimeBR } from '../../utils/date';
import Spinner from '../Spinner';

const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;

const normalizePalpites = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const formatPalpite = (val) => {
  if (val && typeof val === 'object') {
    const entries = Object.entries(val || {}).filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (!entries.length) return '';
    const preferred = ['milhar', 'centena', 'dezena', 'unidade', 'grupo', 'numero', 'num', 'palpite'];
    for (const key of preferred) {
      const found = entries.find(([k]) => k.toLowerCase() === key);
      if (found) return String(found[1]);
    }
    const formatted = entries.map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim().toUpperCase();
      return `${label}: ${String(v)}`;
    });
    return formatted.join(' | ');
  }
  return String(val ?? '');
};

const formatDateBRSafe = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const raw = value.split('T')[0].split(' ')[0];
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${d}/${m}/${y}`;
    }
    const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
      const [, d, m, y] = brMatch;
      return `${d}/${m}/${y}`;
    }
  }
  return formatDateBR(value);
};

const getBaseNumbers = (pule) => {
  if (Array.isArray(pule?.valendoBase?.numerosBase) && pule.valendoBase.numerosBase.length) {
    return pule.valendoBase.numerosBase;
  }
  const first = (pule?.apostas || [])[0];
  if (Array.isArray(first?.palpites) && first.palpites.length) return first.palpites;
  return [];
};

const buildApostasPreview = (pule) =>
  (pule?.apostas || []).map((ap) => {
    const palpites = normalizePalpites(ap.palpites);
    const valorBase = Number(ap?.valorAposta ?? ap?.valorPorNumero ?? ap?.total ?? 0) || 0;
    const qtd = palpites.length || 0;
    const isCada = ap?.modoValor === 'cada';
    const total = isCada ? valorBase * Math.max(qtd, 1) : valorBase;
    const valorPorNumero = isCada ? valorBase : qtd ? valorBase / qtd : valorBase;
    return {
      ...ap,
      palpites,
      total,
      valorPorNumero,
      aplicacao: isCada ? 'Cada' : 'Todos',
    };
  });

const AdminPuleAction = ({ betId, ticketId }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pule, setPule] = useState(null);

  const fetchPule = async () => {
    const target = ticketId || betId;
    if (!target) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin/bets/ticket/${target}`);
      setPule(res.data || null);
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao carregar a PULE.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    setOpen(true);
    if (!pule) {
      await fetchPule();
    }
  };

  const handleDownload = () => {
    if (pule) {
      generatePulePDF(pule);
    }
  };

  const apostasPreview = useMemo(() => buildApostasPreview(pule), [pule]);
  const baseNumbers = useMemo(() => getBaseNumbers(pule), [pule]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
        title="Ver PULE completa"
      >
        <FaFilePdf className="text-red-600" />
        PULE completa
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-600">PULE</p>
                <h3 className="text-lg font-bold text-slate-800">Bilhete completo</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                title="Fechar"
              >
                <FaTimes />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner size={32} />
                </div>
              ) : error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              ) : !pule ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Nenhuma PULE encontrada.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">Referência</p>
                        <p className="text-sm font-bold text-slate-800">{pule.betRef || pule.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold uppercase text-slate-500">Data/Hora</p>
                        <p className="text-sm font-bold text-slate-800">
                          {formatDateTimeBR(pule.createdAt || new Date())}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
                      <div>
                        <span className="block text-xs font-semibold uppercase text-slate-500">Loteria</span>
                        <span className="font-semibold">{pule.loteria || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold uppercase text-slate-500">Horário</span>
                        <span className="font-semibold">{pule.codigoHorario || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold uppercase text-slate-500">Data do jogo</span>
                        <span className="font-semibold">{formatDateBRSafe(pule.dataJogo) || '—'}</span>
                      </div>
                    </div>
                    {baseNumbers.length ? (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Números base</p>
                        <div className="flex flex-wrap gap-2">
                          {baseNumbers.map((n, idx) => (
                            <span
                              key={`base-${idx}`}
                              className="px-2 py-1 rounded-full bg-white border border-emerald-200 text-xs font-semibold text-emerald-700"
                            >
                              {formatPalpite(n)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    {apostasPreview.length ? (
                      apostasPreview.map((ap, idx) => (
                        <div key={`ap-${idx}`} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold uppercase text-slate-500">Modalidade</p>
                              <p className="text-sm font-bold text-slate-800">{ap.modalidade || ap.jogo || 'Aposta'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold uppercase text-slate-500">Aplicação</p>
                              <p className="text-sm font-bold text-slate-800">{ap.aplicacao}</p>
                            </div>
                          </div>
                          {ap.colocacao && (
                            <p className="mt-2 text-xs font-semibold text-slate-600">Prêmio: {ap.colocacao}</p>
                          )}
                          <p className="mt-1 text-xs text-slate-500">Qtd palpites: {ap.palpites.length}</p>
                          {ap.palpites.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {ap.palpites.map((p, i) => (
                                <span
                                  key={`ap-${idx}-p-${i}`}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
                                >
                                  {formatPalpite(p)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-700 md:grid-cols-2">
                            <div className="flex items-center justify-between">
                              <span>Valor por número</span>
                              <span>{formatCurrency(ap.valorPorNumero)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Valor da aposta</span>
                              <span>{formatCurrency(ap.total)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        Nenhuma aposta encontrada.
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                    <span>Total</span>
                    <span>{formatCurrency(pule.total)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={fetchPule}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                disabled={loading}
              >
                Atualizar
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                disabled={!pule || loading}
              >
                Baixar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminPuleAction;

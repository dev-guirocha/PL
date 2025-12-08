import React, { useEffect, useMemo, useState } from 'react';
import { FaSyncAlt } from 'react-icons/fa';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminTable, { AdminTableRow, AdminTableCell, StatusBadge } from '../../components/admin/AdminTable';
import Spinner from '../../components/Spinner';
import api from '../../utils/api';

const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;
const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

const modalityOptions = [
  { value: 'ALL', label: 'Todas' },
  { value: 'UNIDADES', label: 'Unidades' },
  { value: 'DEZENAS', label: 'Dezenas' },
  { value: 'CENTENAS', label: 'Centenas' },
  { value: 'MILHARES', label: 'Milhares' },
  { value: 'DUQUE E TERNO', label: 'Duque e Terno' },
  { value: 'GRUPO', label: 'Grupo' },
];

const extractModalities = (bet) => {
  const mods = [];
  if (bet.modalidade || bet.modality || bet.type) mods.push(bet.modalidade || bet.modality || bet.type);
  (bet.apostas || []).forEach((ap) => {
    if (ap.modalidade || ap.jogo) mods.push(ap.modalidade || ap.jogo);
  });
  const unique = [...new Set(mods.filter(Boolean))];
  return unique.length ? unique : ['—'];
};

const extractPrize = (bet) => {
  if (bet.colocacao) return bet.colocacao;
  const first = bet.apostas?.find((ap) => ap.colocacao) || {};
  return first.colocacao || '—';
};

const extractCode = (bet) => {
  if (bet.codigoHorario) return bet.codigoHorario;
  if (bet.loteria) return bet.loteria;
  const first = (bet.apostas || []).find((ap) => ap.codigoHorario || ap.jogo);
  return first?.codigoHorario || first?.jogo || '—';
};

const parseScheduledDate = (bet) => {
  const dateStr = bet.dataJogo || bet.data;
  const base = dateStr ? new Date(dateStr) : new Date(bet.createdAt || '');
  if (Number.isNaN(base.getTime())) return null;

  const code = extractCode(bet);
  const timeMatch = code.match(/(\d{1,2})\s*(h|hs)/i);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    base.setHours(hour, 0, 0, 0);
  }
  return base;
};

const computeStatus = (bet) => {
  const raw = (bet.status || '').toLowerCase();
  const finalStates = ['won', 'lost', 'paid', 'approved', 'rejected', 'settled', 'nao premiado'];
  if (finalStates.includes(raw)) return raw;

  const scheduled = parseScheduledDate(bet);
  if (scheduled && Date.now() > scheduled.getTime()) return 'pending';

  return raw || 'open';
};

const extractNumbers = (bet) => {
  const allPalpites = (bet.apostas || []).flatMap((ap) => ap.palpites || []);
  if (allPalpites.length) return allPalpites;
  if (Array.isArray(bet.palpites)) return bet.palpites;
  try {
    const parsed = JSON.parse(bet.palpites || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const AdminBetsPage = () => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalityFilter, setModalityFilter] = useState('ALL');

  const fetchBets = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/bets', { params: { page: 1, pageSize: 100 } });
      setBets(res.data?.bets || res.data || []);
    } catch (err) {
      setError('Erro ao carregar apostas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBets();
  }, []);

  const matchesFilter = (mods, filterValue) => {
    if (filterValue === 'ALL') return true;
    const target = normalize(filterValue);
    const normalizedMods = mods.map(normalize);
    const synonyms = {
      UNIDADES: ['UNIDADE', 'UNIDADES'],
      DEZENAS: ['DEZENA', 'DEZENAS'],
      CENTENAS: ['CENTENA', 'CENTENAS'],
      MILHARES: ['MILHAR', 'MILHARES'],
      'DUQUE E TERNO': ['DUQUE E TERNO', 'DUQUE', 'TERNO'],
      GRUPO: ['GRUPO', 'GRUPOS'],
    };
    const candidates = synonyms[target] || [target];
    return normalizedMods.some((m) => candidates.some((c) => m.includes(normalize(c))));
  };

  const filteredBets = useMemo(() => {
    if (modalityFilter === 'ALL') return bets;
    return bets.filter((bet) => matchesFilter(extractModalities(bet), modalityFilter));
  }, [bets, modalityFilter]);

  const totalValue = filteredBets.reduce((acc, b) => acc + (Number(b.total) || Number(b.valor) || 0), 0);

  return (
    <AdminLayout
      title="Apostas"
      subtitle="Histórico de apostas de todos os usuários."
      actions={
        <button
          onClick={fetchBets}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm font-semibold text-sm"
        >
          <FaSyncAlt className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      }
    >
      {error && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded-r shadow-sm">
          <p className="font-bold">Erro</p>
          <p>{error}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {modalityOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setModalityFilter(opt.value)}
            className={`px-3 py-1 rounded-full border text-sm font-semibold transition ${
              modalityFilter === opt.value
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="mb-3 text-sm text-slate-600">
        Total exibido: <span className="font-semibold text-emerald-700">{formatCurrency(totalValue)}</span> | Apostas:{' '}
        <span className="font-semibold text-slate-800">{filteredBets.length}</span>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size={40} />
        </div>
      ) : (
        <AdminTable headers={['Ref', 'Modalidade', 'Código/Horário', 'Data da Aposta', 'Prêmio', 'Números', 'Valor', 'Data/Horário', 'Status']}>
          {filteredBets.length === 0 ? (
            <AdminTableRow>
              <AdminTableCell className="text-center text-slate-500" colSpan={9}>
                Nenhuma aposta encontrada.
              </AdminTableCell>
            </AdminTableRow>
          ) : (
            filteredBets.map((bet) => {
              const betId = bet.betRef || `${bet.userId || bet.user?.id || ''}-${bet.id || bet._id || bet.betId || ''}`;
              const modalities = extractModalities(bet);
              const modality = modalities[0] || '—';
              const code = extractCode(bet);
              const value = bet.total || bet.valor || bet.amount;
              const prize = extractPrize(bet);
              const numeros = extractNumbers(bet);
              const displayStatus = computeStatus(bet);
              const preview = numeros.slice(0, 6);
              const extra = numeros.length - preview.length;
              return (
                <AdminTableRow key={betId}>
                  <AdminTableCell className="font-semibold text-slate-800">{betId}</AdminTableCell>
                  <AdminTableCell className="uppercase font-semibold">{modality}</AdminTableCell>
                  <AdminTableCell className="text-sm font-semibold text-slate-700">{code}</AdminTableCell>
                  <AdminTableCell>{bet.dataJogo || bet.data || '—'}</AdminTableCell>
                  <AdminTableCell className="text-sm font-semibold text-slate-700">{prize}</AdminTableCell>
                  <AdminTableCell>
                    <div className="flex flex-wrap gap-2">
                      {preview.map((n, idx) => (
                        <span key={`${betId}-palp-${idx}`} className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                          {n}
                        </span>
                      ))}
                      {extra > 0 && <span className="text-xs text-slate-500">+{extra}</span>}
                      {preview.length === 0 && <span className="text-slate-500 text-xs">—</span>}
                    </div>
                  </AdminTableCell>
                  <AdminTableCell className="font-semibold text-emerald-700">{formatCurrency(value)}</AdminTableCell>
                  <AdminTableCell>{formatDateTime(bet.createdAt || bet.data)}</AdminTableCell>
                  <AdminTableCell>
                    <StatusBadge status={displayStatus} />
                  </AdminTableCell>
                </AdminTableRow>
              );
            })
          )}
        </AdminTable>
      )}
    </AdminLayout>
  );
};

export default AdminBetsPage;

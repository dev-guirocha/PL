import React, { useEffect, useMemo, useState } from 'react';
import { FaArchive, FaFolderOpen, FaSyncAlt } from 'react-icons/fa';
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
  const aliases = {
    perdeu: 'nao premiado',
    lost: 'nao premiado',
    'não premiado': 'nao premiado',
  };
  const normalized = aliases[raw] || raw;
  const finalStates = ['won', 'lost', 'paid', 'approved', 'rejected', 'settled', 'nao premiado'];
  if (finalStates.includes(normalized)) return normalized;

  const scheduled = parseScheduledDate(bet);
  if (scheduled && Date.now() > scheduled.getTime()) return 'pending';

  return normalized || 'open';
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
  const [viewMode, setViewMode] = useState('active');
  const [selectedFolder, setSelectedFolder] = useState('ALL');

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

  const { activeBets, archivedBets } = useMemo(() => {
    const active = [];
    const archived = [];
    filteredBets.forEach((bet) => {
      const status = computeStatus(bet);
      const extended = { ...bet, displayStatus: status };
      if (status === 'nao premiado') {
        archived.push(extended);
      } else {
        active.push(extended);
      }
    });
    return { activeBets: active, archivedBets: archived };
  }, [filteredBets]);

  const archiveFolders = useMemo(() => {
    const groups = {};
    archivedBets.forEach((bet) => {
      const code = extractCode(bet);
      const key = code && code !== '—' ? code : 'SEM CÓDIGO';
      if (!groups[key]) groups[key] = { code: key, count: 0, total: 0 };
      groups[key].count += 1;
      groups[key].total += Number(bet.total) || Number(bet.valor) || 0;
    });
    return Object.values(groups).sort((a, b) => a.code.localeCompare(b.code));
  }, [archivedBets]);

  useEffect(() => {
    if (selectedFolder !== 'ALL' && !archiveFolders.some((f) => f.code === selectedFolder)) {
      setSelectedFolder('ALL');
    }
  }, [archiveFolders, selectedFolder]);

  const visibleArchivedBets = useMemo(() => {
    if (selectedFolder === 'ALL') return archivedBets;
    return archivedBets.filter((bet) => {
      const code = extractCode(bet);
      const key = code && code !== '—' ? code : 'SEM CÓDIGO';
      return key === selectedFolder;
    });
  }, [archivedBets, selectedFolder]);

  const visibleBets = viewMode === 'archive' ? visibleArchivedBets : activeBets;

  const totalValue = visibleBets.reduce((acc, b) => acc + (Number(b.total) || Number(b.valor) || 0), 0);

  const renderBetsTable = (items) => (
    <AdminTable headers={['Ref', 'Modalidade', 'Código/Horário', 'Data da Aposta', 'Prêmio', 'Números', 'Valor', 'Data/Horário', 'Status']}>
      {items.length === 0 ? (
        <AdminTableRow>
          <AdminTableCell className="text-center text-slate-500" colSpan={9}>
            Nenhuma aposta encontrada.
          </AdminTableCell>
        </AdminTableRow>
      ) : (
        items.map((bet) => {
          const betId = bet.betRef || `${bet.userId || bet.user?.id || ''}-${bet.id || bet._id || bet.betId || ''}`;
          const modalities = extractModalities(bet);
          const modality = modalities[0] || '—';
          const code = extractCode(bet);
          const value = bet.total || bet.valor || bet.amount;
          const prize = extractPrize(bet);
          const numeros = extractNumbers(bet);
          const displayStatus = bet.displayStatus || computeStatus(bet);
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
  );

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

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => setViewMode('active')}
          className={`px-3 py-1 rounded-full border text-sm font-semibold transition ${
            viewMode === 'active'
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
          }`}
        >
          Apostas ativas
        </button>
        <button
          onClick={() => setViewMode('archive')}
          className={`px-3 py-1 rounded-full border text-sm font-semibold transition flex items-center gap-2 ${
            viewMode === 'archive'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
          }`}
        >
          <FaArchive /> Arquivadas (status Não premiada)
        </button>
        <span className="text-xs text-slate-500">Apostas com status &quot;Não premiada&quot; saem da lista ativa automaticamente.</span>
      </div>

      <div className="mb-3 text-sm text-slate-600">
        {viewMode === 'archive' ? 'Total arquivado exibido:' : 'Total exibido:'}{' '}
        <span className="font-semibold text-emerald-700">{formatCurrency(totalValue)}</span> | Apostas:{' '}
        <span className="font-semibold text-slate-800">{visibleBets.length}</span>
        {viewMode === 'archive' && selectedFolder !== 'ALL' && (
          <span className="text-slate-500 text-xs ml-2">Pasta: {selectedFolder}</span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size={40} />
        </div>
      ) : (
        <>
          {viewMode === 'archive' ? (
            <div className="grid md:grid-cols-[260px_1fr] gap-4">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 h-fit">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                    <FaArchive />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Pastas de arquivados</p>
                    <p className="text-xs text-slate-500">Agrupados pelo código/horário da aposta.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedFolder('ALL')}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                      selectedFolder === 'ALL'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-200'
                    }`}
                  >
                    Todas as pastas ({archivedBets.length})
                  </button>
                  {archiveFolders.length === 0 ? (
                    <p className="text-xs text-slate-500 px-1">Nenhuma aposta arquivada ainda.</p>
                  ) : (
                    archiveFolders.map((folder) => (
                      <button
                        key={folder.code}
                        onClick={() => setSelectedFolder(folder.code)}
                        className={`w-full text-left px-3 py-2 rounded-lg border transition ${
                          selectedFolder === folder.code
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-white border-slate-200 hover:border-emerald-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FaFolderOpen className="text-emerald-600" />
                            <span className="font-semibold text-slate-800">{folder.code}</span>
                          </div>
                          <span className="text-xs text-slate-500 font-semibold">{folder.count}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Valor: {formatCurrency(folder.total)}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div>{renderBetsTable(visibleArchivedBets)}</div>
            </div>
          ) : (
            renderBetsTable(activeBets)
          )}
        </>
      )}
    </AdminLayout>
  );
};

export default AdminBetsPage;

import React, { useEffect, useMemo, useState } from 'react';
import { FaSyncAlt, FaTrophy } from 'react-icons/fa';
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

const extractModalities = (bet) => {
  const mods = [];
  if (bet.modalidade) mods.push(bet.modalidade);

  if (Array.isArray(bet.apostas)) {
    bet.apostas.forEach((ap) => {
      if (ap?.modalidade || ap?.jogo) mods.push(ap.modalidade || ap.jogo);
    });
  } else if (typeof bet.palpites === 'string') {
    try {
      const parsed = JSON.parse(bet.palpites);
      if (Array.isArray(parsed)) {
        parsed.forEach((ap) => {
          if (ap?.modalidade || ap?.jogo) mods.push(ap.modalidade || ap.jogo);
        });
      }
    } catch {
      // noop
    }
  }

  const unique = Array.from(new Set(mods.map((m) => String(m || '').trim()).filter(Boolean)));
  return unique.length ? unique.join(', ') : '—';
};

const AdminWonBetsPage = () => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWonBets = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/bets', {
        params: { page: 1, pageSize: 200, statuses: 'won,paid' },
      });
      setBets(res.data?.bets || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar ganhadores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWonBets();
  }, []);

  const totalPaid = useMemo(
    () => bets.reduce((acc, bet) => acc + (Number(bet?.prize) || 0), 0),
    [bets],
  );

  return (
    <AdminLayout
      title="Apostas Ganhadoras"
      subtitle="Histórico de apostas premiadas com valor pago."
      actions={
        <button
          onClick={fetchWonBets}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm font-semibold text-sm"
        >
          <FaSyncAlt className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      }
    >
      {error && (
        <div className="mb-4 rounded-r border-l-4 border-red-500 bg-red-50 p-3 text-red-700 shadow-sm">
          <p className="font-bold">Erro</p>
          <p>{error}</p>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
        <div className="flex items-center gap-2">
          <FaTrophy className="text-amber-500" />
          <span>Total de prêmio pago no resultado exibido: {formatCurrency(totalPaid)}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size={40} />
        </div>
      ) : (
        <AdminTable
          headers={[
            'Ref',
            'User ID',
            'Modalidade',
            'Loteria/Horário',
            'Prêmio Pago',
            'Data/Horário',
            'Status',
          ]}
        >
          {bets.length === 0 ? (
            <AdminTableRow>
              <AdminTableCell className="text-center text-slate-500" colSpan={7}>
                Nenhuma aposta ganhadora encontrada.
              </AdminTableCell>
            </AdminTableRow>
          ) : (
            bets.map((bet) => {
              const ref = `${bet.userId || ''}-${bet.id || ''}`;
              return (
                <AdminTableRow key={ref}>
                  <AdminTableCell className="font-semibold text-slate-800">{ref}</AdminTableCell>
                  <AdminTableCell>{bet.userId}</AdminTableCell>
                  <AdminTableCell className="uppercase font-semibold">{extractModalities(bet)}</AdminTableCell>
                  <AdminTableCell>
                    <div className="text-[11px] font-semibold uppercase text-slate-500">{bet.loteria || '—'}</div>
                    <div className="text-sm font-semibold text-slate-700">{bet.codigoHorario || '—'}</div>
                  </AdminTableCell>
                  <AdminTableCell className="font-bold text-emerald-700">{formatCurrency(bet.prize)}</AdminTableCell>
                  <AdminTableCell>{formatDateTime(bet.createdAt)}</AdminTableCell>
                  <AdminTableCell>
                    <StatusBadge status={bet.status || 'won'} />
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

export default AdminWonBetsPage;

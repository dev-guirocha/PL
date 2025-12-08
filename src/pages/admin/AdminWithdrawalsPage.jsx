import React, { useEffect, useState } from 'react';
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

const AdminWithdrawalsPage = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWithdrawals = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/withdrawals', { params: { page: 1, pageSize: 100 } });
      setWithdrawals(res.data?.withdrawals || res.data || []);
    } catch (err) {
      setError('Erro ao carregar solicitações de saque.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const totalPending = withdrawals
    .filter((w) => (w.status || '').toLowerCase() === 'pending' || (w.status || '').toLowerCase() === 'pendente')
    .reduce((acc, w) => acc + (Number(w.amount) || 0), 0);

  return (
    <AdminLayout
      title="Saques"
      subtitle="Solicitações de saque pendentes e processadas."
      actions={
        <button
          onClick={fetchWithdrawals}
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

      <div className="mb-4 text-sm text-slate-600">
        Total solicitações: <span className="font-semibold text-slate-800">{withdrawals.length}</span> | Pendentes:{' '}
        <span className="font-semibold text-amber-700">{formatCurrency(totalPending)}</span>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size={40} />
        </div>
      ) : (
        <AdminTable headers={['ID', 'Usuário', 'Valor', 'Status', 'Criado em']}>
          {withdrawals.length === 0 ? (
            <AdminTableRow>
              <AdminTableCell className="text-center text-slate-500" colSpan={5}>
                Nenhuma solicitação de saque.
              </AdminTableCell>
            </AdminTableRow>
          ) : (
            withdrawals.map((w) => (
              <AdminTableRow key={w.id || w._id}>
                <AdminTableCell className="font-semibold text-slate-800">{w.id || w._id}</AdminTableCell>
                <AdminTableCell>{w.user?.name || w.userName || w.userId || '—'}</AdminTableCell>
                <AdminTableCell className="font-semibold text-emerald-700">{formatCurrency(w.amount)}</AdminTableCell>
                <AdminTableCell>
                  <StatusBadge status={w.status || 'pending'} />
                </AdminTableCell>
                <AdminTableCell>{formatDateTime(w.createdAt)}</AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTable>
      )}
    </AdminLayout>
  );
};

export default AdminWithdrawalsPage;

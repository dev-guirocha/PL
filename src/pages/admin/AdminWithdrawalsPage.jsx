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
  const [updatingId, setUpdatingId] = useState(null);

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

  const updateStatus = async (id, status) => {
    if (!id || !status) return;
    setUpdatingId(id);
    setError('');
    try {
      await api.patch(`/admin/withdrawals/${id}/status`, { status });
      await fetchWithdrawals();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao atualizar status.');
    } finally {
      setUpdatingId(null);
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
        <AdminTable headers={['ID', 'Usuário', 'Valor', 'Pix (CPF)', 'Status', 'Criado em', 'Ações']}>
          {withdrawals.length === 0 ? (
            <AdminTableRow>
              <AdminTableCell className="text-center text-slate-500" colSpan={7}>
                Nenhuma solicitação de saque.
              </AdminTableCell>
            </AdminTableRow>
          ) : (
            withdrawals.map((w) => (
              <AdminTableRow key={w.id || w._id}>
                <AdminTableCell className="font-semibold text-slate-800">{w.id || w._id}</AdminTableCell>
                <AdminTableCell>{w.user?.name || w.userName || w.userId || '—'}</AdminTableCell>
                <AdminTableCell className="font-semibold text-emerald-700">{formatCurrency(w.amount)}</AdminTableCell>
                <AdminTableCell className="text-sm text-slate-700">{w.pixKey || '—'}</AdminTableCell>
                <AdminTableCell>
                  <StatusBadge status={w.status || 'pending'} />
                </AdminTableCell>
                <AdminTableCell>{formatDateTime(w.createdAt)}</AdminTableCell>
                <AdminTableCell className="space-y-1">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => updateStatus(w.id || w._id, 'approved')}
                      disabled={updatingId === (w.id || w._id) || w.status === 'approved' || w.status === 'paid'}
                      className="px-3 py-1 rounded-md bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition disabled:opacity-60"
                    >
                      {updatingId === (w.id || w._id) ? 'Salvando...' : 'Aprovar'}
                    </button>
                    <button
                      onClick={() => updateStatus(w.id || w._id, 'rejected')}
                      disabled={updatingId === (w.id || w._id) || w.status === 'rejected' || w.status === 'paid'}
                      className="px-3 py-1 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition disabled:opacity-60"
                    >
                      Reprovar
                    </button>
                    <button
                      onClick={() => updateStatus(w.id || w._id, 'paid')}
                      disabled={updatingId === (w.id || w._id) || w.status === 'paid'}
                      className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
                    >
                      Marcar pago
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">Marcar pago pressupõe transferência manual já realizada.</p>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTable>
      )}
    </AdminLayout>
  );
};

export default AdminWithdrawalsPage;

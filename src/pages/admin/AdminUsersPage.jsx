import React, { useEffect, useState } from 'react';
import { FaSyncAlt, FaTrashAlt } from 'react-icons/fa';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminTable, { AdminTableRow, AdminTableCell, StatusBadge } from '../../components/admin/AdminTable';
import Spinner from '../../components/Spinner';
import api from '../../utils/api';

const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/users', { params: { page: 1, pageSize: 100 } });
      setUsers(res.data?.users || res.data || []);
    } catch (err) {
      setError('Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const requestDelete = (userId) => {
    setConfirmId(userId);
    setError('');
  };

  const deleteUser = async (userId) => {
    if (!userId) return;
    setDeletingId(userId);
    setError('');
    try {
      const attempts = [
        { url: '/admin/users', config: { params: { id: userId } } },
        { url: `/admin/users/${userId}`, config: {} },
        { url: `/users/${userId}`, config: {} },
        { url: '/users', config: { params: { id: userId } } },
      ];

      let success = false;
      let lastError = null;

      for (const attempt of attempts) {
        try {
          await api.delete(attempt.url, attempt.config);
          success = true;
          break;
        } catch (err) {
          lastError = err;
          if (err?.response?.status !== 404) {
            throw err;
          }
          // Se 404, tenta o próximo formato.
        }
      }

      if (!success) {
        throw lastError || new Error('Endpoint de exclusão não encontrado.');
      }

      setUsers((prev) => prev.filter((u) => (u.id || u._id) !== userId));
      setConfirmId(null);
    } catch (err) {
      const message = err.response?.data?.error || 'Erro ao apagar usuário.';
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const totalBalance = users.reduce((acc, u) => acc + (Number(u.balance) || 0), 0);

  return (
    <AdminLayout
      title="Usuários"
      subtitle="Lista completa de usuários cadastrados."
      actions={
        <button
          onClick={fetchUsers}
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

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size={40} />
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-slate-600">
            Total de usuários: <span className="font-semibold text-slate-800">{users.length}</span> | Saldo combinado:{' '}
            <span className="font-semibold text-emerald-700">{formatCurrency(totalBalance)}</span>
          </div>

          <AdminTable headers={['ID', 'Nome', 'Telefone', 'CPF', 'Saldo', 'Status', 'Ações']}>
            {users.length === 0 ? (
              <AdminTableRow>
                <AdminTableCell className="text-center text-slate-500" colSpan={7}>
                  Nenhum usuário encontrado.
                </AdminTableCell>
              </AdminTableRow>
            ) : (
              users.map((user) => (
                <AdminTableRow key={user.id || user._id}>
                  <AdminTableCell>{user.id || user._id}</AdminTableCell>
                  <AdminTableCell className="font-semibold text-slate-800">{user.name || user.nome || '—'}</AdminTableCell>
                  <AdminTableCell>{user.phone || user.telefone || '—'}</AdminTableCell>
                  <AdminTableCell>{user.cpf || '—'}</AdminTableCell>
                  <AdminTableCell className="font-semibold text-emerald-700">{formatCurrency(user.balance || user.saldo)}</AdminTableCell>
                  <AdminTableCell>
                    <StatusBadge status={user.status || 'ativo'} />
                  </AdminTableCell>
                  <AdminTableCell>
                    {confirmId === (user.id || user._id) ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => deleteUser(user.id || user._id)}
                          disabled={deletingId === (user.id || user._id)}
                          className="px-3 py-1 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-60"
                        >
                          {deletingId === (user.id || user._id) ? 'Apagando...' : 'Confirmar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="px-3 py-1 rounded-md bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => requestDelete(user.id || user._id)}
                        className="text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <FaTrashAlt /> Apagar
                      </button>
                    )}
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTable>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminUsersPage;

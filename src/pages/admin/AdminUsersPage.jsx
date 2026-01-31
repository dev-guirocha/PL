import React, { useEffect, useState } from 'react';
import { FaSyncAlt, FaTrashAlt, FaUserShield, FaUserTag, FaHistory } from 'react-icons/fa';
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
  const [updatingId, setUpdatingId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyUser, setHistoryUser] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);

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

  const toggleAdmin = async (user) => {
    if (!user?.id) return;
    setUpdatingId(user.id);
    setError('');
    try {
      await api.patch(`/admin/users/${user.id}/roles`, { isAdmin: !user.isAdmin });
      await fetchUsers();
    } catch (err) {
      const message = err.response?.data?.error || 'Erro ao atualizar administrador.';
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const promoteSupervisor = async (user) => {
    if (!user?.id) return;
    setUpdatingId(user.id);
    setError('');
    try {
      await api.patch(`/admin/users/${user.id}/roles`, { makeSupervisor: true });
      await fetchUsers();
    } catch (err) {
      const message = err.response?.data?.error || 'Erro ao promover supervisor.';
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const totalBalance = users.reduce((acc, u) => acc + (Number(u.balance) || 0), 0);

  const openHistory = async (user) => {
    const userId = user?.id || user?._id;
    if (!userId) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await api.get(`/admin/users/${userId}/transactions`);
      setHistoryUser(res.data?.user || user);
      setHistoryItems(res.data?.history || []);
    } catch (err) {
      setHistoryError(err.response?.data?.error || 'Erro ao carregar histórico.');
    } finally {
      setHistoryLoading(false);
    }
  };

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

          <AdminTable headers={['ID', 'Nome', 'Telefone', 'CPF', 'Saldo', 'Bônus', 'Papéis', 'Status', 'Ações', 'Histórico']}>
            {users.length === 0 ? (
              <AdminTableRow>
                <AdminTableCell className="text-center text-slate-500" colSpan={10}>
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
                  <AdminTableCell className="font-semibold text-amber-700">{formatCurrency(user.bonus || 0)}</AdminTableCell>
                  <AdminTableCell>
                    <div className="flex flex-col gap-1 text-xs font-semibold">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${user.isAdmin ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        <FaUserShield /> Admin {user.isAdmin ? 'ativo' : 'inativo'}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${user.isSupervisor ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        <FaUserTag /> Supervisor {user.isSupervisor ? 'ativo' : '—'}
                      </span>
                    </div>
                  </AdminTableCell>
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
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => toggleAdmin(user)}
                            disabled={updatingId === user.id}
                            className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
                          >
                            {updatingId === user.id ? 'Salvando...' : user.isAdmin ? 'Remover admin' : 'Tornar admin'}
                          </button>
                          <button
                            type="button"
                            onClick={() => promoteSupervisor(user)}
                            disabled={updatingId === user.id || user.isSupervisor}
                            className="px-3 py-1 rounded-md bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition disabled:opacity-60"
                          >
                            {user.isSupervisor ? 'Já supervisor' : updatingId === user.id ? 'Salvando...' : 'Promover a supervisor'}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => requestDelete(user.id || user._id)}
                          className="text-red-600 hover:text-red-700 flex items-center gap-1 text-sm"
                        >
                          <FaTrashAlt /> Apagar
                        </button>
                      </div>
                    )}
                  </AdminTableCell>
                  <AdminTableCell>
                    <button
                      type="button"
                      onClick={() => openHistory(user)}
                      className="px-3 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition flex items-center gap-2"
                    >
                      <FaHistory /> Histórico
                    </button>
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTable>
        </>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-600">Histórico Financeiro</p>
                <h3 className="text-lg font-bold text-slate-800">
                  {historyUser?.name || 'Usuário'} • #{historyUser?.id || ''}
                </h3>
                <p className="text-xs text-slate-500">
                  Saldo: {formatCurrency(historyUser?.balance)} | Bônus: {formatCurrency(historyUser?.bonus)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-200"
              >
                Fechar
              </button>
            </div>

            <div className="px-5 py-4">
              {historyLoading ? (
                <div className="flex justify-center items-center h-40">
                  <Spinner size={32} />
                </div>
              ) : historyError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {historyError}
                </div>
              ) : historyItems.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Nenhuma movimentação encontrada.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Valor</th>
                        <th className="px-4 py-3">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                          <td className="px-4 py-3 uppercase text-xs font-semibold">{item.type}</td>
                          <td className={`px-4 py-3 font-semibold ${Number(item.amount) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{item.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminUsersPage;

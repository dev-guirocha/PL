import React, { useEffect, useState } from 'react';
import { FaCopy, FaEdit, FaPlus, FaSyncAlt, FaTrashAlt } from 'react-icons/fa';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminTable, { AdminTableRow, AdminTableCell } from '../../components/admin/AdminTable';
import Spinner from '../../components/Spinner';
import api from '../../utils/api';

const AdminSupervisorsPage = () => {
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', cpf: '' });
  const [editingId, setEditingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const fetchSupervisors = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/supervisors', { params: { page: 1, pageSize: 100 } });
      setSupervisors(res.data?.supervisors || res.data || []);
    } catch (err) {
      setError('Erro ao carregar supervisores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupervisors();
  }, []);

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatCPF = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    const parts = [
      digits.slice(0, 3),
      digits.slice(3, 6),
      digits.slice(6, 9),
      digits.slice(9, 11),
    ];
    return parts
      .map((p, i) => {
        if (!p) return '';
        if (i === 0) return p;
        if (i < 3) return `.${p}`;
        return `-${p}`;
      })
      .join('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { name: form.name, phone: form.phone };
      if (editingId) {
        await api.patch(`/admin/supervisors/${editingId}`, payload);
      } else {
        await api.post('/admin/supervisors', payload);
      }
      setForm({ name: '', phone: '', cpf: '' });
      setEditingId(null);
      fetchSupervisors();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao cadastrar supervisor.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (sup) => {
    setEditingId(sup.id || sup._id);
    setForm({ name: sup.name || '', phone: sup.phone || '', cpf: sup.cpf || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteSupervisor = async (id) => {
    if (!id) return;
    try {
      await api.delete(`/admin/supervisors/${id}`);
      fetchSupervisors();
      setConfirmId(null);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao excluir supervisor.';
      setError(msg);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <AdminLayout
      title="Supervisores"
      subtitle="Cadastre supervisores e compartilhe links de indicação."
      actions={
        <button
          onClick={fetchSupervisors}
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

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-center gap-2 mb-3 text-slate-800 font-semibold">
          <FaPlus /> {editingId ? 'Editar supervisor' : 'Novo supervisor'}
        </div>
        <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nome</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Telefone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
              placeholder="(99) 99999-9999"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
            />
            <p className="text-[11px] text-slate-500 mt-1">Digite só números; o formato é aplicado automaticamente.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">CPF</label>
            <input
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })}
              placeholder="000.000.000-00"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
            />
            <p className="text-[11px] text-slate-500 mt-1">Opcional, apenas para referência interna.</p>
          </div>
          <div className="md:col-span-3 flex justify-end">
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ name: '', phone: '', cpf: '' });
                  setError('');
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg shadow hover:bg-slate-200 transition mr-2"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg shadow hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size={40} />
        </div>
      ) : (
        <AdminTable headers={['ID', 'Nome', 'Telefone', 'CPF', 'Link de convite', 'Ações']}>
          {supervisors.length === 0 ? (
            <AdminTableRow>
              <AdminTableCell className="text-center text-slate-500" colSpan={6}>
                Nenhum supervisor cadastrado.
              </AdminTableCell>
            </AdminTableRow>
          ) : (
            supervisors.map((sup) => {
              const code = sup.code || sup.inviteCode || sup.id || sup._id || '';
              const link = sup.inviteLink || (code ? `${origin}/?sup=${code}` : '—');
              return (
                <AdminTableRow key={sup.id || sup._id}>
                  <AdminTableCell className="font-semibold text-slate-800">{sup.id || sup._id}</AdminTableCell>
                  <AdminTableCell>{sup.name || '—'}</AdminTableCell>
                  <AdminTableCell>{sup.phone || '—'}</AdminTableCell>
                  <AdminTableCell>{sup.cpf || '—'}</AdminTableCell>
                  <AdminTableCell>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[220px]">{link}</span>
                        {link !== '—' && (
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(link)}
                            className="text-emerald-700 hover:text-emerald-800"
                            title="Copiar link"
                          >
                            <FaCopy />
                          </button>
                        )}
                      </div>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="flex flex-col gap-2">
                      {code ? (
                        <a
                          href={`${origin}/supervisor?sup=${code}`}
                          className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition text-center"
                        >
                          Painel do supervisor
                        </a>
                      ) : (
                        <span className="text-slate-400 text-sm text-center">—</span>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(sup)}
                          className="flex justify-center items-center gap-1 px-2 py-2 rounded-md bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:border-emerald-300 hover:text-emerald-700 transition"
                          title="Editar"
                        >
                          <FaEdit /> Editar
                        </button>
                        {confirmId === (sup.id || sup._id) ? (
                          <div className="flex flex-col gap-2">
                            <span className="text-xs text-slate-500">Confirmar exclusão?</span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => deleteSupervisor(sup.id || sup._id)}
                                className="flex-1 flex justify-center items-center gap-1 px-2 py-2 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmId(null)}
                                className="flex-1 flex justify-center items-center gap-1 px-2 py-2 rounded-md bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:border-slate-300 transition"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmId(sup.id || sup._id)}
                            className="flex justify-center items-center gap-1 px-2 py-2 rounded-md bg-white border border-slate-200 text-red-600 text-sm font-semibold hover:border-red-300 hover:text-red-700 transition"
                            title="Excluir"
                          >
                            <FaTrashAlt /> Excluir
                          </button>
                        )}
                      </div>
                    </div>
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

export default AdminSupervisorsPage;

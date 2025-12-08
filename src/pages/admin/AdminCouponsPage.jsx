import React, { useEffect, useState } from 'react';
import { FaPlus, FaSyncAlt } from 'react-icons/fa';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminTable, { AdminTableRow, AdminTableCell, StatusBadge } from '../../components/admin/AdminTable';
import Spinner from '../../components/Spinner';
import api from '../../utils/api';

const AdminCouponsPage = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    code: '',
    description: '',
    amount: '',
    type: 'fixed',
    audience: 'all',
    active: true,
  });

  const fetchCoupons = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/coupons', { params: { page: 1, pageSize: 100 } });
      setCoupons(res.data?.coupons || res.data || []);
    } catch (err) {
      setError('Erro ao carregar cupons.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/admin/coupons', form);
      setForm({ code: '', description: '', amount: '', type: 'fixed', audience: 'all', active: true });
      fetchCoupons();
    } catch (err) {
      setError('Erro ao criar cupom.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Cupons"
      subtitle="Crie e gerencie cupons promocionais."
      actions={
        <button
          onClick={fetchCoupons}
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
          <FaPlus /> Novo cupom
        </div>
        <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Código</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Descrição</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
              placeholder="Ex: Bônus para novos usuários"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
            >
              <option value="fixed">Valor fixo</option>
              <option value="percent">Percentual</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Valor</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Público</label>
            <select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
            >
              <option value="all">Todos</option>
              <option value="new">Novos usuários</option>
              <option value="existing">Usuários atuais</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 text-emerald-600 rounded border-slate-300"
            />
            <label htmlFor="active" className="text-sm text-slate-700">
              Ativar cupom
            </label>
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg shadow hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar cupom'}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size={40} />
        </div>
      ) : (
        <AdminTable headers={['ID', 'Código', 'Descrição', 'Valor', 'Tipo', 'Público', 'Status']}>
          {coupons.length === 0 ? (
            <AdminTableRow>
              <AdminTableCell className="text-center text-slate-500" colSpan={7}>
                Nenhum cupom cadastrado.
              </AdminTableCell>
            </AdminTableRow>
          ) : (
            coupons.map((c) => (
              <AdminTableRow key={c.id || c._id}>
                <AdminTableCell className="font-semibold text-slate-800">{c.id || c._id}</AdminTableCell>
                <AdminTableCell className="font-semibold">{c.code || '—'}</AdminTableCell>
                <AdminTableCell>{c.description || '—'}</AdminTableCell>
                <AdminTableCell>
                  {c.type === 'percent' ? `${c.amount || c.valor || 0}%` : `R$ ${(Number(c.amount || c.valor) || 0).toFixed(2).replace('.', ',')}`}
                </AdminTableCell>
                <AdminTableCell className="uppercase text-xs font-semibold text-slate-700">
                  {c.type === 'percent' ? 'PERCENTUAL' : 'FIXO'}
                </AdminTableCell>
                <AdminTableCell className="capitalize">{c.audience || 'Todos'}</AdminTableCell>
                <AdminTableCell>
                  <StatusBadge status={c.active ? 'ativo' : 'inativo'} />
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTable>
      )}
    </AdminLayout>
  );
};

export default AdminCouponsPage;

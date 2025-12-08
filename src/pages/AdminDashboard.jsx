import React, { useEffect, useState } from 'react';
import { FaArrowLeft, FaSyncAlt, FaUsers, FaTicketAlt, FaClipboardList, FaDollarSign, FaTag } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Spinner from '../components/Spinner';
import Card from '../components/Card';

const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [counts, setCounts] = useState({ users: 0, bets: 0, supervisors: 0, results: 0, withdrawals: 0, coupons: 0 });
  const navigate = useNavigate();

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes, betsRes, supRes, resRes, wdRes, coupRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users', { params: { page: 1, pageSize: 5 } }),
        api.get('/admin/bets', { params: { page: 1, pageSize: 5 } }),
        api.get('/admin/supervisors', { params: { page: 1, pageSize: 5 } }),
        api.get('/admin/results', { params: { page: 1, pageSize: 5 } }),
        api.get('/admin/withdrawals', { params: { page: 1, pageSize: 5 } }),
        api.get('/admin/coupons', { params: { page: 1, pageSize: 5 } }),
      ]);
      setStats(statsRes.data);
      setCounts({
        users: usersRes.data?.total || usersRes.data?.users?.length || 0,
        bets: betsRes.data?.total || betsRes.data?.bets?.length || 0,
        supervisors: supRes.data?.total || supRes.data?.supervisors?.length || 0,
        results: resRes.data?.total || resRes.data?.results?.length || 0,
        withdrawals: wdRes.data?.total || wdRes.data?.withdrawals?.length || 0,
        coupons: coupRes.data?.total || coupRes.data?.coupons?.length || 0,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const cards = [
    { title: 'Usuários', count: counts.users, icon: <FaUsers className="text-emerald-700" />, action: () => navigate('/admin/users') },
    { title: 'Apostas', count: counts.bets, icon: <FaTicketAlt className="text-emerald-700" />, action: () => navigate('/admin/bets') },
    { title: 'Supervisores', count: counts.supervisors, icon: <FaClipboardList className="text-emerald-700" />, action: () => navigate('/admin/supervisors') },
    { title: 'Resultados', count: counts.results, icon: <FaClipboardList className="text-emerald-700" />, action: () => navigate('/admin/results') },
    { title: 'Saques', count: counts.withdrawals, icon: <FaDollarSign className="text-emerald-700" />, action: () => navigate('/admin/withdrawals') },
    { title: 'Cupons', count: counts.coupons, icon: <FaTag className="text-emerald-700" />, action: () => navigate('/admin/coupons') },
  ];

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-100 p-4 pb-12 font-sans flex flex-col gap-4"
      style={{ backgroundImage: 'linear-gradient(135deg, #ecfdf3 0%, #f8fafc 50%, #e0f2fe 100%)' }}
    >
      <div className="w-full bg-emerald-800 text-white rounded-2xl shadow-lg p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-emerald-100">Painel Administrador</p>
          <h2 className="text-2xl font-bold">Visão Geral</h2>
          <p className="text-sm text-emerald-100/90">Métricas e atalhos para usuários, apostas, supervisores, resultados, saques e cupons.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 bg-white text-emerald-800 font-semibold rounded-lg shadow hover:shadow-md flex items-center gap-2 transition disabled:opacity-60"
            onClick={fetchAll}
            disabled={loading}
          >
            <FaSyncAlt /> Atualizar
          </button>
          <button
            className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg shadow hover:bg-emerald-700 flex items-center gap-2 transition"
            onClick={() => (window.location.href = '/home')}
          >
            <FaArrowLeft /> Voltar ao app
          </button>
        </div>
      </div>

      {error && <div className="text-red-600 bg-white border border-red-100 rounded-xl p-3 shadow">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size={32} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-r from-emerald-100 to-white border border-emerald-100">
              <div className="text-sm text-emerald-800/80">Saldo Plataforma</div>
              <div className="text-3xl font-bold text-emerald-900">{formatCurrency(stats?.platformFunds || 0)}</div>
              <div className="text-xs text-emerald-700 mt-2">
                Carteiras {formatCurrency(stats?.wallets?.totalBalance || 0)} | Bônus {formatCurrency(stats?.wallets?.totalBonus || 0)}
              </div>
            </Card>
            <Card className="bg-gradient-to-r from-cyan-100 to-white border border-cyan-100">
              <div className="text-sm text-cyan-900/80">Apostas</div>
              <div className="text-3xl font-bold text-cyan-900">{stats?.betsCount || 0}</div>
              <div className="text-xs text-cyan-800 mt-2">Saída em apostas {formatCurrency(stats?.moneyOut?.bets || 0)}</div>
            </Card>
            <Card className="bg-gradient-to-r from-amber-100 to-white border border-amber-100">
              <div className="text-sm text-amber-900/80">Retiradas</div>
              <div className="text-3xl font-bold text-amber-900">{formatCurrency(stats?.moneyOut?.withdrawals || 0)}</div>
              <div className="text-xs text-amber-800 mt-2">Entradas (depósitos) {formatCurrency(stats?.moneyIn?.deposits || 0)}</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((c) => (
              <Card key={c.title} className="flex flex-col gap-3 hover:shadow-lg transition border border-slate-100">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-lg">
                  {c.icon}
                  <span>{c.title}</span>
                </div>
                <div className="text-sm text-gray-600">Itens: {c.count}</div>
                <button
                  className="mt-auto py-2 bg-emerald-700 text-white font-semibold rounded-lg shadow hover:bg-emerald-800 transition"
                  onClick={c.action}
                  type="button"
                >
                  Abrir
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaSyncAlt,
  FaUsers,
  FaTicketAlt,
  FaClipboardList,
  FaDollarSign,
  FaTag,
  FaWallet,
  FaChartLine,
  FaExchangeAlt,
} from 'react-icons/fa';
import api from '../utils/api';
import AdminLayout from '../components/admin/AdminLayout';
import StatCard from '../components/admin/StatCard';
import Spinner from '../components/Spinner';

const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch (err) {
      setError('Erro ao carregar estatísticas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const menuActions = [
    { title: 'Usuários', icon: <FaUsers />, path: '/admin/users', color: 'bg-blue-100 text-blue-700', desc: 'Gerenciar base de clientes' },
    { title: 'Apostas', icon: <FaTicketAlt />, path: '/admin/bets', color: 'bg-emerald-100 text-emerald-700', desc: 'Ver histórico de jogos' },
    { title: 'Resultados', icon: <FaClipboardList />, path: '/admin/results', color: 'bg-purple-100 text-purple-700', desc: 'Lançar sorteios diários' },
    { title: 'Saques', icon: <FaDollarSign />, path: '/admin/withdrawals', color: 'bg-amber-100 text-amber-700', desc: 'Aprovar retiradas' },
    { title: 'Supervisores', icon: <FaChartLine />, path: '/admin/supervisors', color: 'bg-cyan-100 text-cyan-700', desc: 'Gestão de equipe' },
    { title: 'Cupons', icon: <FaTag />, path: '/admin/coupons', color: 'bg-pink-100 text-pink-700', desc: 'Promoções e bônus' },
  ];

  return (
    <AdminLayout
      title="Visão Geral"
      subtitle="Métricas em tempo real da plataforma."
      actions={
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm font-semibold text-sm"
        >
          <FaSyncAlt className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      }
    >
      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r shadow-sm">
          <p className="font-bold">Erro</p>
          <p>{error}</p>
        </div>
      )}

      {loading && !stats ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size={40} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <StatCard
              title="Saldo Plataforma"
              value={formatCurrency(stats?.platformFunds)}
              subtext={`Carteiras: ${formatCurrency(stats?.wallets?.totalBalance)}`}
              icon={<FaWallet />}
              color="emerald"
            />
            <StatCard
              title="Volume Apostas"
              value={stats?.betsCount}
              subtext={`Total movimentado: ${formatCurrency(stats?.moneyOut?.bets)}`}
              icon={<FaTicketAlt />}
              color="blue"
            />
            <StatCard
              title="Saques Pendentes"
              value={formatCurrency(stats?.moneyOut?.withdrawals)}
              subtext={`Entradas: ${formatCurrency(stats?.moneyIn?.deposits)}`}
              icon={<FaExchangeAlt />}
              color="amber"
            />
          </div>

          <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">Gestão Rápida</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuActions.map((item) => (
              <div
                key={item.title}
                onClick={() => navigate(item.path)}
                className="group cursor-pointer bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-200 flex items-start gap-4"
              >
                <div className={`p-3 rounded-xl ${item.color} text-xl group-hover:scale-110 transition-transform`}>{item.icon}</div>
                <div>
                  <h4 className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">{item.title}</h4>
                  <p className="text-sm text-slate-500 mt-1 leading-snug">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminDashboard;

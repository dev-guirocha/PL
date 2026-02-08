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
import NotificationBadge from '../components/admin/NotificationBadge';
import Spinner from '../components/Spinner';
import { useNotifications } from '../hooks/useNotifications';

const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const { counts } = useNotifications();
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankBalanceInput, setBankBalanceInput] = useState('');
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
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

  const parseMoneyInput = (rawValue) => {
    const raw = String(rawValue || '').trim();
    if (!raw) return Number.NaN;
    let normalized = raw;
    if (raw.includes(',')) {
      normalized = raw.replace(/\./g, '').replace(',', '.');
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };

  const openBankBalanceModal = async () => {
    setBankModalOpen(true);
    setBankError('');
    setBankLoading(true);
    try {
      const res = await api.get('/admin/bank-balance');
      const value = Number(res.data?.value || 0);
      setBankBalanceInput(value.toFixed(2).replace('.', ','));
    } catch (err) {
      const fallback = Number(stats?.bankBalance || 0);
      setBankBalanceInput(fallback.toFixed(2).replace('.', ','));
      setBankError('Falha ao carregar saldo atual. Você ainda pode atualizar.');
    } finally {
      setBankLoading(false);
    }
  };

  const saveBankBalance = async () => {
    const parsed = parseMoneyInput(bankBalanceInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setBankError('Informe um valor válido (ex: 1234,56).');
      return;
    }

    setBankSaving(true);
    setBankError('');
    try {
      await api.post('/admin/bank-balance', { value: parsed });
      await fetchStats();
      setBankModalOpen(false);
    } catch (err) {
      setBankError(err.response?.data?.error || 'Erro ao salvar saldo bancário.');
    } finally {
      setBankSaving(false);
    }
  };

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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
            <StatCard
              title="Saldo Plataforma"
              value={formatCurrency(stats?.platformFunds)}
              subtext={`Total apostado na plataforma`}
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
              value={formatCurrency(stats?.pendingWithdrawals?.amount)}
              subtext={`Qtd: ${stats?.pendingWithdrawals?.count || 0} | Carteiras: ${formatCurrency(stats?.wallets?.total || 0)}`}
              icon={<FaExchangeAlt />}
              color="amber"
            />
            <StatCard
              title="Total de Premiações"
              value={formatCurrency(stats?.totalPaidPrizes)}
              subtext="Clique para abrir ganhadores"
              icon={<FaDollarSign />}
              color="rose"
              onClick={() => navigate('/admin/bets/winners')}
            />
            <StatCard
              title="Saldo em Conta"
              value={formatCurrency(stats?.bankBalance)}
              subtext="Clique para atualizar manualmente"
              icon={<FaWallet />}
              color="emerald"
              onClick={openBankBalanceModal}
            />
          </div>

          <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">Gestão Rápida</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuActions.map((item) => (
              <div
                key={item.title}
                onClick={() => navigate(item.path)}
                className="group relative cursor-pointer bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-200 flex items-start gap-4"
              >
                <div className={`p-3 rounded-xl ${item.color} text-xl group-hover:scale-110 transition-transform`}>{item.icon}</div>
                <div>
                  <h4 className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">{item.title}</h4>
                  <p className="text-sm text-slate-500 mt-1 leading-snug">{item.desc}</p>
                </div>
                {item.title === 'Saques' && <NotificationBadge count={counts.withdrawals} pulse />}
                {item.title === 'Apostas' && <NotificationBadge count={counts.betsNew} pulse />}
              </div>
            ))}
          </div>

          {bankModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase text-emerald-700">Saldo Bancário</p>
                  <h3 className="text-lg font-bold text-slate-800">Atualização Manual</h3>
                </div>

                {bankError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    {bankError}
                  </div>
                )}

                <label className="block text-xs font-semibold text-slate-500 mb-1">Valor em conta</label>
                <input
                  value={bankBalanceInput}
                  onChange={(e) => setBankBalanceInput(e.target.value)}
                  placeholder="0,00"
                  disabled={bankLoading || bankSaving}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setBankModalOpen(false)}
                    disabled={bankSaving}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveBankBalance}
                    disabled={bankLoading || bankSaving}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {bankSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
};

export default AdminDashboard;

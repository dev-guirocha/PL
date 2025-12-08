import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaArrowLeft, FaCopy, FaSyncAlt } from 'react-icons/fa';
import Spinner from '../components/Spinner';

const StatCard = ({ title, value, subtext, color = 'emerald' }) => {
  const colors = {
    emerald: 'from-emerald-500 to-teal-600 text-emerald-50',
    blue: 'from-sky-500 to-indigo-600 text-blue-50',
    amber: 'from-amber-400 to-orange-500 text-amber-50',
  };
  const bg = colors[color] || colors.emerald;
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${bg} p-5 shadow-lg shadow-slate-200`}>
      <div className="relative z-10">
        <p className="text-sm font-bold uppercase tracking-wide opacity-80">{title}</p>
        <p className="text-3xl font-extrabold tracking-tight text-white mt-1">{value}</p>
        {subtext && <p className="text-xs font-medium opacity-90 mt-1">{subtext}</p>}
      </div>
      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl" />
    </div>
  );
};

const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;

const SupervisorDashboard = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const supCode = params.get('sup') || '—';
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    users: 0,
    volume: 0,
  });

  const commission = useMemo(() => (Number(stats.volume) || 0) * 0.05, [stats.volume]); // placeholder: 5% do primeiro depósito
  const inviteLink = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/?sup=${supCode}`;
  }, [supCode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Quando houver endpoint, substituir pelos dados reais.
      // Placeholder para manter visual enquanto o backend não expõe stats do supervisor.
      setStats((prev) => ({
        users: prev.users || 0,
        volume: prev.volume || 0,
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition"
            title="Voltar"
          >
            <FaArrowLeft />
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Painel do Supervisor</p>
            <h1 className="text-lg font-bold text-emerald-800">Código: {supCode}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(inviteLink);
            }}
            className="px-3 py-2 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition flex items-center gap-2 text-sm font-semibold"
          >
            Copiar link <FaCopy />
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-2 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <FaSyncAlt className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard title="Usuários cadastrados" value={stats.users} subtext="Via seu link" color="blue" />
          <StatCard title="Volume gerado" value={formatCurrency(stats.volume)} subtext="Total apostado" color="emerald" />
          <StatCard title="Comissão estimada" value={formatCurrency(commission)} subtext="5% do primeiro depósito de cada usuário" color="amber" />
        </section>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-bold text-slate-800 mb-2">Resumo</h2>
          <p className="text-sm text-slate-600">
            Este painel mostrará o desempenho do supervisor. Quando os dados de API estiverem disponíveis, exibiremos os usuários cadastrados pelo código
            <span className="font-semibold text-emerald-700"> {supCode}</span> e o volume movimentado.
          </p>
          {loading && (
            <div className="flex justify-center items-center py-6">
              <Spinner size={32} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default SupervisorDashboard;

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowDown, FaArrowUp, FaExchangeAlt, FaMoneyBillWave, FaTrophy } from 'react-icons/fa';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { formatDateTimeBR } from '../utils/date';
import api from '../utils/api';

const FILTERS = [
  { value: 'all', label: 'Todos', icon: <FaExchangeAlt /> },
  { value: 'deposit', label: 'Depósito', icon: <FaArrowDown /> },
  { value: 'bet', label: 'Aposta', icon: <FaMoneyBillWave /> },
  { value: 'prize', label: 'Prêmio', icon: <FaTrophy /> },
  { value: 'withdraw', label: 'Saque', icon: <FaArrowUp /> },
];

const typeLabel = (type) => {
  const normalized = String(type || '').toLowerCase();
  if (normalized === 'deposit') return 'Depósito';
  if (normalized === 'bet') return 'Aposta Realizada';
  if (normalized === 'prize') return 'Prêmio Recebido';
  if (normalized === 'withdraw_request') return 'Saque Solicitado';
  if (normalized === 'withdraw_reject') return 'Estorno de Saque';
  if (normalized === 'bonus') return 'Bônus';
  if (normalized === 'adjustment') return 'Ajuste';
  return normalized || 'Movimentação';
};

const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;

const StatementPage = () => {
  const navigate = useNavigate();
  const { refreshUser, authError } = useAuth();
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStatement = async (category = filter) => {
    setLoading(true);
    setError('');
    try {
      const params = { take: 120, skip: 0 };
      if (category !== 'all') params.category = category;
      const res = await api.get('/wallet/statement', { params });
      setItems(res.data?.items || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar extrato.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    fetchStatement(filter);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    const credit = items
      .filter((item) => Number(item.amount) > 0)
      .reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const debit = items
      .filter((item) => Number(item.amount) < 0)
      .reduce((acc, item) => acc + Number(item.amount || 0), 0);
    return { credit, debit };
  }, [items]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 px-4 py-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <button
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-lg transition hover:from-emerald-800 hover:to-emerald-700"
          onClick={() => navigate('/home')}
        >
          Voltar
        </button>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase text-emerald-700">Extrato</p>
          <h1 className="text-lg font-extrabold text-emerald-900">Histórico financeiro</h1>
        </div>
      </div>

      {(error || authError) && (
        <div className="mx-auto mt-3 max-w-4xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow">
          {error || authError}
        </div>
      )}

      <div className="mx-auto mt-4 max-w-5xl rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold transition ${
                filter === option.value
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold">
          <span className="text-emerald-700">Entradas: {formatCurrency(totals.credit)}</span>
          <span className="text-red-600">Saídas: {formatCurrency(Math.abs(totals.debit))}</span>
        </div>
      </div>

      <div className="mx-auto mt-4 flex max-w-5xl flex-col gap-3">
        {loading && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-slate-600 shadow">
            <Spinner size={32} />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-slate-600 shadow">
            Nenhuma movimentação encontrada para o filtro selecionado.
          </div>
        )}

        {items.map((item) => {
          const amountNumber = Number(item.amount || 0);
          const positive = amountNumber >= 0;
          return (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-slate-800">{typeLabel(item.type)}</span>
                <span className={`text-sm font-extrabold ${positive ? 'text-emerald-700' : 'text-red-600'}`}>
                  {positive ? '+' : '-'} {formatCurrency(Math.abs(amountNumber))}
                </span>
              </div>
              {item.description && <div className="mt-1 text-xs text-slate-500">{item.description}</div>}
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {formatDateTimeBR(item.createdAt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatementPage;

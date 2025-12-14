import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const WithdrawPage = () => {
  const navigate = useNavigate();
  const { balance, bonus, refreshUser } = useAuth();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    refreshUser();
    fetchRequests();
  }, [refreshUser]);

  const formatInputMoney = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    const number = Number(digits) / 100;
    return number.toFixed(2);
  };

  const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/wallet/withdraws');
      setRequests(res.data?.withdrawals || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar saques.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = Number(amount);
    if (!val || val <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/wallet/withdraw', { amount: val });
      setAmount('');
      fetchRequests();
      refreshUser();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao solicitar saque.');
    } finally {
      setLoading(false);
    }
  };

  const available = useMemo(() => Number(balance || 0), [balance]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-sky-100 px-4 py-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <button
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-lg transition hover:from-emerald-800 hover:to-emerald-700"
          onClick={() => navigate('/home')}
        >
          Voltar
        </button>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase text-emerald-700">Saque</p>
          <h1 className="text-lg font-extrabold text-emerald-900">Solicitar saque</h1>
        </div>
      </div>

      {error && (
        <div className="mx-auto mt-3 max-w-4xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow">
          {error}
        </div>
      )}

      <div className="mx-auto mt-4 flex max-w-5xl flex-col gap-4">
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">Saldo disponível</p>
              <p className="text-xl font-extrabold text-emerald-800">{formatCurrency(available)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Bônus (não sacável)</p>
              <p className="text-xl font-extrabold text-emerald-800">{formatCurrency(bonus)}</p>
            </div>
          </div>
          <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Valor do saque</label>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(formatInputMoney(e.target.value))}
                placeholder="0,00"
                className="w-full rounded-lg border border-slate-200 px-3 py-3 text-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-sm font-extrabold uppercase text-white shadow-xl transition hover:-translate-y-0.5 hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-60"
              >
                {loading ? 'Enviando...' : 'Solicitar'}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="text-sm font-extrabold text-emerald-800">Histórico de solicitações</div>
          {loading && requests.length === 0 ? (
            <div className="flex justify-center py-6">
              <Spinner size={32} />
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {requests.length === 0 ? (
                <div className="text-sm text-slate-500">Nenhum saque solicitado.</div>
              ) : (
                requests.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="font-semibold">#{r.id}</span>
                    <span>{formatCurrency(r.amount)}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase ${
                        r.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-700'
                          : r.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {r.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(r.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WithdrawPage;

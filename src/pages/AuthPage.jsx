import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { useEffect } from 'react';

const AuthPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true); // Alternar entre Login e Cadastro
  const [formData, setFormData] = useState({ name: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [supervisorCode, setSupervisorCode] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sup = params.get('sup');
    const stored = localStorage.getItem('pendingSupCode') || sessionStorage.getItem('pendingSupCode');
    if (sup) {
      const normalized = sup.toUpperCase();
      setSupervisorCode(normalized);
      localStorage.setItem('pendingSupCode', normalized);
    } else if (stored) {
      setSupervisorCode(stored.toUpperCase());
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const formatPhone = (value) => {
    const digits = (value || '').replace(/\D/g, '').slice(0, 11);
    const part1 = digits.slice(0, 2);
    const part2 = digits.slice(2, 7);
    const part3 = digits.slice(7, 11);
    if (part3) return `(${part1}) ${part2}-${part3}`;
    if (part2) return `(${part1}) ${part2}`;
    if (part1) return `(${part1}`;
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const endpoint = isLogin ? '/auth/login' : '/auth/register';

    try {
      const payload = isLogin ? formData : { ...formData, supervisorCode };
      const response = await api.post(endpoint, payload);
      const { user } = response.data;

      // Persist only a non-sensível flag; o token fica em cookie HttpOnly
      const storage = rememberMe || !isLogin ? localStorage : sessionStorage;
      storage.setItem('loggedIn', 'true');
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      storage.setItem('user', JSON.stringify(user));
      
      toast.success(`Bem-vindo, ${user.name || 'Usuário'}! Login realizado.`);
      localStorage.removeItem('pendingSupCode');
      sessionStorage.removeItem('pendingSupCode');
      navigate('/home');
    } catch (err) {
      const message = err.response?.data?.error || 'Erro ao conectar.';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.12),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.15),transparent_20%),linear-gradient(135deg,#f0fdf4,#ffffff_40%,#e8f9f0)] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white/90 p-7 shadow-2xl backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Panda Loterias</p>
            <h2 className="text-2xl font-extrabold text-emerald-800">{isLogin ? 'Acessar Conta' : 'Criar Nova Conta'}</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            Seguro
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError('');
            }}
            className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
              isLogin ? 'border-emerald-500 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg' : 'border-emerald-100 bg-emerald-50 text-emerald-800'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError('');
              setFormData({ name: '', phone: '', password: '' });
            }}
            className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
              !isLogin ? 'border-emerald-500 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg' : 'border-emerald-100 bg-emerald-50 text-emerald-800'
            }`}
          >
            Cadastrar
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLogin && (
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-bold text-slate-700">
                Nome Completo
              </label>
              <input
                id="name"
                type="text"
                name="name"
                placeholder="Seu Nome Completo"
                value={formData.name}
                onChange={handleChange}
                required={!isLogin}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-bold text-slate-700">
              Celular (WhatsApp)
            </label>
            <input
              id="phone"
              type="tel"
              name="phone"
              placeholder="(99) 99999-9999"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
              required
              inputMode="tel"
              maxLength={16}
              className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <label htmlFor="supcode" className="text-sm font-bold text-slate-700">
                Código do Supervisor (opcional)
              </label>
              <input
                id="supcode"
                type="text"
                name="supervisorCode"
                placeholder="EX: ABC123"
                value={supervisorCode}
                onChange={(e) => setSupervisorCode(e.target.value.trim().toUpperCase())}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-bold text-slate-700">
              Senha
            </label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="Sua Senha"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {isLogin && (
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                id="saveAccess"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
              <span>Salvar acesso neste dispositivo</span>
            </label>
          )}

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-sm font-extrabold uppercase text-white shadow-xl transition hover:-translate-y-0.5 hover:from-emerald-700 hover:to-emerald-600"
          >
            {isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          {isLogin ? 'Não tem conta? ' : 'Já tem conta? '}
          <span
            className="cursor-pointer font-bold text-emerald-700 underline"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setFormData({ name: '', phone: '', password: '' });
            }}
          >
            {isLogin ? 'Cadastre-se' : 'Fazer Login'}
          </span>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;

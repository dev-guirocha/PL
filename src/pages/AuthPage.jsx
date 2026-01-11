import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../utils/api';
import * as loginFlow from '../utils/loginFlow.mjs';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import icon from '../assets/images/icon.png';

const AuthPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // login | register | reset
  const [formData, setFormData] = useState({ name: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ name: '', phone: '', password: '', resetCode: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [supervisorCode, setSupervisorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1 = solicitar código, 2 = informar código + nova senha
  const [resetCode, setResetCode] = useState('');
  const [devResetCode, setDevResetCode] = useState('');
  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isReset = mode === 'reset';
  const { setAuthToken, setBearerFallback } = useAuth();
  const passwordChecks = {
    length: formData.password.length >= 8,
    number: /\d/.test(formData.password),
    special: /[^A-Za-z0-9]/.test(formData.password),
    letter: /[A-Za-z]/.test(formData.password),
  };
  const passwordChecklist = [
    { key: 'length', label: 'Pelo menos 8 caracteres', met: passwordChecks.length },
    { key: 'number', label: 'Inclui pelo menos um número', met: passwordChecks.number },
    { key: 'special', label: 'Inclui um caractere especial (!@#$%)', met: passwordChecks.special },
    { key: 'letter', label: 'Inclui uma letra', met: passwordChecks.letter },
  ];
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
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (fieldErrors[name]) {
      setFieldErrors({ ...fieldErrors, [name]: '' });
    }
  };
  const handlePhoneChange = (value) => {
    setFormData({ ...formData, phone: formatPhone(value) });
    if (fieldErrors.phone) {
      setFieldErrors({ ...fieldErrors, phone: '' });
    }
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

  const validateForm = ({ checkName, checkPhone, checkPassword }) => {
    const errors = { name: '', phone: '', password: '', resetCode: '' };
    const trimmedName = (formData.name || '').trim();
    const rawPhone = (formData.phone || '').replace(/\D/g, '');
    const pass = formData.password || '';

    if (checkName && trimmedName.length < 2) {
      errors.name = 'Informe seu nome completo.';
    }
    if (checkPhone && !/^[1-9]{2}9[0-9]{8}$/.test(rawPhone)) {
      errors.phone = 'Telefone inválido. Use DDD + 9 dígitos.';
    }
    if (checkPassword && pass.length < 8) {
      errors.password = 'A senha deve ter ao menos 8 caracteres.';
    } else if (checkPassword && (!/[A-Za-z]/.test(pass) || !/\d/.test(pass) || !/[^A-Za-z0-9]/.test(pass))) {
      errors.password = 'A senha deve conter letras, números e um caractere especial.';
    }

    setFieldErrors(errors);
    const firstError = Object.values(errors).find(Boolean);
    if (firstError) {
      toast.error(firstError);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isReset) {
      return handleReset();
    }

    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    setAuthToken(null);
    setBearerFallback(false);

    try {
      if (!validateForm({ checkName: isRegister, checkPhone: true, checkPassword: !isLogin })) return;
      setFieldErrors({ name: '', phone: '', password: '', resetCode: '' });
      const payload = isLogin ? formData : { ...formData, supervisorCode };
      const response = await api.post(endpoint, payload);
      const { user, token: fallbackToken } = response.data || {};

      try {
        await loginFlow.completeLogin({
          apiClient: api,
          rememberMe,
          isLogin,
          user,
          fallbackToken,
          setAuthToken,
          setBearerFallback,
        });
      } catch (sessionErr) {
        const message = sessionErr?.message || loginFlow.SESSION_ERROR_MESSAGE;
        setError(message);
        toast.error(message);
        return;
      }
      
      toast.success(`Bem-vindo, ${user.name || 'Usuário'}! Login realizado.`);
      localStorage.removeItem('pendingSupCode');
      sessionStorage.removeItem('pendingSupCode');
      navigate('/home');
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Erro ao conectar.';
      const field = err.response?.data?.field;
      setError(message);
      toast.error(message);
      if (field && ['name', 'phone', 'password', 'resetCode', 'code'].includes(field)) {
        setFieldErrors((prev) => ({ ...prev, [field]: message }));
      }
    }
  };

  const handleReset = async () => {
    try {
      if (resetStep === 1) {
        if (!validateForm({ checkName: false, checkPhone: true, checkPassword: false })) return;
        setFieldErrors({ name: '', phone: '', password: '' });
        setDevResetCode('');
        const response = await api.post('/auth/forgot', { phone: formData.phone });
        toast.success('Código enviado. Validade 15 minutos.');
        if (response.data?.code) {
          setDevResetCode(response.data.code);
          toast.info(`Código para testes: ${response.data.code}`);
        }
        setResetStep(2);
        setFormData((prev) => ({ ...prev, password: '' }));
        setShowPassword(false);
        return;
      }

      // Step 2 - validar código e nova senha
      if (!resetCode) {
        setFieldErrors((prev) => ({ ...prev, phone: prev.phone, password: prev.password, resetCode: 'Informe o código recebido.' }));
        toast.error('Informe o código recebido.');
        return;
      }
      if (!validateForm({ checkName: false, checkPhone: true, checkPassword: true })) return;
      const payload = { phone: formData.phone, code: resetCode, newPassword: formData.password };
      await api.post('/auth/reset', payload);
      toast.success('Senha redefinida com sucesso. Faça login.');
      setMode('login');
      setResetStep(1);
      setResetCode('');
      setDevResetCode('');
      setFieldErrors({ name: '', phone: '', password: '', resetCode: '' });
      setFormData({ name: '', phone: '', password: '' });
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Erro ao conectar.';
      const field = err.response?.data?.field;
      setError(message);
      toast.error(message);
      if (field && ['name', 'phone', 'password', 'resetCode'].includes(field)) {
        setFieldErrors((prev) => ({ ...prev, [field]: message }));
      }
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.12),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.15),transparent_20%),linear-gradient(135deg,#f0fdf4,#ffffff_40%,#e8f9f0)] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white/90 p-7 shadow-2xl backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={icon} alt="Logo" className="h-10 w-10 rounded-xl shadow-md" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Panda Loterias</p>
              <h2 className="text-2xl font-extrabold text-emerald-800">
                {isReset ? 'Redefinir senha' : isLogin ? 'Acessar Conta' : 'Criar Nova Conta'}
              </h2>
            </div>
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
              setMode('login');
              setResetStep(1);
              setResetCode('');
              setDevResetCode('');
              setError('');
      setFieldErrors({ name: '', phone: '', password: '', resetCode: '' });
            }}
            className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
              mode === 'login' ? 'border-emerald-500 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg' : 'border-emerald-100 bg-emerald-50 text-emerald-800'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setResetStep(1);
              setResetCode('');
              setDevResetCode('');
              setError('');
              setFormData({ name: '', phone: '', password: '' });
      setFieldErrors({ name: '', phone: '', password: '', resetCode: '' });
            }}
            className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
              mode === 'register' ? 'border-emerald-500 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg' : 'border-emerald-100 bg-emerald-50 text-emerald-800'
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
          {isRegister && (
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
                required={isRegister}
                className={`w-full rounded-xl border px-3 py-3 text-sm shadow-sm outline-none transition focus:ring-2 ${
                  fieldErrors.name ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-100'
                }`}
              />
              {fieldErrors.name && <p className="text-xs font-semibold text-red-600">{fieldErrors.name}</p>}
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
              onChange={(e) => handlePhoneChange(e.target.value)}
              required
              inputMode="tel"
              maxLength={16}
              className={`w-full rounded-xl border px-3 py-3 text-sm shadow-sm outline-none transition focus:ring-2 ${
                fieldErrors.phone ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-100'
              }`}
            />
            {fieldErrors.phone && <p className="text-xs font-semibold text-red-600">{fieldErrors.phone}</p>}
          </div>

          {isReset && (
            <div className="space-y-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-sm">
              <p className="font-semibold text-amber-800">
                {resetStep === 1
                  ? 'Informe seu telefone e enviaremos um código de 6 dígitos (validade: 15 minutos).'
                  : 'Digite o código recebido e crie uma nova senha.'}
              </p>
              {devResetCode && (
                <p className="rounded-lg border border-dashed border-amber-200 bg-white px-2 py-1 text-xs font-semibold text-amber-700">
                  Código para testes: <span className="font-mono">{devResetCode}</span>
                </p>
              )}
            </div>
          )}

          {isReset && resetStep === 2 && (
            <div className="space-y-2">
              <label htmlFor="resetCode" className="text-sm font-bold text-slate-700">
                Código recebido
              </label>
              <input
                id="resetCode"
                type="text"
                name="resetCode"
                placeholder="Ex: 123456"
                value={resetCode}
                onChange={(e) => {
                  setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (fieldErrors.resetCode) setFieldErrors({ ...fieldErrors, resetCode: '' });
                }}
                required
                className={`w-full rounded-xl border px-3 py-3 text-sm shadow-sm outline-none transition focus:ring-2 ${
                  fieldErrors.resetCode ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-100'
                }`}
              />
              {fieldErrors.resetCode && <p className="text-xs font-semibold text-red-600">{fieldErrors.resetCode}</p>}
            </div>
          )}

          {isRegister && (
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

          {(!isReset || resetStep === 2) && (
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-bold text-slate-700">
                {isReset ? 'Nova senha' : 'Senha'}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder={isReset ? 'Defina a nova senha' : 'Sua Senha'}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className={`w-full rounded-xl border px-3 py-3 pr-24 text-sm shadow-sm outline-none transition focus:ring-2 ${
                    fieldErrors.password ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-100'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-2 my-1 flex items-center rounded-lg px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {fieldErrors.password && <p className="text-xs font-semibold text-red-600">{fieldErrors.password}</p>}
              {(isRegister || isReset) && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                  <p className="text-[13px] font-semibold text-emerald-800">Regras da senha</p>
                  <ul className="mt-1 space-y-1">
                    {passwordChecklist.map((item) => (
                      <li key={item.key} className="flex items-center gap-2 text-xs font-semibold">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                            item.met
                              ? 'border-emerald-500 bg-emerald-100 text-emerald-700'
                              : 'border-gray-200 bg-white text-gray-400'
                          }`}
                        >
                          {item.met ? '✓' : '•'}
                        </span>
                        <span className={item.met ? 'text-emerald-700' : 'text-slate-500'}>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {isLogin && !isReset && (
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
            {isReset ? (resetStep === 1 ? 'Enviar código' : 'Redefinir senha') : isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <div className="mt-4 space-y-2 text-center text-sm text-slate-600">
          {!isReset && !isLogin && (
            <p>
              Já tem conta?{' '}
              <span
                className="cursor-pointer font-bold text-emerald-700 underline"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setFormData({ name: '', phone: '', password: '' });
                  setFieldErrors({ name: '', phone: '', password: '', resetCode: '' });
                }}
              >
                Fazer Login
              </span>
            </p>
          )}
          {isLogin && !isReset && (
            <p>
              Esqueceu a senha?{' '}
              <span
                className="cursor-pointer font-bold text-emerald-700 underline"
                onClick={() => {
                  setMode('reset');
                  setResetStep(1);
                  setResetCode('');
                  setDevResetCode('');
                  setError('');
                  setFieldErrors({ name: '', phone: '', password: '', resetCode: '' });
                }}
              >
                Redefinir senha
              </span>
            </p>
          )}
          {isReset && (
            <p>
              Lembrou a senha?{' '}
              <span
                className="cursor-pointer font-bold text-emerald-700 underline"
                onClick={() => {
                  setMode('login');
                  setResetStep(1);
                  setResetCode('');
                  setDevResetCode('');
                  setError('');
                  setFieldErrors({ name: '', phone: '', password: '', resetCode: '' });
                }}
              >
                Fazer Login
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;

import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../utils/api';
import './AuthPage.css';
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
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div>
            <p className="auth-subtitle">Panda Loterias</p>
            <h2 className="auth-title">{isLogin ? 'Acessar Conta' : 'Criar Nova Conta'}</h2>
          </div>
          <div className="auth-badge">
            Seguro
            <span className="auth-badge-dot" />
          </div>
        </div>

        <div className="auth-toggle">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError('');
            }}
            className={`auth-tab ${isLogin ? 'active' : ''}`}
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
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
          >
            Cadastrar
          </button>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="auth-field">
              <label htmlFor="name">Nome Completo</label>
              <input
                id="name"
                type="text"
                name="name"
                placeholder="Seu Nome Completo"
                value={formData.name}
                onChange={handleChange}
                required={!isLogin}
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="phone">Celular (WhatsApp)</label>
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
            />
          </div>

          {!isLogin && (
            <div className="auth-field">
              <label htmlFor="supcode">Código do Supervisor (opcional)</label>
              <input
                id="supcode"
                type="text"
                name="supervisorCode"
                placeholder="EX: ABC123"
                value={supervisorCode}
                onChange={(e) => setSupervisorCode(e.target.value.trim().toUpperCase())}
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="Sua Senha"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          {isLogin && (
            <label className="auth-remember">
              <input
                type="checkbox"
                id="saveAccess"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Salvar acesso neste dispositivo</span>
            </label>
          )}

          <button type="submit" className="auth-submit">
            {isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? 'Não tem conta? ' : 'Já tem conta? '}
          <span
            className="auth-link"
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

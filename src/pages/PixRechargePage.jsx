import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const PixRechargePage = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [cpf, setCpf] = useState('');
  const [amount, setAmount] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [copyCode, setCopyCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const fromStorage = (() => {
      if (typeof window === 'undefined') return null;
      const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
      try {
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    })();
    const currentCpf = user?.cpf || fromStorage?.cpf || '';
    setCpf(currentCpf);
  }, [user]);

  const sanitizeCpf = (value) => (value || '').replace(/\D/g, '').slice(0, 11);

  const handleGenerate = async () => {
    const cleanCpf = sanitizeCpf(cpf);
    const val = Number(amount);

    if (!cleanCpf || cleanCpf.length !== 11) {
      toast.error('CPF obrigatório (11 dígitos).');
      return;
    }

    if (!amount || Number.isNaN(val) || val <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    // Precisamos do nome e telefone para atualizar o perfil (API exige)
    const storedUser = (() => {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
      try {
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    const name = user?.name || storedUser?.name;
    const phone = user?.phone || storedUser?.phone;
    const email = user?.email || storedUser?.email;
    const birthDate = user?.birthDate || storedUser?.birthDate;

    if (!name || !phone) {
      toast.error('Complete nome e telefone na página Perfil antes de gerar o Pix.');
      return;
    }

    setLoading(true);
    try {
      // Atualiza CPF se mudou
      if (cleanCpf !== (user?.cpf || storedUser?.cpf || '')) {
        await api.put('/profile', {
          name,
          phone,
          cpf: cleanCpf,
          birthDate: birthDate || null,
          email: email || null,
        });
      }

      const res = await api.post('/pix/charge', { amount: val });
      setCopyCode(res.data?.copyAndPaste || '');
      setQrCode(res.data?.qrCode || '');
      toast.success('Cobrança Pix criada. Use o QR ou copie o código.');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Erro ao gerar Pix.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!copyCode) return;
    try {
      await navigator.clipboard.writeText(copyCode);
      toast.success('Código copia e cola copiado!');
    } catch {
      toast.info(copyCode);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-xl bg-white shadow-lg rounded-2xl p-6 space-y-4 border border-slate-100">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-emerald-700">Recarga Pix</h1>
          <button
            type="button"
            className="text-sm text-emerald-700 font-bold underline"
            onClick={() => navigate('/home')}
          >
            Voltar
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">CPF (obrigatório)</label>
          <input
            type="text"
            value={cpf}
            onChange={(e) => setCpf(sanitizeCpf(e.target.value))}
            maxLength={14}
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder="Somente números"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Valor a depositar (R$)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder="Ex: 20.00"
          />
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleGenerate}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-sm font-extrabold uppercase text-white shadow-xl transition hover:-translate-y-0.5 hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-60"
        >
          {loading ? 'Gerando...' : 'Gerar QR Code Pix'}
        </button>

        {copyCode ? (
          <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-emerald-800">Código copia e cola</span>
              <button
                type="button"
                onClick={copyToClipboard}
                className="text-xs font-bold text-emerald-700 underline"
              >
                Copiar
              </button>
            </div>
            <div className="text-xs text-emerald-900 break-all">{copyCode}</div>
          </div>
        ) : null}

        {qrCode ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">QR Code</span>
            <img src={`data:image/png;base64,${qrCode}`} alt="QR Code Pix" className="w-48 h-48 object-contain" />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PixRechargePage;

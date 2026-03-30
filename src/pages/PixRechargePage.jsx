import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { getStoredLoggedIn } from '../utils/authSession.mjs';
import { useAuth } from '../context/AuthContext';
import { EXPOSITIVE_DEPOSIT_MESSAGE, EXPOSITIVE_PLATFORM_ENABLED } from '../constants/expositoryMode';

const PixRechargePage = () => {
  const minDeposit = 10;
  const maxDeposit = 1500;
  const minDepositCents = minDeposit * 100;
  const maxDepositCents = maxDeposit * 100;
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const autoDepositBonusPercent = Number(user?.autoDepositBonusPercent ?? 15);
  const isFirstDepositBonusEligible = Boolean(user?.isFirstDepositBonusEligible ?? true);
  const [cpf, setCpf] = useState('');
  const [amount, setAmount] = useState('');
  const [amountCents, setAmountCents] = useState(0);
  const [qrCode, setQrCode] = useState('');
  const [copyCode, setCopyCode] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponInfo, setCouponInfo] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [appliedBonus, setAppliedBonus] = useState(0);
  const [bonusLabel, setBonusLabel] = useState('Bônus aplicado');
  const [watchingDeposit, setWatchingDeposit] = useState(false);
  const [depositDetected, setDepositDetected] = useState(false);
  const baselineRef = useRef(0);
  const pollRef = useRef(null);
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

  const handleValidateCoupon = async () => {
    if (EXPOSITIVE_PLATFORM_ENABLED) {
      toast.info(EXPOSITIVE_DEPOSIT_MESSAGE);
      return;
    }
    const code = String(couponCode || '').trim();
    const val = amountCents / 100;
    if (!code) {
      setCouponError('Informe um cupom para validar.');
      setCouponInfo(null);
      return;
    }
    setCouponError('');
    setCouponInfo(null);
    setValidatingCoupon(true);
    try {
      const payload = { code };
      if (amountCents && Number.isFinite(val) && val > 0) {
        payload.amount = val;
      }
      const res = await api.post('/pix/validate-coupon', payload);
      setCouponInfo(res.data || null);
    } catch (err) {
      const msg = err.response?.data?.error || 'Cupom inválido.';
      setCouponError(msg);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleGenerate = async () => {
    if (EXPOSITIVE_PLATFORM_ENABLED) {
      toast.info(EXPOSITIVE_DEPOSIT_MESSAGE);
      return;
    }
    const cleanCpf = sanitizeCpf(cpf);
    const val = amountCents / 100;

    if (!cleanCpf || cleanCpf.length !== 11) {
      toast.error('CPF obrigatório (11 dígitos).');
      return;
    }

    if (!amountCents || Number.isNaN(val) || val <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    if (minDepositCents > 0 && amountCents < minDepositCents) {
      const formattedMin = minDeposit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      toast.error(`Depósito mínimo é R$ ${formattedMin}.`);
      return;
    }
    if (amountCents > maxDepositCents) {
      const formatted = maxDeposit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      toast.error(`Valor máximo por depósito é R$ ${formatted}.`);
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
      setDepositDetected(false);
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

      const res = await api.post('/pix/charge', {
        amount: val,
        couponCode: couponCode || undefined,
        cpf: cleanCpf,
        nome: name,
        email,
      });
      // OpenPix/Woovi retornam brCode (copia e cola) e qrCodeImage (URL)
      setCopyCode(res.data?.brCode || '');
      setQrCode(res.data?.qrCodeImage || '');
      const bonusValue = res.data?.bonusAmount ?? res.data?.bonusPreview ?? 0;
      setAppliedBonus(bonusValue);
      if (res.data?.couponApplied) {
        setBonusLabel('Bônus do cupom estimado');
      } else {
        const percent = Number(res.data?.autoBonusPercent || autoDepositBonusPercent);
        setBonusLabel(`Bônus automático estimado (${percent}%)`);
      }
      // guarda baseline para detectar crédito (saldo + bônus)
      baselineRef.current = Number(user?.balance || 0) + Number(user?.bonus || 0);
      startPollingDeposit();
      toast.success('Cobrança Pix criada. Use o QR ou copie o código.');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Erro ao gerar Pix.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const startPollingDeposit = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!getStoredLoggedIn() && !user) {
      setWatchingDeposit(false);
      return;
    }
    setWatchingDeposit(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      if (attempts > 40) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setWatchingDeposit(false);
        return;
      }
      try {
        if (!getStoredLoggedIn() && !user) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setWatchingDeposit(false);
          return;
        }
        const res = await api.get('/wallet/me', { skipAuthRedirect: true });
        const total = Number(res.data?.balance || 0) + Number(res.data?.bonus || 0);
        if (total > baselineRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setWatchingDeposit(false);
          setDepositDetected(true);
          toast.success('Depósito Pix confirmado e bônus aplicado!');
          navigate('/home');
          refreshUser();
        }
      } catch {
        // ignora erros transitórios
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const copyToClipboard = async () => {
    if (!copyCode) return;
    try {
      await navigator.clipboard.writeText(copyCode);
      toast.success('Código copia e cola copiado!');
    } catch {
      toast.info(copyCode);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

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

        {EXPOSITIVE_PLATFORM_ENABLED ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {EXPOSITIVE_DEPOSIT_MESSAGE}
          </div>
        ) : null}

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

        <div className="space-y-1 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3">
          <p className="text-xs font-semibold text-emerald-800">Bônus padrão</p>
          <p className="text-xs text-emerald-700">
            {isFirstDepositBonusEligible
              ? 'Novo usuário: seu primeiro depósito recebe 15% automaticamente.'
              : 'Usuário com depósito anterior: seus depósitos recebem 10% automaticamente.'}
            {' '}
            Se não usar cupom, o bônus automático entra sozinho após a confirmação do Pix.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Cupom (opcional)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Ex: BEMVINDO10"
            />
            <button
              type="button"
              disabled={validatingCoupon || EXPOSITIVE_PLATFORM_ENABLED}
              onClick={handleValidateCoupon}
              className="whitespace-nowrap rounded-xl border border-emerald-200 px-3 py-3 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60"
            >
              {validatingCoupon ? 'Validando...' : 'Validar'}
            </button>
          </div>
          {couponError ? (
            <p className="text-xs text-red-600">{couponError}</p>
          ) : null}
          {couponInfo?.valid ? (
            <p className="text-xs text-emerald-700">
              {couponInfo.bonusPreview
                ? `Cupom válido. Bônus estimado: R$ ${String(couponInfo.bonusPreview).replace('.', ',')}`
                : 'Cupom válido. Informe um valor para calcular o bônus.'}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Valor a depositar (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 7); // até 9999,99
              const cents = digits ? parseInt(digits, 10) : 0;
              setAmountCents(cents);
              const formatted = (cents / 100).toFixed(2).replace('.', ',');
              setAmount(formatted);
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder="Ex: 20,00"
          />
          <p className="text-xs text-slate-500">
            Máximo R$ {maxDeposit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por transação.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || EXPOSITIVE_PLATFORM_ENABLED}
          onClick={handleGenerate}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-sm font-extrabold uppercase text-white shadow-xl transition hover:-translate-y-0.5 hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-60"
      >
        {loading ? 'Gerando...' : EXPOSITIVE_PLATFORM_ENABLED ? 'Depósito indisponível' : 'Gerar QR Code Pix'}
      </button>

      {Number(appliedBonus) > 0 && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
          {bonusLabel}: R$ {Number(appliedBonus).toFixed(2).replace('.', ',')} (será creditado como bônus)
        </div>
      )}

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
            {/* OpenPix retorna URL da imagem, usa src direto */}
            <img src={qrCode} alt="QR Code Pix" className="w-48 h-48 object-contain" />
          </div>
        ) : null}
      </div>

      {watchingDeposit && (
        <div className="mt-4 w-full max-w-xl rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm animate-pulse">
          Aguardando confirmação do Pix... isso costuma levar poucos segundos.
        </div>
      )}
      {depositDetected && (
        <div className="mt-4 w-full max-w-xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-md">
          🎉 Depósito reconhecido! Seu saldo e bônus foram atualizados.
        </div>
      )}
    </div>
  );
};

export default PixRechargePage;

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaShareAlt } from 'react-icons/fa';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';

const BalanceReportPage = () => {
  const navigate = useNavigate();
  const { balance, loadingUser, authError, refreshUser } = useAuth();

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const formatCurrency = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

  const today = new Date();
  const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const share = async () => {
    const text = `CONSULTA SALDO\n${formattedDate}\nT.VENDAS: 0,00\nCOMISSAO: 0,00\nMANDOU: 0,00 (+)\nRECEBEU: 0,00 (-)\nSALDO ANT: ${formatCurrency(balance)} (+)\nHAVER: ${formatCurrency(balance)} (+)`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch (err) {
        // silêncio, usuário cancelou
      }
    } else {
      navigator.clipboard?.writeText(text);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-sky-100 px-4 py-8">
      <div className="flex w-full max-w-[520px] flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 text-emerald-800 shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="text-lg font-extrabold">CONSULTA SALDO</span>
          <span className="text-xs font-semibold text-slate-500">{formattedDate}</span>
        </div>

        {loadingUser ? (
          <div className="flex justify-center py-2">
            <Spinner size={32} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm font-bold">
              <span>T.VENDAS:</span>
              <span>0,00</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold">
              <span>COMISSAO:</span>
              <span>0,00</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold">
              <span>MANDOU:</span>
              <span>0,00 (+)</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold">
              <span>RECEBEU:</span>
              <span>0,00 (-)</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold">
              <span>SALDO ANT:</span>
              <span>{formatCurrency(balance)} (+)</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold">
              <span>HAVER:</span>
              <span>{formatCurrency(balance)} (+)</span>
            </div>
            {authError && <div className="text-xs font-semibold text-red-600">{authError}</div>}
          </>
        )}

        <div className="mt-3 flex gap-3">
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg transition hover:from-emerald-800 hover:to-emerald-700"
            onClick={share}
          >
            <FaShareAlt /> Compartilhar
          </button>
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-extrabold text-emerald-800 shadow transition hover:-translate-y-0.5 hover:shadow-md"
            onClick={() => navigate('/home')}
          >
            <FaArrowLeft /> Voltar ao início
          </button>
        </div>
      </div>
    </div>
  );
};

export default BalanceReportPage;

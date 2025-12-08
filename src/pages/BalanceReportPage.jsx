import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaShareAlt } from 'react-icons/fa';
import api from '../utils/api';
import Spinner from '../components/Spinner';
import { toast } from 'react-toastify';
import './BalanceReportPage.css';

const BalanceReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBalance = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/wallet/me');
        setBalance(res.data.balance ?? 0);
      } catch (err) {
        const message = err.response?.data?.error || 'Erro ao carregar saldo.';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    fetchBalance();
  }, []);

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
    <div className="balance-page">
      <div className="balance-card">
        <div className="balance-header">
          <span className="balance-title">CONSULTA SALDO</span>
          <span className="balance-date">{formattedDate}</span>
        </div>

        {loading ? (
          <div className="balance-loading">
            <Spinner size={32} />
          </div>
        ) : (
          <>
            <div className="balance-row">
              <span>T.VENDAS:</span>
              <span>0,00</span>
            </div>
            <div className="balance-row">
              <span>COMISSAO:</span>
              <span>0,00</span>
            </div>
            <div className="balance-row">
              <span>MANDOU:</span>
              <span>0,00 (+)</span>
            </div>
            <div className="balance-row">
              <span>RECEBEU:</span>
              <span>0,00 (-)</span>
            </div>
            <div className="balance-row">
              <span>SALDO ANT:</span>
              <span>{formatCurrency(balance)} (+)</span>
            </div>
            <div className="balance-row">
              <span>HAVER:</span>
              <span>{formatCurrency(balance)} (+)</span>
            </div>
            {error && <div className="balance-error">{error}</div>}
          </>
        )}

        <div className="balance-actions">
          <button className="balance-btn primary" onClick={share}>
            <FaShareAlt /> Compartilhar
          </button>
          <button className="balance-btn secondary" onClick={() => navigate('/home')}>
            <FaArrowLeft /> Voltar ao início
          </button>
        </div>
      </div>
    </div>
  );
};

export default BalanceReportPage;

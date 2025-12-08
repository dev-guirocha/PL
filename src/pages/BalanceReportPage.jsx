import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaShareAlt } from 'react-icons/fa';
import api from '../utils/api';
import Spinner from '../components/Spinner';
import { toast } from 'react-toastify';

const BalanceReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState('');
  const styles = {
    container: {
      minHeight: '100vh',
      background: '#f9fafb',
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      gap: '16px',
    },
    card: {
      width: '100%',
      maxWidth: '480px',
      background: '#fff',
      borderRadius: '14px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      color: '#166534',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: { fontWeight: 'bold', fontSize: '18px' },
    date: { color: '#4b5563', fontSize: '14px' },
    row: {
      display: 'flex',
      justifyContent: 'space-between',
      fontWeight: 'bold',
      color: '#166534',
    },
    muted: { color: '#6b7280', fontSize: '13px', fontWeight: 'normal' },
    actions: {
      display: 'flex',
      gap: '10px',
      marginTop: '12px',
    },
    buttonPrimary: {
      flex: 1,
      padding: '10px',
      borderRadius: '10px',
      border: 'none',
      background: '#166534',
      color: '#fff',
      fontWeight: 'bold',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    },
    buttonSecondary: {
      flex: 1,
      padding: '10px',
      borderRadius: '10px',
      border: '1px solid #d1d5db',
      background: '#fff',
      color: '#166534',
      fontWeight: 'bold',
      cursor: 'pointer',
    },
  };

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
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.title}>CONSULTA SALDO</span>
          <span style={styles.date}>{formattedDate}</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
            <Spinner size={32} />
          </div>
        ) : (
          <>
            <div style={styles.row}>
              <span>T.VENDAS:</span>
              <span>0,00</span>
            </div>
            <div style={styles.row}>
              <span>COMISSAO:</span>
              <span>0,00</span>
            </div>
            <div style={styles.row}>
              <span>MANDOU:</span>
              <span>0,00 (+)</span>
            </div>
            <div style={styles.row}>
              <span>RECEBEU:</span>
              <span>0,00 (-)</span>
            </div>
            <div style={styles.row}>
              <span>SALDO ANT:</span>
              <span>{formatCurrency(balance)} (+)</span>
            </div>
            <div style={styles.row}>
              <span>HAVER:</span>
              <span>{formatCurrency(balance)} (+)</span>
            </div>
            {error && <div style={{ color: 'red', fontSize: '13px' }}>{error}</div>}
          </>
        )}

        <div style={styles.actions}>
          <button style={styles.buttonPrimary} onClick={share}>
            <FaShareAlt /> Compartilhar
          </button>
          <button style={styles.buttonSecondary} onClick={() => navigate('/home')}>
            <FaArrowLeft /> Voltar ao início
          </button>
        </div>
      </div>
    </div>
  );
};

export default BalanceReportPage;

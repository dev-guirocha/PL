import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import axios from 'axios';
import { getHistory } from '../utils/receipt';

const PulesPage = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [balance, setBalance] = useState(null);
  const [showBalance, setShowBalance] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const api = axios.create({
    baseURL: import.meta?.env?.VITE_API_BASE_URL || '/api',
  });

  useEffect(() => {
    setHistory(getHistory());
    const fetchBalance = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
          setError('Faça login para ver o saldo.');
          setLoading(false);
          return;
        }
        const res = await api.get('/wallet/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setBalance(res.data.balance ?? 0);
      } catch (err) {
        setError(err.response?.data?.error || 'Erro ao carregar saldo.');
      } finally {
        setLoading(false);
      }
    };
    fetchBalance();
  }, []);

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
    navbar: {
      width: '100%',
      background: '#bbf7d0',
      border: '1px solid #9ed8b6',
      borderRadius: '12px',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
      gap: '10px',
    },
    brand: { fontWeight: 'bold', color: '#166534', flex: 1 },
    saldo: {
      fontWeight: 'bold',
      color: '#166534',
      textAlign: 'center',
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    },
    backWrapper: { flex: 1, display: 'flex', justifyContent: 'flex-end' },
    backButton: {
      background: '#166534',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      padding: '8px 12px',
      cursor: 'pointer',
      fontWeight: 'bold',
    },
    list: {
      width: '100%',
      maxWidth: '620px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    card: {
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      padding: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      color: '#166534',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    totalRow: {
      display: 'flex',
      justifyContent: 'space-between',
      fontWeight: 'bold',
      color: '#166534',
      fontSize: '15px',
    },
    chips: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
    chip: {
      padding: '6px 10px',
      background: '#dcfce7',
      borderRadius: '999px',
      border: '1px solid #9ed8b6',
      color: '#166534',
      fontWeight: 'bold',
      fontSize: '12px',
    },
    actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    actionBtn: {
      padding: '10px 12px',
      borderRadius: '10px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: 'bold',
    },
    primary: { background: '#166534', color: '#fff' },
    secondary: { background: '#e5e7eb', color: '#111827' },
  };

  return (
    <div style={styles.container}>
      <div style={styles.navbar}>
        <span style={styles.brand}>Pandas PULES</span>
        <span style={styles.saldo}>
          {loading
            ? 'Carregando...'
            : `Saldo: ${
                showBalance ? `R$ ${(balance ?? 0).toFixed(2).replace('.', ',')}` : '••••'
              }`}
          {!loading && (
            <span onClick={() => setShowBalance((prev) => !prev)} style={{ cursor: 'pointer' }}>
              {showBalance ? <FaEyeSlash /> : <FaEye />}
            </span>
          )}
        </span>
        <div style={styles.backWrapper}>
          <button style={styles.backButton} onClick={() => navigate('/home')}>
            Voltar
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      <div style={styles.list}>
        {history.length === 0 && <div style={{ color: '#6b7280' }}>Nenhum PULE salvo.</div>}
        {history.map((pule, idx) => (
          <div key={idx} style={styles.card}>
            <div style={styles.totalRow}>
              <span>{pule.loteria || 'Loteria'}</span>
              <span>{new Date(pule.criadoEm).toLocaleString('pt-BR')}</span>
            </div>
            {pule.horario && <span>Horário: {pule.horario}</span>}
            {(pule.apostas || []).map((ap, i) => (
              <div key={i} style={{ borderTop: '1px dashed #9ed8b6', paddingTop: '6px' }}>
                <div style={styles.totalRow}>
                  <span>{ap.modalidade || ap.jogo || 'Aposta'}</span>
                  <span>{ap.data || ''}</span>
                </div>
                {ap.colocacao && <span>Prêmio: {ap.colocacao}</span>}
                <span>Qtd palpites: {ap.palpites?.length || 0}</span>
                {ap.palpites?.length ? (
                  <div style={styles.chips}>
                    {ap.palpites.map((n, j) => (
                      <span key={`${n}-${j}`} style={styles.chip}>
                        {n}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div style={styles.totalRow}>
                  <span>Valor por número:</span>
                  <span>R$ {(ap.valorPorNumero || 0).toFixed(2).replace('.', ',')}</span>
                </div>
                <div style={styles.totalRow}>
                  <span>Valor da aposta:</span>
                  <span>R$ {(ap.total || 0).toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            ))}
            <div style={styles.totalRow}>
              <span>Total:</span>
              <span>R$ {(pule.total || 0).toFixed(2).replace('.', ',')}</span>
            </div>
            <div style={styles.actions}>
              <button
                style={{ ...styles.actionBtn, ...styles.secondary }}
                onClick={() => window.print()}
              >
                Baixar PULE (PDF)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PulesPage;

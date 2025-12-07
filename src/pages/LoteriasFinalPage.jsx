import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { getDraft, clearDraft, appendToHistory } from '../utils/receipt';

const LoteriasFinalPage = () => {
  const navigate = useNavigate();
  const [draft, setDraft] = useState({});
  const [balance, setBalance] = useState(null);
  const [showBalance, setShowBalance] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const api = axios.create({
    baseURL: import.meta?.env?.VITE_API_BASE_URL || '/api',
  });

  useEffect(() => {
    setDraft(getDraft());
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

  const total = useMemo(() => {
    const apostas = draft?.apostas || [];
    return apostas.reduce((sum, ap) => sum + (ap.total || 0), 0);
  }, [draft]);

  const valorPorNumero = useMemo(() => {
    const apostas = draft?.apostas || [];
    if (!apostas.length) return 0;
    // mostra do último item como referência
    const last = apostas[apostas.length - 1];
    return last?.valorPorNumero || 0;
  }, [draft]);

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
    card: {
      width: '100%',
      maxWidth: '520px',
      background: '#fff',
      borderRadius: '14px',
      boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    title: { fontWeight: 'bold', color: '#166534', fontSize: '19px' },
    summary: {
      background: '#f0fdf4',
      border: '1px solid #9ed8b6',
      borderRadius: '12px',
      padding: '12px',
      color: '#166534',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      fontSize: '14px',
    },
    chipRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
    },
    chip: {
      padding: '8px 12px',
      background: '#dcfce7',
      borderRadius: '999px',
      color: '#166534',
      fontWeight: 'bold',
      border: '1px solid #9ed8b6',
    },
    totalRow: {
      display: 'flex',
      justifyContent: 'space-between',
      fontWeight: 'bold',
      color: '#166534',
      fontSize: '16px',
    },
    actions: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
    },
    actionBtn: {
      flex: 1,
      minWidth: '140px',
      padding: '12px',
      borderRadius: '10px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: 'bold',
    },
    primary: { background: '#166534', color: '#fff' },
    secondary: { background: '#e5e7eb', color: '#111827' },
    message: { color: '#dc2626', fontWeight: 'bold' },
    success: { color: '#166534', fontWeight: 'bold' },
  };

  return (
    <div style={styles.container}>
      <div style={styles.navbar}>
        <span style={styles.brand}>Panda Loterias</span>
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
          <button style={styles.backButton} onClick={() => navigate('/loterias-sorteios')}>
            Voltar
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      <div style={styles.card}>
        <div style={styles.title}>Conferência final</div>
        <div style={styles.summary}>
          {draft?.loteria && <span>Loteria: {draft.loteria}</span>}
          {draft?.codigoHorario && <span>Horário: {draft.codigoHorario}</span>}
          {draft?.apostas?.map((ap, idx) => (
            <div key={idx} style={{ borderTop: '1px dashed #9ed8b6', paddingTop: '8px' }}>
              <div style={styles.totalRow}>
                <span>{ap.jogo}</span>
                <span>{ap.data}</span>
              </div>
              {ap.modalidade && <span>Modalidade: {ap.modalidade}</span>}
              {ap.colocacao && <span>Prêmio: {ap.colocacao}</span>}
              <span>Qtd palpites: {ap.palpites?.length || 0}</span>
              {ap?.palpites?.length ? (
                <div style={styles.chipRow}>
                  {ap.palpites.map((p, i) => (
                    <span key={`${p}-${i}`} style={styles.chip}>
                      {p}
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
            <span>Valor total a pagar:</span>
            <span>R$ {total.toFixed(2).replace('.', ',')}</span>
          </div>
          {valorPorNumero ? (
            <div style={{ color: '#166534', fontSize: '13px' }}>
              Valor por número (última aposta): R$ {valorPorNumero.toFixed(2).replace('.', ',')}
            </div>
          ) : null}
        </div>

        {message && <div style={styles.message}>{message}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <div style={styles.actions}>
          <button
            style={{ ...styles.actionBtn, ...styles.secondary }}
            onClick={() => navigate('/loterias-sorteios')}
          >
            Voltar às apostas
          </button>
          <button
            style={{ ...styles.actionBtn, ...styles.primary }}
            onClick={async () => {
              const token = localStorage.getItem('token') || sessionStorage.getItem('token');
              if (!token) {
                setMessage('Faça login para finalizar.');
                return;
              }
              try {
                const res = await api.post(
                  '/wallet/debit',
                  { amount: total },
                  { headers: { Authorization: `Bearer ${token}` } },
                );
                appendToHistory({
                  criadoEm: new Date().toISOString(),
                  loteria: draft?.loteria,
                  horario: draft?.codigoHorario,
                  apostas: draft?.apostas || [],
                  total,
                });
                setBalance(res.data?.balance ?? balance);
                setSuccess('Aposta realizada com sucesso! PULE salvo no histórico.');
                setMessage('');
                clearDraft();
                setTimeout(() => navigate('/home'), 800);
              } catch (err) {
                const msg = err.response?.data?.error || 'Erro ao debitar.';
                setMessage(msg);
              }
            }}
          >
            Finalizar
          </button>
        </div>

        <button
          style={{ ...styles.actionBtn, ...styles.secondary, width: '100%' }}
          onClick={() => window.print()}
        >
          Baixar PULE (PDF)
        </button>
      </div>
    </div>
  );
};

export default LoteriasFinalPage;

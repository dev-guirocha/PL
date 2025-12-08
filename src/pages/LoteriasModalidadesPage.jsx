import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import api from '../utils/api';
import Spinner from '../components/Spinner';
import { toast } from 'react-toastify';
import { getDraft, updateDraft } from '../utils/receipt';
import { MODALIDADES, CAN_CHOOSE_COLOCACAO, DIRECT_TO_PALPITES } from '../constants/games';

const LoteriasModalidadesPage = () => {
  const navigate = useNavigate();
  const { jogo } = useParams();
  const [draft, setDraft] = useState({});
  const [balance, setBalance] = useState(null);
  const [showBalance, setShowBalance] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDraft(getDraft());
    const fetchBalance = async () => {
      setLoading(true);
      setError('');
      try {
        const loggedIn = localStorage.getItem('loggedIn') || sessionStorage.getItem('loggedIn');
        if (!loggedIn) {
          setError('Faça login para ver o saldo.');
          setLoading(false);
          return;
        }
        const res = await api.get('/wallet/me');
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
    subtitle: { color: '#6b7280', fontSize: '14px' },
    list: { display: 'flex', flexDirection: 'column', gap: '10px' },
    item: {
      padding: '12px',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      background: '#fff',
      cursor: 'pointer',
      fontWeight: 'bold',
      color: '#166534',
      textAlign: 'left',
      fontSize: '15px',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.navbar}>
        <span style={styles.brand}>Panda Loterias</span>
        <span style={styles.saldo}>
          {loading ? (
            <Spinner size={18} />
          ) : (
            `Saldo: ${showBalance ? `R$ ${(balance ?? 0).toFixed(2).replace('.', ',')}` : '••••'}`
          )}
          {!loading && (
            <span onClick={() => setShowBalance((prev) => !prev)} style={{ cursor: 'pointer' }}>
              {showBalance ? <FaEyeSlash /> : <FaEye />}
            </span>
          )}
        </span>
        <div style={styles.backWrapper}>
          <button style={styles.backButton} onClick={() => navigate(`/loterias/${jogo}`)}>
            Voltar
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      <div style={styles.card}>
        <div style={styles.title}>Modalidades</div>
        {draft?.jogo && draft?.data && (
          <div style={styles.subtitle}>
            Jogo: {draft.jogo} • Data: {draft.data}
          </div>
        )}
        <div style={styles.subtitle}>Escolha uma modalidade (válida para Tradicional, Tradicional 1/10 e Uruguaia).</div>
        <div style={styles.list}>
          {MODALIDADES.map((m) => (
            <button
              key={m}
              style={styles.item}
              onClick={() => {
                updateDraft({ modalidade: m });
                if (CAN_CHOOSE_COLOCACAO.includes(m.toUpperCase())) {
                  navigate(`/loterias/${jogo}/colocacao`);
                } else if (DIRECT_TO_PALPITES.includes(m.toUpperCase())) {
                  navigate(`/loterias/${jogo}/palpites`);
                } else {
                  toast.success(`Modalidade selecionada: ${m} (recibo atualizado).`);
                }
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoteriasModalidadesPage;

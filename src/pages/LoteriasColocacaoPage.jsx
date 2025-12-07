import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { getDraft, updateDraft } from '../utils/receipt';

const colocacoes = [
  '1 PREMIO (MAIOR PREMIO)',
  '1/5 (5x MAIS CHANCES)',
  '1 E 1/5 PREMIO',
  '1/2 PREMIO',
  '1/3 PREMIO',
  '1/4 PREMIO',
  '1/5 PREMIO',
  '2/3 PREMIO',
  '2/4 PREMIO',
  '2/5 PREMIO',
  '3/4 PREMIO',
  '3/5 PREMIO',
  '4/5 PREMIO',
];

const LoteriasColocacaoPage = () => {
  const navigate = useNavigate();
  const { jogo } = useParams();
  const [draft, setDraft] = useState({});
  const [balance, setBalance] = useState(null);
  const [showBalance, setShowBalance] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
          <button style={styles.backButton} onClick={() => navigate(`/loterias/${jogo}/modalidades`)}>
            Voltar
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      <div style={styles.card}>
        <div style={styles.title}>Colocação</div>
        {draft?.jogo && draft?.data && draft?.modalidade && (
          <div style={styles.subtitle}>
            Jogo: {draft.jogo} • Data: {draft.data} • Modalidade: {draft.modalidade}
          </div>
        )}
        <div style={styles.subtitle}>
          Escolha a colocação válida para Centena, Centena Inv, Unidade, Dezena, Grupo.
        </div>
        <div style={styles.list}>
          {colocacoes.map((c) => (
            <button
              key={c}
              style={styles.item}
              onClick={() => {
                updateDraft({ colocacao: c });
                navigate(`/loterias/${jogo}/palpites`);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoteriasColocacaoPage;

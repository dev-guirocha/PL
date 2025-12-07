import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { getDraft, updateDraft } from '../utils/receipt';

const LoteriasPalpitesPage = () => {
  const navigate = useNavigate();
  const { jogo } = useParams();
  const [draft, setDraft] = useState({});
  const [balance, setBalance] = useState(null);
  const [showBalance, setShowBalance] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [palpite, setPalpite] = useState('');
  const [palpites, setPalpites] = useState([]);
  const isCentena = (draft?.modalidade || '').toUpperCase().includes('CENTENA');

  const api = axios.create({
    baseURL: import.meta?.env?.VITE_API_BASE_URL || '/api',
  });

  useEffect(() => {
    const d = getDraft();
    setDraft(d);
    if (Array.isArray(d?.palpites)) setPalpites(d.palpites);
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
    placeholder: {
      padding: '12px',
      background: '#f0fdf4',
      border: '1px dashed #9ed8b6',
      borderRadius: '12px',
      color: '#166534',
      fontWeight: 'bold',
      textAlign: 'center',
    },
    inputRow: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    input: {
      flex: 1,
      minWidth: '120px',
      padding: '10px',
      borderRadius: '10px',
      border: '1px solid #d1d5db',
      fontSize: '16px',
      letterSpacing: '2px',
      textAlign: 'center',
    },
    addButton: {
      padding: '10px 14px',
      background: '#166534',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontWeight: 'bold',
    },
    chips: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
    },
    chip: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 12px',
      background: '#dcfce7',
      borderRadius: '999px',
      color: '#166534',
      fontWeight: 'bold',
      border: '1px solid #9ed8b6',
      cursor: 'pointer',
    },
  };

  const addPalpite = () => {
    const clean = palpite.replace(/\D/g, '');
    if (!isCentena) {
      alert('Modalidade atual não está configurada para palpites.');
      return;
    }
    if (clean.length !== 3) {
      alert('Para centena, digite exatamente 3 números.');
      return;
    }
    const updated = [...palpites, clean];
    setPalpites(updated);
    updateDraft({ palpites: updated });
    setPalpite('');
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
        <div style={styles.title}>Palpites</div>
        {draft?.jogo && draft?.data && draft?.modalidade && (
          <div style={styles.subtitle}>
            Jogo: {draft.jogo} • Data: {draft.data} • Modalidade: {draft.modalidade}
          </div>
        )}
        {draft?.colocacao && (
          <div style={styles.subtitle}>Colocação: {draft.colocacao}</div>
        )}
        {isCentena ? (
          <>
            <div style={styles.subtitle}>Digite sua centena (3 números).</div>
            <div style={styles.inputRow}>
              <input
                style={styles.input}
                maxLength={3}
                value={palpite}
                onChange={(e) => setPalpite(e.target.value)}
                placeholder="000"
              />
              <button style={styles.addButton} onClick={addPalpite}>
                Adicionar
              </button>
            </div>
            <div style={styles.subtitle}>Palpites adicionados:</div>
            <div style={styles.chips}>
              {palpites.length === 0 && <span style={styles.subtitle}>Nenhum palpite ainda.</span>}
              {palpites.map((p, idx) => (
                <span
                  key={`${p}-${idx}`}
                  style={styles.chip}
                  onClick={() => {
                    const next = palpites.filter((_, i) => i !== idx);
                    setPalpites(next);
                    updateDraft({ palpites: next });
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
            <button
              style={styles.addButton}
              onClick={() => {
                updateDraft({ palpites });
                navigate(`/loterias/${jogo}/valor`);
              }}
            >
              Avançar
            </button>
          </>
        ) : (
          <div style={styles.placeholder}>
            Modalidade ainda não configurada para palpites. Selecione uma centena.
          </div>
        )}
      </div>
    </div>
  );
};

export default LoteriasPalpitesPage;

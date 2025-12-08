import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import api from '../utils/api';
import Spinner from '../components/Spinner';
import { toast } from 'react-toastify';
import { getDraft, updateDraft } from '../utils/receipt';

const quickAdds = [5, 20, 50, 100];

const LoteriasValorPage = () => {
  const navigate = useNavigate();
  const { jogo } = useParams();
  const [draft, setDraft] = useState({});
  const [balance, setBalance] = useState(null);
  const [showBalance, setShowBalance] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [valor, setValor] = useState('');
  const [modoValor, setModoValor] = useState('todos'); // 'todos' ou 'cada'

  useEffect(() => {
    const d = getDraft();
    setDraft(d);
    if (d?.valorAposta) setValor(String(d.valorAposta));
    if (d?.modoValor) setModoValor(d.modoValor);
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
        const message = err.response?.data?.error || 'Erro ao carregar saldo.';
        setError(message);
        toast.error(message);
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
    summary: {
      background: '#f0fdf4',
      border: '1px solid #9ed8b6',
      borderRadius: '12px',
      padding: '12px',
      color: '#166534',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      fontSize: '14px',
    },
    inputRow: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    input: {
      flex: 1,
      minWidth: '140px',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid #d1d5db',
      fontSize: '16px',
    },
    quickRow: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
    },
    quickBtn: {
      padding: '10px 12px',
      background: '#dcfce7',
      border: '1px solid #9ed8b6',
      borderRadius: '10px',
      color: '#166534',
      fontWeight: 'bold',
      cursor: 'pointer',
    },
    toggleRow: {
      display: 'flex',
      gap: '10px',
      marginTop: '4px',
    },
    toggleBtn: (active) => ({
      flex: 1,
      padding: '10px',
      borderRadius: '10px',
      border: active ? '2px solid #166534' : '1px solid #d1d5db',
      background: active ? '#dcfce7' : '#fff',
      color: '#166534',
      fontWeight: 'bold',
      cursor: 'pointer',
      textAlign: 'center',
    }),
    action: {
      padding: '13px',
      background: '#166534',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontWeight: 'bold',
      marginTop: '8px',
      fontSize: '15px',
    },
  };

  const parsedValor = Number(valor) || 0;

  const addQuick = (n) => {
    const current = Number(valor) || 0;
    const next = current + n;
    setValor(String(next));
    updateDraft({ valorAposta: next, modoValor });
  };

  const handleContinue = () => {
    updateDraft({ valorAposta: parsedValor, modoValor, currentSaved: false });
    navigate(`/loterias/${jogo}/resumo`);
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
          <button style={styles.backButton} onClick={() => navigate(`/loterias/${jogo}/palpites`)}>
            Voltar
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      <div style={styles.card}>
        <div style={styles.title}>Valor da aposta</div>
        <div style={styles.summary}>
          {draft?.jogo && <span>Jogo: {draft.jogo}</span>}
          {draft?.data && <span>Data: {draft.data}</span>}
          {draft?.modalidade && <span>Modalidade: {draft.modalidade}</span>}
          {draft?.colocacao && <span>Colocação: {draft.colocacao}</span>}
          <span>Palpites: {draft?.palpites?.length || 0}</span>
          {draft?.palpites?.length ? (
            <span>Meus palpites: {draft.palpites.join(', ')}</span>
          ) : null}
        </div>

        <div style={styles.subtitle}>Digite o valor ou use os atalhos.</div>
        <div style={styles.inputRow}>
          <input
            style={styles.input}
            type="number"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
          />
        </div>

        <div style={styles.quickRow}>
          {quickAdds.map((q) => (
            <button key={q} style={styles.quickBtn} onClick={() => addQuick(q)}>
              +{q}
            </button>
          ))}
        </div>

        <div style={styles.subtitle}>Aplicar valor em:</div>
        <div style={styles.toggleRow}>
          <button
            style={styles.toggleBtn(modoValor === 'todos')}
            onClick={() => {
              setModoValor('todos');
              updateDraft({ modoValor: 'todos', valorAposta: parsedValor });
            }}
          >
            Todos
          </button>
          <button
            style={styles.toggleBtn(modoValor === 'cada')}
            onClick={() => {
              setModoValor('cada');
              updateDraft({ modoValor: 'cada', valorAposta: parsedValor });
            }}
          >
            Cada
          </button>
        </div>

        <button style={styles.action} onClick={handleContinue}>
          Avançar
        </button>
      </div>
    </div>
  );
};

export default LoteriasValorPage;

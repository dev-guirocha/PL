import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Spinner from '../components/Spinner';
import { getDraft, updateDraft } from '../utils/receipt';
import { GAME_NAMES } from '../constants/games';
import { useAuth } from '../context/AuthContext';

const LoteriasDatePage = () => {
  const navigate = useNavigate();
  const { jogo } = useParams();
  const gameTitle = GAME_NAMES[jogo] || 'Loteria';

  const { balance, loadingUser, refreshUser, authError } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [draft, setDraft] = useState({});

  const days = useMemo(() => {
    const arr = [];
    const today = new Date();
    for (let i = 0; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      arr.push({
        label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        value: d.toISOString().slice(0, 10),
      });
    }
    return arr;
  }, []);

  useEffect(() => {
    if (days.length) setSelectedDate(days[0].value);
  }, [days]);

  useEffect(() => {
    refreshUser();
    setDraft(getDraft());
  }, [refreshUser]); // eslint-disable-line react-hooks/exhaustive-deps

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
      maxWidth: '480px',
      background: '#fff',
      borderRadius: '14px',
      boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    title: { fontWeight: 'bold', color: '#166534', fontSize: '19px' },
    daysGrid: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    dayBtn: (active) => ({
      padding: '14px',
      borderRadius: '12px',
      border: active ? '2px solid #166534' : '1px solid #e5e7eb',
      background: active ? '#dcfce7' : '#fff',
      color: '#166534',
      cursor: 'pointer',
      textAlign: 'left',
      fontWeight: 'bold',
      fontSize: '15px',
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

  return (
    <div style={styles.container}>
      <div style={styles.navbar}>
        <span style={styles.brand}>Panda Loterias</span>
        <span style={styles.saldo}>
          {loadingUser ? (
            <Spinner size={18} />
          ) : (
            `Saldo: ${showBalance ? `R$ ${(balance ?? 0).toFixed(2).replace('.', ',')}` : '••••'}`
          )}
          {!loadingUser && (
            <span onClick={() => setShowBalance((prev) => !prev)} style={{ cursor: 'pointer' }}>
              {showBalance ? <FaEyeSlash /> : <FaEye />}
            </span>
          )}
        </span>
        <div style={styles.backWrapper}>
          <button style={styles.backButton} onClick={() => navigate('/loterias')}>
            Voltar
          </button>
        </div>
      </div>

      {authError && <div style={{ color: 'red' }}>{authError}</div>}

      <div style={styles.card}>
        <div style={styles.title}>{gameTitle}</div>
        <div style={{ color: '#6b7280', fontSize: '13px' }}>
          Escolha uma data (hoje ou até 7 dias à frente). A lista é atualizada diariamente.
        </div>
        {draft?.jogo && (
          <div style={{ color: '#166534', fontSize: '13px', fontWeight: 'bold' }}>
            Jogo selecionado: {draft.jogo}
          </div>
        )}
        <div style={styles.daysGrid}>
          {days.map((d) => (
            <button
              key={d.value}
              style={styles.dayBtn(selectedDate === d.value)}
              onClick={() => setSelectedDate(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <button
          style={styles.action}
          onClick={() => {
            updateDraft({ data: selectedDate, jogo: gameTitle, slug: `/loterias/${jogo}` });
            const allowed = ['tradicional', 'tradicional-1-10', 'uruguaia'];
            if (allowed.includes(jogo)) {
              navigate(`/loterias/${jogo}/modalidades`);
            } else {
              navigate('/loterias');
            }
          }}
        >
          Continuar
        </button>
      </div>
    </div>
  );
};

export default LoteriasDatePage;

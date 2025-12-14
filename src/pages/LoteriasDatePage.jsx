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
    for (let i = 0; i <= 2; i++) {
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
      padding: '12px 20px 40px',
      gap: '16px',
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
      <div style={{ alignSelf: 'flex-start' }}>
        <button
          style={{
            background: '#166534',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '8px 12px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
          onClick={() => navigate('/loterias')}
        >
          Voltar
        </button>
      </div>

      {authError && <div style={{ color: 'red' }}>{authError}</div>}

      <div style={styles.card}>
        <div style={styles.title}>{gameTitle}</div>
        <div style={{ color: '#6b7280', fontSize: '13px' }}>Escolha uma data (hoje ou até 2 dias à frente).</div>
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
            if (jogo === 'quininha') {
              navigate('/loterias/quininha/jogar');
              return;
            }
            if (jogo === 'seninha') {
              navigate('/loterias/seninha/jogar');
              return;
            }
            if (jogo === 'super15') {
              navigate('/loterias/super15/jogar');
              return;
            }
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

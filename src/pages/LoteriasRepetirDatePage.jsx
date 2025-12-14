import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateDraft, getDraft } from '../utils/receipt';

const LoteriasRepetirDatePage = () => {
  const navigate = useNavigate();
  const { refreshUser, authError } = useAuth();
  const [selectedDate, setSelectedDate] = useState(null);

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
    refreshUser();
    const draft = getDraft();
    if (!draft?.apostas || !draft.apostas.length) {
      navigate('/loterias/repetir');
      return;
    }
    if (days.length) {
      const current = draft?.data;
      const exists = current && days.some((d) => d.value === current);
      setSelectedDate(exists ? current : days[0].value);
    }
  }, [refreshUser, navigate, days]);

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
          onClick={() => navigate('/loterias/repetir/valor')}
        >
          Voltar
        </button>
      </div>

      {authError && <div style={{ color: 'red' }}>{authError}</div>}

      <div style={styles.card}>
        <div style={{ fontWeight: 'bold', color: '#166534', fontSize: '19px' }}>Repetir PULE - Data</div>
        {getDraft()?.repeatSource?.betRef && (
          <div style={{ color: '#166534', fontSize: '13px', fontWeight: 'bold' }}>PULE selecionada: {getDraft().repeatSource.betRef}</div>
        )}
        <div style={{ color: '#6b7280', fontSize: '13px' }}>Escolha uma data (hoje ou até 2 dias à frente).</div>
        <div style={styles.daysGrid}>
          {days.map((d) => (
            <button key={d.value} style={styles.dayBtn(selectedDate === d.value)} onClick={() => setSelectedDate(d.value)}>
              {d.label}
            </button>
          ))}
        </div>
        <button
          style={styles.action}
          onClick={() => {
            if (!selectedDate) return;
            updateDraft({ data: selectedDate, currentSaved: false });
            navigate('/loterias-sorteios');
          }}
        >
          Escolher loteria e horário
        </button>
      </div>
    </div>
  );
};

export default LoteriasRepetirDatePage;

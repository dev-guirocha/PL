import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaClock } from 'react-icons/fa';
import { LOTERIAS_SORTEIOS } from '../data/sorteios';
import { getDraft, updateDraft } from '../utils/receipt';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';

const LoteriasSorteiosPage = () => {
  const navigate = useNavigate();
  const { balance, loadingUser, refreshUser, authError } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [selected, setSelected] = useState({ loteria: null, horario: null });
  const [draft, setDraft] = useState({});

  useEffect(() => {
    refreshUser();
    setDraft(getDraft());
  }, [refreshUser]);

  const timeValue = (txt) => {
    const matches = txt.match(/\d+/g);
    if (!matches || !matches.length) return Number.MAX_SAFE_INTEGER;
    const t = matches[matches.length - 1];
    return parseInt(t, 10);
  };

  const formatTime = (txt) => {
    const matches = txt.match(/\d+/g);
    if (!matches || !matches.length) return '--:--';
    const t = matches[matches.length - 1];
    const num = parseInt(t, 10);
    if (Number.isNaN(num)) return '--:--';
    return `${String(num).padStart(2, '0')}:00`;
  };

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
    list: {
      width: '100%',
      maxWidth: '520px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    item: {
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      padding: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      color: '#166534',
      cursor: 'pointer',
    },
    horarios: {
      marginTop: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    tag: {
      padding: '8px 10px',
      background: '#dcfce7',
      borderRadius: '10px',
      border: '1px solid #9ed8b6',
      color: '#166534',
      fontWeight: 'bold',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      justifyContent: 'space-between',
      width: '100%',
    },
    tagSelected: {
      padding: '8px 10px',
      background: '#166534',
      borderRadius: '10px',
      border: '1px solid #0f3f29',
      color: '#fff',
      fontWeight: 'bold',
      fontSize: '13px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      justifyContent: 'space-between',
      width: '100%',
    },
    tagDisabled: {
      padding: '8px 10px',
      background: '#f3f4f6',
      borderRadius: '10px',
      border: '1px solid #e5e7eb',
      color: '#9ca3af',
      fontWeight: 'bold',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      justifyContent: 'space-between',
      width: '100%',
      cursor: 'not-allowed',
    },
  };

  const selectedDate = draft?.data;
  const todayIso = new Date().toISOString().slice(0, 10);
  const isToday = selectedDate === todayIso;
  const currentHour = new Date().getHours();

  const isPastHorario = (h) => {
    if (!isToday) return false;
    const hour = timeValue(h);
    if (Number.isNaN(hour)) return false;
    return hour <= currentHour;
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

      <div style={styles.list}>
        {LOTERIAS_SORTEIOS.map((lot) => (
          <div
            key={lot.slug}
            style={styles.item}
            onClick={() => setExpanded((prev) => (prev === lot.slug ? null : lot.slug))}
          >
            <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{lot.nome}</div>
            {expanded === lot.slug && (
              <div style={styles.horarios}>
                {lot.horarios
                  .slice()
                  .sort((a, b) => timeValue(a) - timeValue(b))
                  .map((h, idx) => (
                    <span
                      key={idx}
                      style={
                        isPastHorario(h)
                          ? styles.tagDisabled
                          : selected.horario === h && selected.loteria === lot.slug
                            ? styles.tagSelected
                            : styles.tag
                      }
                      onClick={() => {
                        if (isPastHorario(h)) return;
                        setSelected({ loteria: lot.slug, horario: h });
                        updateDraft({ loteria: lot.nome, codigoHorario: h, horarioSelecionado: h });
                        navigate('/loterias-final');
                      }}
                    >
                      <span>{h}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FaClock style={{ opacity: 0.8 }} />
                        <span>{formatTime(h)}</span>
                      </span>
                    </span>
                  ))}
             </div>
           )}
         </div>
        ))}
      </div>
    </div>
  );
};

export default LoteriasSorteiosPage;

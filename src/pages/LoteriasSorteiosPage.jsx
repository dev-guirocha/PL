import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaClock, FaCheck } from 'react-icons/fa';
import { getLoteriasSorteios } from '../data/sorteios';
import { getDraft, updateDraft } from '../utils/receipt';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';

const LOTERIAS_1_10_ALLOWED = ['lotece-lotep', 'bahia'];

const LoteriasSorteiosPage = () => {
  const navigate = useNavigate();
  const { authError, refreshUser } = useAuth();
  const [expanded, setExpanded] = useState(null);
  const [selected, setSelected] = useState([]);
  const [draft, setDraft] = useState({});

  useEffect(() => {
    refreshUser();
    const d = getDraft();
    setDraft(d);
    setSelected(d?.selecoes || []);
  }, [refreshUser]);

  const loteriasExibidas = useMemo(() => {
    const loterias = getLoteriasSorteios(selectedDate);
    const jogoAtual = draft?.jogo || '';

    if (jogoAtual === 'Tradicional 1/10') {
      return loterias.filter((l) => LOTERIAS_1_10_ALLOWED.includes(l.slug));
    }

    if (jogoAtual === 'Lot. Uruguaia' || jogoAtual === 'Loteria Uruguaia') {
      return loterias.filter((l) => l.slug === 'uruguaia');
    }

    if (['Quininha', 'Seninha', 'Super15'].includes(jogoAtual)) {
      return loterias.filter((l) => l.slug.toLowerCase() === jogoAtual.toLowerCase());
    }

    return loterias.filter((l) => !['uruguaia', 'quininha', 'seninha', 'super15'].includes(l.slug));
  }, [draft, selectedDate]);

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

  const selectedDay = useMemo(() => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    const day = base.getDay();
    return Number.isNaN(day) ? null : day; // 0-dom, 3-qua, 6-sab
  }, [selectedDate]);

  const isPastHorario = (h) => {
    if (!isToday) return false;
    const hour = timeValue(h);
    if (Number.isNaN(hour)) return false;
    return hour <= currentHour;
  };

  const adjustHorarios = (lot) => {
    const list = Array.isArray(lot.horarios) ? lot.horarios : [];
    const isWedOrSat = selectedDay === 3 || selectedDay === 6;
    if (!isWedOrSat) return list;

    if (lot.slug === 'rio-federal') {
      return list.map((h) => (h === 'LT PT RIO 18HS' ? 'FEDERAL 20H' : h));
    }

    if (lot.slug === 'maluquinha') {
      return list.map((h) => (h === 'LT MALUQ RIO 18HS' ? 'LT MALUQ FEDERAL 20HS' : h));
    }

    return list;
  };

  const toggleSelection = (slug, nome, horario) => {
    const key = `${slug}-${horario}`;
    const exists = selected.find((s) => s.key === key);
    if (exists) {
      setSelected(selected.filter((s) => s.key !== key));
    } else {
      setSelected([...selected, { key, slug, nome, horario }]);
    }
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

      <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {selected.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {selected.map((s) => (
              <span
                key={s.key}
                style={{
                  padding: '6px 10px',
                  background: '#166534',
                  color: '#fff',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  gap: '6px',
                  alignItems: 'center',
                }}
              >
                {s.nome} • {s.horario}
                <button
                  type="button"
                  onClick={() => toggleSelection(s.slug, s.nome, s.horario)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                  aria-label="Remover seleção"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div style={styles.list}>
          {loteriasExibidas.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              Nenhuma loteria disponível para este modo ({draft?.jogo}).
            </div>
          )}

          {loteriasExibidas.map((lot) => (
            <div key={lot.slug} style={styles.item} onClick={() => setExpanded((prev) => (prev === lot.slug ? null : lot.slug))}>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{lot.nome}</div>
              {expanded === lot.slug && (
                <div style={styles.horarios}>
                  {adjustHorarios(lot)
                    .slice()
                    .sort((a, b) => timeValue(a) - timeValue(b))
                    .map((h, idx) => {
                      const isSelected = selected.some((s) => s.slug === lot.slug && s.horario === h);
                      return (
                        <span
                          key={idx}
                          style={isPastHorario(h) ? styles.tagDisabled : isSelected ? styles.tagSelected : styles.tag}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isPastHorario(h)) return;
                            toggleSelection(lot.slug, lot.nome, h);
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isSelected && <FaCheck />}
                            <span>{h}</span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FaClock style={{ opacity: 0.8 }} />
                            <span>{formatTime(h)}</span>
                          </span>
                        </span>
                      );
                    })}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          style={{
            padding: '12px',
            background: '#166534',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 'bold',
            width: '100%',
            cursor: selected.length ? 'pointer' : 'not-allowed',
            opacity: selected.length ? 1 : 0.5,
          }}
          disabled={!selected.length}
          onClick={() => {
            if (!selected.length) return;
            updateDraft({
              selecoes: selected,
              loteria: selected[0]?.nome || null,
              codigoHorario: selected[0]?.horario || null,
            });
            navigate('/loterias-final');
          }}
        >
          Confirmar horários selecionados
        </button>
      </div>
    </div>
  );
};

export default LoteriasSorteiosPage;

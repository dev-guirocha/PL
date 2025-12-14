import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaClock, FaCheck } from 'react-icons/fa';
import { LOTERIAS_SORTEIOS } from '../data/sorteios';
import { getDraft, updateDraft } from '../utils/receipt';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';

const LOTERIAS_UM_DECIMO = ['lotece-lotep', 'bahia']; // LOTEP/LOTECE e Bahia/BA Maluca agrupadas
const LOTERIAS_URUGUAIA = ['uruguaia'];
const LOTERIAS_SENINHA = ['seninha'];
const LOTERIAS_SUPER15 = ['super15'];
const LOTERIAS_SENINHA = ['seninha'];
const LOTERIAS_SUPER15 = ['super15'];

const LoteriasSorteiosPage = () => {
  const navigate = useNavigate();
  const { balance, loadingUser, refreshUser, authError } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [selected, setSelected] = useState([]);
  const [draft, setDraft] = useState({});

  useEffect(() => {
    refreshUser();
    const d = getDraft();
    setDraft(d);
    setSelected(d?.selecoes || []);
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

  const toggleSelection = (slug, nome, horario) => {
    const key = `${slug}-${horario}`;
    const exists = selected.find((s) => s.key === key);
    if (exists) {
      setSelected(selected.filter((s) => s.key !== key));
    } else {
      setSelected([...selected, { key, slug, nome, horario }]);
    }
  };

  const loteriasExibidas = useMemo(() => {
    const jogo = (draft?.jogo || '').toLowerCase();
    const isUmDecimo = jogo.includes('1/10') || jogo.includes('1-10') || (draft?.slug || '').includes('1-10');
    const isUruguaia = jogo.includes('uruguaia');
    const isSeninha = jogo.includes('seninha');
    const isSuper15 = jogo.includes('super 15') || jogo.includes('super15');
    if (isUmDecimo) {
      return LOTERIAS_SORTEIOS.filter((lot) => LOTERIAS_UM_DECIMO.includes(lot.slug));
    }
    if (isUruguaia) {
      return LOTERIAS_SORTEIOS.filter((lot) => LOTERIAS_URUGUAIA.includes(lot.slug));
    }
    if (isSeninha) {
      return LOTERIAS_SORTEIOS.filter((lot) => LOTERIAS_SENINHA.includes(lot.slug));
    }
    if (isSuper15) {
      return LOTERIAS_SORTEIOS.filter((lot) => LOTERIAS_SUPER15.includes(lot.slug));
    }
    // Tradicional normal: exclui uruguaias para não misturar
    return LOTERIAS_SORTEIOS.filter((lot) => !LOTERIAS_URUGUAIA.includes(lot.slug));
  }, [draft]);

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
          {loteriasExibidas.map((lot) => (
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
                    .map((h, idx) => {
                      const isSelected = selected.some((s) => s.slug === lot.slug && s.horario === h);
                      return (
                        <span
                          key={idx}
                          style={
                            isPastHorario(h)
                              ? styles.tagDisabled
                              : isSelected
                                ? styles.tagSelected
                                : styles.tag
                          }
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

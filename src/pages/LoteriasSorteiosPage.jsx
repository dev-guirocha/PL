import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaClock, FaCheck } from 'react-icons/fa';
import { LOTERIAS_SORTEIOS } from '../data/sorteios';
import { getDraft, updateDraft } from '../utils/receipt';
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
    const loterias = LOTERIAS_SORTEIOS;
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
  }, [draft]);

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
    const base = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date();
    const day = base.getDay();
    return Number.isNaN(day) ? null : day; // 0-dom, 3-qua, 6-sab
  }, [selectedDate]);
  const isFederalDay = selectedDay === 3 || selectedDay === 6;

  const isPastHorario = (h) => {
    if (!isToday) return false;
    const hour = timeValue(h);
    if (Number.isNaN(hour)) return false;
    return hour <= currentHour;
  };

  const adjustHorarios = (lot) => {
    const list = Array.isArray(lot.horarios) ? lot.horarios : [];
    const isFedDay = selectedDay === 3 || selectedDay === 6; // Qua ou Sáb

    // Fora de dia de FEDERAL:
    // - esconde o grupo FEDERAL
    // - remove quaisquer horários com 'FEDERAL' por segurança
    if (!isFedDay) {
      if (lot.slug === 'federal') return [];
      return list.filter((h) => !/FEDERAL/i.test(h));
    }

    // Em dia de FEDERAL:
    if (lot.slug === 'rio-federal') {
      return list.filter((h) => !/LT\s*PT\s*RIO\s*18H/i.test(h));
    }

    if (lot.slug === 'maluquinha') {
      return list.filter((h) => !/LT\s*MALUQ\s*RIO\s*18H/i.test(h));
    }

    if (lot.slug === 'federal') {
      return list.filter((h) => /FEDERAL/i.test(h));
    }

    return list;
  };

  // Converte um texto de horário (ex.: "LT PT RIO 18HS", "FEDERAL 20H") em:
  // - loteria: "LT PT RIO" / "FEDERAL"
  // - codigoHorario: "18HS" / "20H"
  const splitHorario = (txt) => {
    const clean = String(txt || '').trim().replace(/\s+/g, ' ');
    if (!clean) return { loteria: '', codigoHorario: '' };
    const parts = clean.split(' ');
    if (parts.length === 1) return { loteria: clean, codigoHorario: '' };
    const codigoHorario = parts[parts.length - 1];
    const loteria = parts.slice(0, -1).join(' ').trim();
    return { loteria: loteria || clean, codigoHorario };
  };

  const toggleSelection = (slug, lotNome, horarioTxt) => {
    const parsed = splitHorario(horarioTxt);

    // Para controle de seleção na UI, guardamos o texto original do horário
    const rawHorario = String(horarioTxt || '').trim();

    // O que vai para o backend (limpo):
    const nome = parsed.loteria;          // ex.: "LT PT RIO"
    const horario = parsed.codigoHorario; // ex.: "18HS"

    const key = `${slug}-${rawHorario}`;
    const exists = selected.find((s) => s.key === key);
    if (exists) {
      setSelected(selected.filter((s) => s.key !== key));
      return;
    }

    setSelected([
      ...selected,
      {
        key,
        slug,
        // nome/horario são os campos "contratuais" usados no FinalPage -> backend
        nome,
        horario,
        // rawHorario é só para o match visual (selecionado) na lista
        rawHorario,
        // opcional: nome do card/grupo para debug/UX
        grupo: lotNome,
      },
    ]);
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

      {/* Aviso de UX em dia de Federal */}
      {isFederalDay && (
        <div style={{ width: '100%', maxWidth: '520px', background: '#FEF3C7', border: '1px solid #F59E0B', color: '#92400E', borderRadius: '12px', padding: '10px 12px', fontSize: '12px', fontWeight: 'bold' }}>
          Dia de FEDERAL (Quarta/Sábado): horários 18h de PT RIO e MALUQ ficam indisponíveis, use FEDERAL 20h.
        </div>
      )}

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
                  onClick={() => toggleSelection(s.slug, s.grupo || s.nome, s.rawHorario || s.horario)}
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

          {loteriasExibidas.map((lot) => {
            const horariosAjustados = adjustHorarios(lot)
              .slice()
              .sort((a, b) => timeValue(a) - timeValue(b));

            if (!horariosAjustados.length) return null;

            return (
              <div key={lot.slug} style={styles.item} onClick={() => setExpanded((prev) => (prev === lot.slug ? null : lot.slug))}>
                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{lot.nome}</div>
                {expanded === lot.slug && (
                  <div style={styles.horarios}>
                    {horariosAjustados.map((h, idx) => {
                      const isSelected = selected.some((s) => s.slug === lot.slug && (s.rawHorario || s.horario) === h);
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
            );
          })}
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

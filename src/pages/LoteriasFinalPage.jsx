import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import api from '../utils/api';
import Spinner from '../components/Spinner';
import { getDraft, clearDraft, appendToHistory, updateDraft, buildReceiptEntry } from '../utils/receipt';
import { useAuth } from '../context/AuthContext';

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bet_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const LoteriasFinalPage = () => {
  const navigate = useNavigate();
  const { balance, bonus, refreshUser, loadingUser, authError, updateBalances, isAuthenticated } = useAuth();
  const [draft, setDraft] = useState({});
  const [showBalance, setShowBalance] = useState(true);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [betSaved, setBetSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDraft(getDraft());
    refreshUser();
  }, [refreshUser]);

  const formatSelectionLabel = (sel) => {
    const label = sel?.horario || '';
    if (!label) return sel?.nome || sel?.slug || '';
    if (!sel?.nome) return label;
    return label.includes(sel.nome) ? label : `${sel.nome} • ${label}`;
  };

  const selecoes = useMemo(() => {
    if (Array.isArray(draft?.selecoes) && draft.selecoes.length) return draft.selecoes;
    if (draft?.loteria && draft?.codigoHorario) {
      return [
        {
          key: `${draft?.slug || draft?.loteria}-${draft?.codigoHorario}`,
          slug: draft?.slug,
          nome: draft?.loteria,
          horario: draft?.codigoHorario,
        },
      ];
    }
    return [];
  }, [draft]);

  const baseNumbers = useMemo(() => {
    if (Array.isArray(draft?.valendoBase?.numerosBase) && draft.valendoBase.numerosBase.length) {
      return draft.valendoBase.numerosBase;
    }
    const first = (draft?.apostas || [])[0];
    if (Array.isArray(first?.palpites) && first.palpites.length) return first.palpites;
    if (Array.isArray(draft?.palpites) && draft.palpites.length) return draft.palpites;
    return [];
  }, [draft]);

  const total = useMemo(() => {
    const apostas = draft?.apostas || [];
    const unit = apostas.reduce((sum, ap) => sum + (ap.total || 0), 0);
    return unit * Math.max(selecoes.length || 1, 1);
  }, [draft, selecoes.length]);

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
    summary: {
      background: '#f0fdf4',
      border: '1px solid #9ed8b6',
      borderRadius: '12px',
      padding: '12px',
      color: '#166534',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      fontSize: '14px',
    },
    chipRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
    },
    chip: {
      padding: '8px 12px',
      background: '#dcfce7',
      borderRadius: '999px',
      color: '#166534',
      fontWeight: 'bold',
      border: '1px solid #9ed8b6',
    },
    lineRow: {
      borderTop: '1px dashed #9ed8b6',
      paddingTop: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    totalRow: {
      display: 'flex',
      justifyContent: 'space-between',
      fontWeight: 'bold',
      color: '#166534',
      fontSize: '16px',
    },
    actions: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
    },
    actionBtn: {
      flex: 1,
      minWidth: '140px',
      padding: '12px',
      borderRadius: '10px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: 'bold',
    },
    primary: { background: '#166534', color: '#fff' },
    secondary: { background: '#e5e7eb', color: '#111827' },
    message: { color: '#dc2626', fontWeight: 'bold' },
    success: { color: '#166534', fontWeight: 'bold' },
  };

  return (
    <div style={styles.container}>
      <div style={{ alignSelf: 'flex-start' }}>
        <button style={styles.backButton} onClick={() => navigate('/loterias-sorteios')}>
          Voltar
        </button>
      </div>

      {authError && <div style={{ color: 'red' }}>{authError}</div>}

      <div style={styles.card}>
        <div style={styles.title}>Conferência final</div>
        <div style={styles.summary}>
          {selecoes.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {selecoes.map((s) => (
                <span key={s.key || `${s.slug}-${s.horario}`} style={styles.chip}>
                  {formatSelectionLabel(s)}
                </span>
              ))}
            </div>
          ) : (
            <>
              {draft?.loteria && <span>Loteria: {draft.loteria}</span>}
              {draft?.codigoHorario && <span>Horário: {draft.codigoHorario}</span>}
            </>
          )}
          {baseNumbers.length ? (
            <div style={styles.lineRow}>
              <span style={{ fontWeight: 'bold' }}>Números base</span>
              <div style={styles.chipRow}>
                {baseNumbers.map((p, i) => (
                  <span key={`${p}-${i}`} style={styles.chip}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {draft?.apostas?.map((ap, idx) => (
            <div key={idx} style={styles.lineRow}>
              <div style={styles.totalRow}>
                <span>{ap.modalidade || ap.jogo || 'Modalidade'}</span>
                <button
                  type="button"
                  style={{
                    border: '1px solid #fecdd3',
                    background: '#fff1f2',
                    color: '#b91c1c',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    const updated = (draft?.apostas || []).filter((_, i) => i !== idx);
                    const next = { ...draft, apostas: updated };
                    setDraft(next);
                    updateDraft(next);
                  }}
                >
                  Apagar
                </button>
              </div>
              {ap.colocacao && <span>Colocação: {ap.colocacao}</span>}
              <div style={styles.totalRow}>
                <span>Valor:</span>
                <span>R$ {(Number(ap.valorAposta) || 0).toFixed(2).replace('.', ',')}</span>
              </div>
              <div style={styles.totalRow}>
                <span>Aplicação:</span>
                <span>{ap.modoValor === 'cada' ? 'Cada' : 'Todos'}</span>
              </div>
            </div>
          ))}
          <div style={styles.totalRow}>
            <span>Valor total a pagar:</span>
            <span>R$ {total.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>

        {message && <div style={styles.message}>{message}</div>}
        {success && (
          <div style={styles.success}>
            {success}
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                style={{ ...styles.actionBtn, ...styles.secondary, minWidth: '140px' }}
                onClick={() => navigate('/pules')}
              >
                Visualizar PULE
              </button>
              <button
                style={{ ...styles.actionBtn, ...styles.primary, minWidth: '140px' }}
                onClick={() => navigate('/home')}
              >
                Ir para Home
              </button>
            </div>
          </div>
        )}

        <div style={styles.actions}>
          <button
            style={{ ...styles.actionBtn, ...styles.secondary }}
            onClick={() => navigate('/loterias-sorteios')}
          >
            Voltar às apostas
          </button>
          <button
            style={{
              ...styles.actionBtn,
              ...styles.primary,
              ...(submitting ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
            }}
            disabled={submitting}
            onClick={async () => {
              if (submitting) return; // trava duplo clique
              if (!isAuthenticated) {
                setMessage('Faça login para finalizar.');
                return;
              }
              if (!selecoes.length) {
                setMessage('Selecione ao menos uma loteria/horário.');
                return;
              }
              try {
                setSubmitting(true);
                let lastBalances = {};
                let totalDebited = 0;
                const betsCreated = [];
                const apostasComData = (draft?.apostas || []).map((ap) => ({
                  ...ap,
                  data: ap?.data || draft?.data || ap?.dataJogo,
                }));
                for (const sel of selecoes) {
                  const idempotencyKey = createIdempotencyKey();
                  const res = await api.post(
                    '/bets',
                    {
                      loteria: sel.nome || draft?.loteria,
                      codigoHorario: sel.horario,
                      dataJogo: draft?.data,
                      apostas: apostasComData,
                    },
                    { headers: { 'Idempotency-Key': idempotencyKey } },
                  );
                  const debited = res.data?.debited ?? 0;
                  totalDebited += debited;
                  if (res.data?.bet?.id) {
                    betsCreated.push({
                      betId: res.data.bet.id,
                      loteria: sel.nome || draft?.loteria,
                      horario: sel.horario,
                      total: debited,
                    });
                  }
                  lastBalances = { balance: res.data?.balance, bonus: res.data?.bonus };
                }
                if (lastBalances.balance !== undefined) {
                  updateBalances(lastBalances);
                }
                appendToHistory(
                  buildReceiptEntry({
                    selecoes: baseNumbers,
                    apostas: draft?.apostas || [],
                    total: totalDebited || total,
                    bets: betsCreated,
                  }),
                );
                setSuccess('Aposta realizada com sucesso! PULE salvo no histórico.');
                setMessage('');
                clearDraft();
                setTimeout(() => navigate('/home'), 800);
                setBetSaved(true);
              } catch (err) {
                const msg =
                  err.response?.data?.error ||
                  err.response?.data?.message ||
                  err.message ||
                  'Erro ao debitar.';
                setMessage(msg);
                setBetSaved(false);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? 'Processando...' : 'Finalizar'}
          </button>
        </div>

        <button
          style={{
            ...styles.actionBtn,
            ...styles.secondary,
            width: '100%',
            opacity: betSaved ? 1 : 0.5,
            cursor: betSaved ? 'pointer' : 'not-allowed',
          }}
          onClick={() => betSaved && window.print()}
          disabled={!betSaved}
        >
          Baixar PULE (PDF)
        </button>
      </div>
    </div>
  );
};

export default LoteriasFinalPage;

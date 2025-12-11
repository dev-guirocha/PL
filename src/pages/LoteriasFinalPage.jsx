import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import api from '../utils/api';
import Spinner from '../components/Spinner';
import { getDraft, clearDraft, appendToHistory } from '../utils/receipt';
import { PAYOUTS } from '../constants/payouts';
import { useAuth } from '../context/AuthContext';
import { formatDateBR } from '../utils/date';

const LoteriasFinalPage = () => {
  const navigate = useNavigate();
  const { balance, bonus, refreshUser, loadingUser, authError, updateBalances, isAuthenticated } = useAuth();
  const [draft, setDraft] = useState({});
  const [showBalance, setShowBalance] = useState(true);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [betSaved, setBetSaved] = useState(false);

  useEffect(() => {
    setDraft(getDraft());
    refreshUser();
  }, [refreshUser]);

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

  const total = useMemo(() => {
    const apostas = draft?.apostas || [];
    const unit = apostas.reduce((sum, ap) => sum + (ap.total || 0), 0);
    return unit * Math.max(selecoes.length || 1, 1);
  }, [draft, selecoes.length]);

  const valorPorNumero = useMemo(() => {
    const apostas = draft?.apostas || [];
    if (!apostas.length) return 0;
    // mostra do último item como referência
    const last = apostas[apostas.length - 1];
    return last?.valorPorNumero || 0;
  }, [draft]);

  const ganhos = useMemo(() => {
    const apostas = draft?.apostas || [];
    return apostas
      .map((ap) => {
        const key = (ap.modalidade || '').toUpperCase().trim();
        const payout = PAYOUTS[key];
        if (!payout) return null;
        const valorAposta = Number(ap.total || 0);
        const ganho = valorAposta * payout;
        return { modalidade: ap.modalidade, valor: valorAposta, ganho };
      })
      .filter(Boolean);
  }, [draft]);

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
                  {s.nome || s.slug} • {s.horario}
                </span>
              ))}
            </div>
          ) : (
            <>
              {draft?.loteria && <span>Loteria: {draft.loteria}</span>}
              {draft?.codigoHorario && <span>Horário: {draft.codigoHorario}</span>}
            </>
          )}
          {draft?.apostas?.map((ap, idx) => (
            <div key={idx} style={{ borderTop: '1px dashed #9ed8b6', paddingTop: '8px' }}>
              <div style={styles.totalRow}>
                <span>{ap.jogo}</span>
                <span>{formatDateBR(ap.data)}</span>
              </div>
              {ap.modalidade && <span>Modalidade: {ap.modalidade}</span>}
              {ap.colocacao && <span>Prêmio: {ap.colocacao}</span>}
              <span>Qtd palpites: {ap.palpites?.length || 0}</span>
              {ap?.palpites?.length ? (
                <div style={styles.chipRow}>
                  {ap.palpites.map((p, i) => (
                    <span key={`${p}-${i}`} style={styles.chip}>
                      {p}
                    </span>
                  ))}
                </div>
              ) : null}
              <div style={styles.totalRow}>
                <span>Valor por número:</span>
                <span>R$ {(ap.valorPorNumero || 0).toFixed(2).replace('.', ',')}</span>
              </div>
              <div style={styles.totalRow}>
                <span>Valor da aposta:</span>
                <span>R$ {(ap.total || 0).toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          ))}
          <div style={styles.totalRow}>
            <span>Valor total a pagar:</span>
            <span>R$ {total.toFixed(2).replace('.', ',')}</span>
          </div>
          {ganhos.length > 0 && (
            <div style={{ marginTop: '8px', color: '#166534' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Possíveis ganhos (1ª linha)</div>
              {ganhos.map((g, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>{g.modalidade}</span>
                  <span>R$ {g.ganho.toFixed(2).replace('.', ',')}</span>
                </div>
              ))}
            </div>
          )}
          {valorPorNumero ? (
            <div style={{ color: '#166534', fontSize: '13px' }}>
              Valor por número (última aposta): R$ {valorPorNumero.toFixed(2).replace('.', ',')}
            </div>
          ) : null}
        </div>

        {message && <div style={styles.message}>{message}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <div style={styles.actions}>
          <button
            style={{ ...styles.actionBtn, ...styles.secondary }}
            onClick={() => navigate('/loterias-sorteios')}
          >
            Voltar às apostas
          </button>
          <button
            style={{ ...styles.actionBtn, ...styles.primary }}
            onClick={async () => {
              if (!isAuthenticated) {
                setMessage('Faça login para finalizar.');
                return;
              }
              if (!selecoes.length) {
                setMessage('Selecione ao menos uma loteria/horário.');
                return;
              }
              try {
                let lastBalances = {};
                let totalDebited = 0;
                const betsCreated = [];
                for (const sel of selecoes) {
                  const res = await api.post(
                    '/bets',
                    {
                      loteria: sel.nome || draft?.loteria,
                      codigoHorario: sel.horario,
                      apostas: draft?.apostas || [],
                    },
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
                appendToHistory({
                  criadoEm: new Date().toISOString(),
                  selecoes,
                  apostas: draft?.apostas || [],
                  total: totalDebited || total,
                  bets: betsCreated,
                });
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
              }
            }}
          >
            Finalizar
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

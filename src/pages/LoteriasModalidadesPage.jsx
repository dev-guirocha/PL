import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { getDraft, updateDraft } from '../utils/receipt';
import { MODALIDADES, CAN_CHOOSE_COLOCACAO, DIRECT_TO_PALPITES } from '../constants/games';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { formatDateBR } from '../utils/date';

const LoteriasModalidadesPage = () => {
  const navigate = useNavigate();
  const { jogo } = useParams();
  const { balance, loadingUser, refreshUser, authError } = useAuth();
  const [draft, setDraft] = useState({});
  const [showBalance, setShowBalance] = useState(true);
  const [showValendoBaseModal, setShowValendoBaseModal] = useState(false);

  const isValendoFlow = Boolean(draft?.isValendo);
  const valendoBase = draft?.valendoBase || {};
  const baseModalidade = String(valendoBase?.modalidadeBase || '').toUpperCase();
  const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
  const basePalpites = Array.isArray(valendoBase?.numerosBase) ? valendoBase.numerosBase : [];
  const normalizedBasePalpites = basePalpites.map((p) => onlyDigits(p)).filter(Boolean);
  const baseDigits = (() => {
    const sizes = normalizedBasePalpites.map((p) => p.length).filter(Boolean);
    if (sizes.includes(4)) return 4;
    if (sizes.includes(3)) return 3;
    return null;
  })();
  const baseIsCentena = baseDigits === 3 || baseModalidade.startsWith('CENTENA');
  const valendoBaseLabel = (() => {
    if (baseDigits === 4 || baseModalidade.includes('MILHAR')) return 'MILHAR';
    if (baseDigits === 3 || baseModalidade.startsWith('CENTENA')) return 'CENTENA';
    return '—';
  })();
  const valendoHint = baseIsCentena
    ? 'Base CENTENA: opções de MILHAR não aparecem no Valendo.'
    : 'Base MILHAR: Valendo pode derivar para Centena/Dezena/Unidade/Grupo.';
  const valendoPreview = (() => {
    const total = normalizedBasePalpites.length;
    if (!total) return { text: '—', extra: '' };
    const first = normalizedBasePalpites.slice(0, 3);
    const remaining = Math.max(total - first.length, 0);
    const text = first.join(', ');
    const extra = remaining > 0 ? ` +${remaining}` : '';
    return { text, extra };
  })();
  const valendoAllowList = [
    'MILHAR',
    'MILHAR INV',
    'MILHAR E CT',
    'CENTENA',
    'CENTENA INV',
    'CENTENA ESQUERDA',
    'CENTENA INV ESQ',
    'DEZENA',
    'DEZENA ESQ',
    'DEZENA MEIO',
    'UNIDADE',
    'GRUPO',
  ];

  const modalidadesToShow = isValendoFlow
    ? MODALIDADES.filter((m) => {
        const up = String(m || '').toUpperCase();
        if (!valendoAllowList.includes(up)) return false;
        if (baseIsCentena && ['MILHAR', 'MILHAR INV', 'MILHAR E CT'].includes(up)) return false;
        if (up === 'MILHAR E CT' && baseDigits !== 4) return false;
        return true;
      })
    : MODALIDADES;

  useEffect(() => {
    setDraft(getDraft());
    refreshUser();
  }, [refreshUser]);

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
    list: { display: 'flex', flexDirection: 'column', gap: '10px' },
    item: {
      padding: '12px',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      background: '#fff',
      cursor: 'pointer',
      fontWeight: 'bold',
      color: '#166534',
      textAlign: 'left',
      fontSize: '15px',
    },
  };

  const valendoBannerStyles = {
    width: '100%',
    maxWidth: styles?.card?.maxWidth || '520px',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '14px',
    padding: '12px 14px',
    color: '#065f46',
    fontWeight: 'bold',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  };
  const valendoPreviewRowStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    fontSize: '12px',
    fontWeight: 700,
    color: '#065f46',
  };
  const valendoLinkBtnStyles = {
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    fontWeight: 900,
    color: '#047857',
    textDecoration: 'underline',
  };
  const modalOverlayStyles = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px',
  };
  const modalCardStyles = {
    width: '100%',
    maxWidth: '640px',
    background: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
    overflow: 'hidden',
  };
  const modalHeaderStyles = {
    padding: '14px 16px',
    background: '#ecfdf5',
    borderBottom: '1px solid #a7f3d0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  };
  const modalBodyStyles = {
    padding: '14px 16px',
    maxHeight: '60vh',
    overflow: 'auto',
  };
  const modalCloseBtnStyles = {
    border: '1px solid #cbd5e1',
    background: '#fff',
    borderRadius: '10px',
    padding: '8px 10px',
    cursor: 'pointer',
    fontWeight: 900,
    color: '#0f172a',
  };
  const valendoPillStyles = {
    border: '1px solid #a7f3d0',
    background: '#f0fdf4',
    borderRadius: '999px',
    padding: '4px 10px',
    fontFamily: 'monospace',
    letterSpacing: '0.2px',
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
          onClick={() => navigate(`/loterias/${jogo}`)}
        >
          Voltar
        </button>
      </div>

      {authError && <div style={{ color: 'red' }}>{authError}</div>}

      {isValendoFlow && showValendoBaseModal && (
        <div
          style={modalOverlayStyles}
          onClick={() => setShowValendoBaseModal(false)}
          role="presentation"
        >
          <div style={modalCardStyles} onClick={(e) => e.stopPropagation()} role="presentation">
            <div style={modalHeaderStyles}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '14px', fontWeight: 1000, color: '#065f46' }}>
                  Base do VALENDO
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#047857' }}>
                  {valendoBaseLabel} • {normalizedBasePalpites.length} numero(s)
                </div>
              </div>
              <button style={modalCloseBtnStyles} onClick={() => setShowValendoBaseModal(false)}>
                Fechar
              </button>
            </div>
            <div style={modalBodyStyles}>
              {normalizedBasePalpites.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {normalizedBasePalpites.map((n, idx) => (
                    <span
                      key={`${n}-${idx}`}
                      style={{
                        ...valendoPillStyles,
                        borderColor: '#bbf7d0',
                        background: '#f0fdf4',
                        fontSize: '12px',
                        fontWeight: 900,
                        color: '#065f46',
                      }}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  Nenhum palpite base encontrado.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isValendoFlow && (
        <div style={valendoBannerStyles}>
          <div style={{ fontSize: '14px', letterSpacing: '0.3px' }}>
            VALENDO a partir de <span style={{ textTransform: 'uppercase' }}>{valendoBaseLabel}</span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#047857' }}>{valendoHint}</div>
          <div style={valendoPreviewRowStyles}>
            <span style={{ fontWeight: 800, color: '#047857' }}>Base:</span>
            <span style={valendoPillStyles}>
              {valendoPreview.text}
              {valendoPreview.extra ? (
                <span style={{ fontWeight: 900, color: '#047857' }}>{valendoPreview.extra}</span>
              ) : null}
            </span>
            <button
              type="button"
              style={valendoLinkBtnStyles}
              onClick={() => setShowValendoBaseModal(true)}
            >
              ver todos
            </button>
          </div>
        </div>
      )}

      <div style={styles.card}>
        <div style={styles.title}>Modalidades</div>
        {draft?.jogo && draft?.data && (
          <div style={styles.subtitle}>
            Jogo: {draft.jogo} • Data: {formatDateBR(draft.data)}
          </div>
        )}
        <div style={styles.subtitle}>
          {isValendoFlow
            ? 'Escolha a modalidade do VALENDO. Você vai selecionar colocação e valor em seguida.'
            : 'Escolha uma modalidade (válida para Tradicional, Tradicional 1/10 e Uruguaia).'}
        </div>
        <div style={styles.list}>
          {modalidadesToShow.map((m) => (
            <button
              key={m}
              style={styles.item}
              onClick={() => {
                updateDraft({ modalidade: m });
                if (CAN_CHOOSE_COLOCACAO.includes(m.toUpperCase())) {
                  navigate(`/loterias/${jogo}/colocacao`);
                } else if (DIRECT_TO_PALPITES.includes(m.toUpperCase())) {
                  navigate(`/loterias/${jogo}/palpites`);
                } else {
                  toast.success(`Modalidade selecionada: ${m} (recibo atualizado).`);
                }
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoteriasModalidadesPage;

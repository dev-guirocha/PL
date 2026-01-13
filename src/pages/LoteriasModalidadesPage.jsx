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

  const isValendoFlow = Boolean(draft?.isValendoFlow);
  const baseKind = String(draft?.valendoBaseKind || '').toUpperCase();
  const baseModalidade = String(draft?.valendoBaseModalidade || '').toUpperCase();
  const baseIsCentena = baseKind === 'CENTENA' || baseModalidade.startsWith('CENTENA');
  const valendoBaseLabel = (() => {
    if (baseKind === 'MILHAR') return 'MILHAR';
    if (baseKind === 'CENTENA') return 'CENTENA';
    if (baseModalidade.includes('MILHAR')) return 'MILHAR';
    if (baseModalidade.startsWith('CENTENA')) return 'CENTENA';
    return '—';
  })();
  const valendoHint = baseIsCentena
    ? 'Base CENTENA: opções de MILHAR não aparecem no Valendo.'
    : 'Base MILHAR: Valendo pode derivar para Centena/Dezena/Unidade/Grupo.';
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
        // Regra 7.2: se base=centena, o menu do Valendo exclui milhar
        if (baseIsCentena && up.startsWith('MILHAR')) return false;
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

      {isValendoFlow && (
        <div style={valendoBannerStyles}>
          <div style={{ fontSize: '14px', letterSpacing: '0.3px' }}>
            VALENDO a partir de <span style={{ textTransform: 'uppercase' }}>{valendoBaseLabel}</span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#047857' }}>{valendoHint}</div>
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
                if (isValendoFlow) {
                  navigate(`/loterias/${jogo}/colocacao`);
                  return;
                }
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

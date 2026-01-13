import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Spinner from '../components/Spinner';
import { getDraft, updateDraft } from '../utils/receipt';
import { formatDateBR } from '../utils/date';
import { COLOCACOES } from '../constants/games';
import { useAuth } from '../context/AuthContext';

const LoteriasColocacaoPage = () => {
  const navigate = useNavigate();
  const { jogo } = useParams();
  const { balance, loadingUser, refreshUser, authError } = useAuth();
  const [draft, setDraft] = useState({});
  const [showBalance, setShowBalance] = useState(true);
  const isValendoFlow = Boolean(draft?.isValendoFlow);

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
          onClick={() => navigate(`/loterias/${jogo}/modalidades`)}
        >
          Voltar
        </button>
      </div>

      {authError && <div style={{ color: 'red' }}>{authError}</div>}

      <div style={styles.card}>
        <div style={styles.title}>Colocação</div>
        {draft?.jogo && draft?.data && draft?.modalidade && (
        <div style={styles.subtitle}>
          Jogo: {draft.jogo} • Data: {formatDateBR(draft.data)} • Modalidade: {draft.modalidade}
        </div>
        )}
        <div style={styles.subtitle}>
          Escolha a colocação válida para Centena, Centena Inv, Unidade, Dezena, Grupo.
        </div>
        <div style={styles.list}>
          {COLOCACOES.map((c) => (
            <button
              key={c}
              style={styles.item}
              onClick={() => {
                updateDraft({ colocacao: c });
                navigate(isValendoFlow ? `/loterias/${jogo}/valor` : `/loterias/${jogo}/palpites`);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoteriasColocacaoPage;

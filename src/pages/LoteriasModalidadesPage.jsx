import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { getDraft, updateDraft } from '../utils/receipt';
import { MODALIDADES, CAN_CHOOSE_COLOCACAO, DIRECT_TO_PALPITES } from '../constants/games';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';

const LoteriasModalidadesPage = () => {
  const navigate = useNavigate();
  const { jogo } = useParams();
  const { balance, loadingUser, refreshUser, authError } = useAuth();
  const [draft, setDraft] = useState({});
  const [showBalance, setShowBalance] = useState(true);

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
          onClick={() => navigate(`/loterias/${jogo}`)}
        >
          Voltar
        </button>
      </div>

      {authError && <div style={{ color: 'red' }}>{authError}</div>}

      <div style={styles.card}>
        <div style={styles.title}>Modalidades</div>
        {draft?.jogo && draft?.data && (
          <div style={styles.subtitle}>
            Jogo: {draft.jogo} • Data: {draft.data}
          </div>
        )}
        <div style={styles.subtitle}>Escolha uma modalidade (válida para Tradicional, Tradicional 1/10 e Uruguaia).</div>
        <div style={styles.list}>
          {MODALIDADES.map((m) => (
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

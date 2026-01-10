import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { getDraft, updateDraft } from '../utils/receipt';
import { formatDateBR } from '../utils/date';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import SmartBetInput from '../components/Betting/SmartBetInput';
import { isSmartInputSupported } from '../utils/betParser';

const LoteriasPalpitesPage = () => {
  const navigate = useNavigate();
  const { jogo } = useParams();
  const { balance, loadingUser, refreshUser, authError } = useAuth();
  const [draft, setDraft] = useState({});
  const [showBalance, setShowBalance] = useState(true);
  const [palpite, setPalpite] = useState('');
  const [palpites, setPalpites] = useState([]);
  const [palpiteError, setPalpiteError] = useState('');
  const prevLength = useRef(0);

  const modalidade = (draft?.modalidade || '').toUpperCase();
  const expectedDigits = modalidade.includes('MILHAR')
    ? 4
    : modalidade.includes('CENTENA')
      ? 3
      : modalidade.includes('DEZENA')
        ? 2
        : modalidade.includes('UNIDADE')
          ? 1
          : null;
  const isSupportedModalidade = Boolean(expectedDigits);
  const showSmartInput = isSmartInputSupported(modalidade);

  useEffect(() => {
    const d = getDraft();
    setDraft(d);
    const signature = `${d?.jogo || ''}|${d?.data || ''}|${d?.modalidade || ''}|${d?.colocacao || ''}`;
    const storedSig = d?.palpitesSignature;
    if (Array.isArray(d?.palpites) && d.palpites.length && storedSig === signature) {
      setPalpites(d.palpites);
    } else {
      setPalpites([]);
      updateDraft({ palpites: [], palpitesSignature: signature });
    }
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
    placeholder: {
      padding: '12px',
      background: '#f0fdf4',
      border: '1px dashed #9ed8b6',
      borderRadius: '12px',
      color: '#166534',
      fontWeight: 'bold',
      textAlign: 'center',
    },
    inputRow: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    input: {
      flex: 1,
      minWidth: '120px',
      padding: '10px',
      borderRadius: '10px',
      border: '1px solid #d1d5db',
      fontSize: '16px',
      letterSpacing: '2px',
      textAlign: 'center',
    },
    addButton: {
      padding: '10px 14px',
      background: '#166534',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontWeight: 'bold',
    },
    chips: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
    },
    chip: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 12px',
      background: '#dcfce7',
      borderRadius: '999px',
      color: '#166534',
      fontWeight: 'bold',
      border: '1px solid #9ed8b6',
      cursor: 'pointer',
    },
  };

  const addPalpite = (value) => {
    const clean = (value ?? palpite).replace(/\D/g, '');
    if (!isSupportedModalidade) {
      return;
    }
    if (clean.length !== expectedDigits) return;
    setPalpiteError('');
    const updated = [...palpites, clean];
    setPalpites(updated);
    const signature = `${draft?.jogo || ''}|${draft?.data || ''}|${draft?.modalidade || ''}|${draft?.colocacao || ''}`;
    updateDraft({ palpites: updated, palpitesSignature: signature });
    setPalpite('');
    prevLength.current = 0;
  };

  const handleChangePalpite = (value) => {
    const clean = value.replace(/\D/g, '');
    const limited = expectedDigits ? clean.slice(0, expectedDigits) : clean;
    setPalpite(limited);
    if (!isSupportedModalidade) return;
    if (limited.length && limited.length < expectedDigits) {
      setPalpiteError(`Digite ${expectedDigits} números.`);
    } else {
      setPalpiteError('');
    }
    if (isSupportedModalidade && limited.length === expectedDigits && prevLength.current < expectedDigits) {
      addPalpite(limited);
    }
    prevLength.current = limited.length;
  };

  const handleSmartAdd = (novosPalpites) => {
    if (!Array.isArray(novosPalpites) || novosPalpites.length === 0) return;
    setPalpiteError('');
    const signature = `${draft?.jogo || ''}|${draft?.data || ''}|${draft?.modalidade || ''}|${draft?.colocacao || ''}`;
    setPalpites((prev) => {
      const next = [...prev, ...novosPalpites];
      updateDraft({ palpites: next, palpitesSignature: signature });
      return next;
    });
    prevLength.current = 0;
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
        <div style={styles.title}>Palpites</div>
        {draft?.jogo && draft?.data && draft?.modalidade && (
          <div style={styles.subtitle}>
            Jogo: {draft.jogo} • Data: {formatDateBR(draft.data)} • Modalidade: {draft.modalidade}
          </div>
        )}
        {draft?.colocacao && (
          <div style={styles.subtitle}>Colocação: {draft.colocacao}</div>
        )}
        {showSmartInput && (
          <div style={{ marginTop: '4px' }}>
            <SmartBetInput modalidadeSelecionada={modalidade} onAddPalpites={handleSmartAdd} />
          </div>
        )}
        {isSupportedModalidade ? (
          <>
            <div style={styles.subtitle}>
              Digite sua {modalidade.toLowerCase()} ({expectedDigits} número{expectedDigits === 1 ? '' : 's'}).
            </div>
            <div style={styles.inputRow}>
              <input
                style={styles.input}
                maxLength={expectedDigits || 3}
                value={palpite}
                onChange={(e) => handleChangePalpite(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPalpite(palpite);
                  }
                }}
                placeholder="000"
              />
              <button style={styles.addButton} onClick={addPalpite}>
                Adicionar
              </button>
            </div>
            {palpiteError && <div style={{ color: 'red', fontSize: '12px' }}>{palpiteError}</div>}
            <div style={styles.subtitle}>Palpites adicionados:</div>
            <div style={styles.chips}>
              {palpites.length === 0 && <span style={styles.subtitle}>Nenhum palpite ainda.</span>}
              {palpites.map((p, idx) => (
                <span
                  key={`${p}-${idx}`}
                  style={styles.chip}
                  onClick={() => {
                    const next = palpites.filter((_, i) => i !== idx);
                    setPalpites(next);
                    updateDraft({ palpites: next });
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
            <button
              style={styles.addButton}
              onClick={() => {
                updateDraft({ palpites });
                navigate(`/loterias/${jogo}/valor`);
              }}
            >
              Avançar
            </button>
          </>
        ) : (
          <div style={styles.placeholder}>
            {showSmartInput
              ? 'Use o campo "Copiar e Colar" para adicionar palpites desta modalidade.'
              : 'Modalidade ainda não configurada para palpites. Selecione uma centena.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoteriasPalpitesPage;

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Spinner from '../components/Spinner';
import { getDraft, clearDraft, updateDraft } from '../utils/receipt';
import { useAuth } from '../context/AuthContext';

const LoteriasResumoPage = () => {
  const navigate = useNavigate();
  const { jogo } = useParams();
  const { balance, loadingUser, refreshUser, authError } = useAuth();
  const [draft, setDraft] = useState({});
  const [showBalance, setShowBalance] = useState(true);

  useEffect(() => {
    setDraft(getDraft());
    refreshUser();
  }, [refreshUser]);

  const total = useMemo(() => {
    const valor = Number(draft?.valorAposta) || 0;
    const qtd = draft?.palpites?.length || 0;
    if (!valor) return 0;
    if (draft?.modoValor === 'cada') {
      return valor * Math.max(qtd, 1);
    }
    return valor;
  }, [draft]);

  const valorPorNumero = useMemo(() => {
    const valor = Number(draft?.valorAposta) || 0;
    const qtd = draft?.palpites?.length || 0;
    if (!valor) return 0;
    if (draft?.modoValor === 'cada') return valor;
    return qtd ? valor / qtd : valor;
  }, [draft]);

  useEffect(() => {
    const d = getDraft();
    const apostas = d?.apostas || [];
    const hasCurrent =
      d?.jogo && d?.data && d?.modalidade && (d?.palpites?.length || 0) && d?.valorAposta;
    if (hasCurrent && !d?.currentSaved) {
      const valor = Number(d?.valorAposta) || 0;
      const qtd = d?.palpites?.length || 0;
      const totalCalc = d?.modoValor === 'cada' ? valor * Math.max(qtd, 1) : valor;
      const valorNumero = d?.modoValor === 'cada' ? valor : qtd ? valor / qtd : valor;
      const novaAposta = {
        jogo: d.jogo,
        data: d.data,
        modalidade: d.modalidade,
        colocacao: d.colocacao,
        palpites: d.palpites,
        modoValor: d.modoValor,
        valorAposta: valor,
        valorPorNumero: valorNumero,
        total: totalCalc,
      };
      const atualizado = {
        ...d,
        apostas: [...apostas, novaAposta],
        currentSaved: true,
      };
      updateDraft(atualizado);
      setDraft(atualizado);
    } else {
      setDraft(d);
    }
  }, []);

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
      gap: '4px',
      fontSize: '14px',
    },
    betList: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    betCard: {
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      padding: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      color: '#166534',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    chips: {
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
    actionRow: {
      display: 'flex',
      gap: '10px',
      width: '100%',
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
    primary: {
      background: '#166534',
      color: '#fff',
    },
    secondary: {
      background: '#e5e7eb',
      color: '#111827',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.navbar}>
        <span style={styles.brand}>Panda Loterias</span>
        <span style={styles.saldo}>
          {loadingUser ? (
            <Spinner size={18} />
          ) : (
            `Saldo: ${showBalance ? `R$ ${(balance ?? 0).toFixed(2).replace('.', ',')}` : '••••'}`
          )}
          {!loadingUser && (
            <span onClick={() => setShowBalance((prev) => !prev)} style={{ cursor: 'pointer' }}>
              {showBalance ? <FaEyeSlash /> : <FaEye />}
            </span>
          )}
        </span>
        <div style={styles.backWrapper}>
          <button style={styles.backButton} onClick={() => navigate(`/loterias/${jogo}/valor`)}>
            Voltar
          </button>
        </div>
      </div>

      {authError && <div style={{ color: 'red' }}>{authError}</div>}

      <div style={styles.card}>
        <div style={styles.title}>Resumo das apostas</div>
        <div style={styles.betList}>
          {(draft?.apostas || []).map((ap, idx) => (
            <div key={idx} style={styles.betCard}>
              <div style={styles.totalRow}>
                <span>{ap.jogo || 'Jogo'}</span>
                <span>{ap.data || ''}</span>
              </div>
              {ap.modalidade && <span>Modalidade: {ap.modalidade}</span>}
              {ap.colocacao && <span>Colocação: {ap.colocacao}</span>}
              <span>Quantidade de palpites: {ap?.palpites?.length || 0}</span>
              {ap?.palpites?.length ? (
                <div style={styles.chips}>
                  {ap.palpites.map((p, i) => (
                    <span key={`${p}-${i}`} style={styles.chip}>
                      {p}
                    </span>
                  ))}
                </div>
              ) : null}
              <span>Aplicação do valor: {ap?.modoValor === 'cada' ? 'Cada palpite' : 'Todos (valor total)'}</span>
              <div style={styles.totalRow}>
                <span>Valor por número:</span>
                <span>R$ {(ap.valorPorNumero || 0).toFixed(2).replace('.', ',')}</span>
              </div>
              <div style={styles.totalRow}>
                <span>Valor total:</span>
                <span>R$ {(ap.total || 0).toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.actions}>
          <div style={styles.actionRow}>
            <button
              style={{ ...styles.actionBtn, ...styles.secondary }}
              onClick={() => navigate(`/loterias/${jogo}/palpites`)}
            >
              Editar palpites
            </button>
            <button
              style={{ ...styles.actionBtn, ...styles.secondary }}
              onClick={() => navigate(`/loterias/${jogo}/valor`)}
            >
              Editar valor
            </button>
            <button
              style={{ ...styles.actionBtn, ...styles.secondary }}
              onClick={() => navigate(`/loterias/${jogo}/modalidades`)}
            >
              Fazer mais apostas
            </button>
          </div>
          <button
            style={{ ...styles.actionBtn, ...styles.primary, width: '100%' }}
            onClick={() => {
              navigate('/loterias-sorteios');
            }}
          >
            Avançar
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoteriasResumoPage;

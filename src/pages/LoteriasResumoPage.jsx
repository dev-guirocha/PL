import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiTrash2 } from 'react-icons/fi';
import { getDraft, updateDraft } from '../utils/receipt';
import { useAuth } from '../context/AuthContext';
import { formatDateBR } from '../utils/date';
import { CAN_CHOOSE_COLOCACAO, COLOCACOES } from '../constants/games';

const LoteriasResumoPage = () => {
  const navigate = useNavigate();
  const { jogo } = useParams();
  const { refreshUser, authError } = useAuth();
  const [draft, setDraft] = useState({});
  const [showValendo, setShowValendo] = useState(false);
  const [valendoModalidade, setValendoModalidade] = useState('');
  const [valendoColocacao, setValendoColocacao] = useState('');
  const [valendoValor, setValendoValor] = useState('');
  const [valendoModoValor, setValendoModoValor] = useState('todos');

  useEffect(() => {
    setDraft(getDraft());
    refreshUser();
  }, [refreshUser]);

  const isValendoLocked = !!draft?.valendo?.locked;

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

  const safeDigits = (s) => String(s || '').replace(/\D/g, '');

  const calculateGroupFrom2 = (twoDigits) => {
    const n = Number(twoDigits);
    if (Number.isNaN(n)) return '';
    if (n === 0) return '25';
    return String(Math.ceil(n / 4));
  };

  const inferBaseDigits = (apostas) => {
    const all = (apostas || []).flatMap((a) => a?.palpites || []);
    const has4 = all.some((p) => safeDigits(p).length === 4);
    if (has4) return 4;
    const has3 = all.some((p) => safeDigits(p).length === 3);
    if (has3) return 3;
    return null;
  };

  const getValendoBase = (d) => {
    const a0 = (d?.apostas || [])[0];
    const basePalpites = (a0?.palpites || []).map(safeDigits).filter(Boolean);
    const baseDigits = inferBaseDigits(d?.apostas) || (basePalpites[0] ? safeDigits(basePalpites[0]).length : null);
    return { basePalpites, baseDigits };
  };

  const VALENDO_SUPPORTED = [
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

  const buildValendoMenu = (d) => {
    const { baseDigits } = getValendoBase(d);
    if (baseDigits === 3) {
      return VALENDO_SUPPORTED.filter((m) => !m.includes('MILHAR'));
    }
    if (baseDigits === 4) {
      return VALENDO_SUPPORTED;
    }
    return [];
  };

  const derivePalpites = (basePalpites, baseDigits, modalidadeDestino) => {
    const out = [];
    const push = (v) => {
      const x = safeDigits(v);
      if (!x) return;
      out.push(x);
    };

    for (const raw of basePalpites || []) {
      const n = safeDigits(raw);
      if (!n) continue;
      if (baseDigits === 4 && n.length !== 4) continue;
      if (baseDigits === 3 && n.length !== 3) continue;

      const first2 = n.slice(0, 2);
      const mid2 = n.slice(1, 3);
      const last2 = n.slice(-2);
      const first3 = n.slice(0, 3);
      const last3 = n.slice(-3);

      switch (modalidadeDestino) {
        case 'MILHAR':
        case 'MILHAR INV':
        case 'MILHAR E CT':
          push(n);
          break;
        case 'CENTENA':
        case 'CENTENA INV':
          push(baseDigits === 4 ? last3 : n);
          break;
        case 'CENTENA ESQUERDA':
        case 'CENTENA INV ESQ':
          push(baseDigits === 4 ? first3 : n);
          break;
        case 'DEZENA':
          push(last2);
          break;
        case 'DEZENA ESQ':
          push(first2);
          break;
        case 'DEZENA MEIO':
          push(mid2);
          break;
        case 'UNIDADE':
          push(n.slice(-1));
          break;
        case 'GRUPO':
          push(calculateGroupFrom2(last2));
          break;
        default:
          break;
      }
    }

    const uniq = Array.from(new Set(out));
    const expectedLen = (() => {
      if (modalidadeDestino.startsWith('MILHAR')) return 4;
      if (modalidadeDestino.startsWith('CENTENA')) return 3;
      if (modalidadeDestino.startsWith('DEZENA')) return 2;
      if (modalidadeDestino === 'UNIDADE') return 1;
      if (modalidadeDestino === 'GRUPO') return null;
      return null;
    })();
    const filtered = expectedLen ? uniq.filter((p) => safeDigits(p).length === expectedLen) : uniq;
    return filtered;
  };

  const openValendo = () => {
    const d = getDraft();
    const menu = buildValendoMenu(d);
    if (!menu.length) return;

    if (!d?.valendo?.locked) {
      const { basePalpites, baseDigits } = getValendoBase(d);
      updateDraft({
        ...d,
        valendo: {
          locked: true,
          baseDigits,
          basePalpites,
        },
      });
      setDraft(getDraft());
    }

    setValendoModalidade('');
    setValendoColocacao('');
    setValendoValor('');
    setValendoModoValor('todos');
    setShowValendo(true);
  };

  const confirmValendo = () => {
    const d = getDraft();
    const apostas = d?.apostas || [];
    if (!apostas.length) return;
    const base = d?.valendo || {};
    const baseDigits = base?.baseDigits;
    const basePalpites = base?.basePalpites || [];

    if (!valendoModalidade) return;
    if (valendoModalidade === 'MILHAR E CT' && baseDigits !== 4) return;
    if (valendoModalidade.includes('MILHAR') && baseDigits !== 4) return;

    const needsColoc = CAN_CHOOSE_COLOCACAO.includes(valendoModalidade);
    if (needsColoc && !valendoColocacao) return;

    const rawDigits = String(valendoValor || '').replace(/\D/g, '');
    const parsedValor = rawDigits ? Number(rawDigits) / 100 : 0;
    if (!parsedValor || parsedValor <= 0) return;

    const palpites = derivePalpites(basePalpites, baseDigits, valendoModalidade);
    if (!palpites.length) return;

    const qtd = palpites.length;
    const isCada = valendoModoValor === 'cada';
    const totalCalc = isCada ? parsedValor * Math.max(qtd, 1) : parsedValor;
    const valorNumero = isCada ? parsedValor : qtd ? parsedValor / qtd : parsedValor;

    const novaLinha = {
      jogo: apostas[0]?.jogo || d?.jogo || '',
      data: apostas[0]?.data || d?.data || '',
      modalidade: valendoModalidade,
      colocacao: needsColoc ? valendoColocacao : apostas[0]?.colocacao || null,
      palpites,
      modoValor: isCada ? 'cada' : 'todos',
      valorAposta: parsedValor,
      valorPorNumero: valorNumero,
      total: totalCalc,
      isValendo: true,
    };

    const updated = { ...d, apostas: [...apostas, novaLinha], currentSaved: true };
    updateDraft(updated);
    setDraft(updated);
    setShowValendo(false);
  };

  const handleRemoveAposta = (idx) => {
    const current = getDraft();
    const existing = current?.apostas || [];
    const next = existing.filter((_, i) => i !== idx);
    const updated = { ...current, apostas: next };
    if (!next.length) {
      updated.valendo = { locked: false, baseDigits: null, basePalpites: [] };
    }
    updateDraft(updated);
    setDraft(updated);
  };

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

  const valendoMenu = useMemo(() => buildValendoMenu(draft), [draft]);
  const canShowValendoBtn = useMemo(() => {
    const hasApostas = (draft?.apostas || []).length > 0;
    const baseDigits = draft?.valendo?.baseDigits || inferBaseDigits(draft?.apostas);
    return hasApostas && (baseDigits === 3 || baseDigits === 4) && valendoMenu.length;
  }, [draft, valendoMenu]);

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
          onClick={() => navigate(`/loterias/${jogo}/valor`)}
        >
          Voltar
        </button>
      </div>

      {authError && <div style={{ color: 'red' }}>{authError}</div>}

      <div style={styles.card}>
        <div style={styles.title}>Resumo das apostas</div>
        <div style={styles.betList}>
          {(draft?.apostas || []).map((ap, idx) => (
            <div key={idx} style={styles.betCard}>
              <div style={{ ...styles.totalRow, alignItems: 'center', gap: '8px' }}>
                <span>{ap.jogo || 'Jogo'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{formatDateBR(ap.data) || ''}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAposta(idx)}
                    style={{
                      border: '1px solid #fecaca',
                      background: '#fff',
                      color: '#b91c1c',
                      borderRadius: '8px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
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
              onClick={() => !isValendoLocked && navigate(`/loterias/${jogo}/palpites`)}
              disabled={isValendoLocked}
            >
              Editar palpites
            </button>
            <button
              style={{ ...styles.actionBtn, ...styles.secondary }}
              onClick={() => !isValendoLocked && navigate(`/loterias/${jogo}/valor`)}
              disabled={isValendoLocked}
            >
              Editar valor
            </button>

            {canShowValendoBtn && (
              <button
                style={{ ...styles.actionBtn, ...styles.secondary, border: '2px solid #166534' }}
                onClick={openValendo}
              >
                VALENDO
              </button>
            )}
            <button
              style={{ ...styles.actionBtn, ...styles.secondary }}
              onClick={() => {
                // Reseta apenas o rascunho atual para começar uma nova aposta sem reutilizar palpites já digitados.
                updateDraft({
                  modalidade: null,
                  colocacao: null,
                  palpites: [],
                  valorAposta: null,
                  modoValor: null,
                  currentSaved: false,
                  valendo: { locked: false, baseDigits: null, basePalpites: [] },
                });
                navigate(`/loterias/${jogo}/modalidades`);
              }}
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

      {showValendo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setShowValendo(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#fff',
              borderRadius: 16,
              padding: 16,
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 'bold', color: '#166534', fontSize: 18 }}>
              VALENDO — adicionar linha na mesma PULE
            </div>

            <div style={{ fontSize: 12, color: '#64748b' }}>
              Números travados até finalizar ou clicar em “Fazer mais apostas”.
            </div>

            <label style={{ fontSize: 12, color: '#111827', fontWeight: 'bold' }}>Modalidade</label>
            <select
              value={valendoModalidade}
              onChange={(e) => {
                setValendoModalidade(e.target.value);
                setValendoColocacao('');
              }}
              style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}
            >
              <option value="">Selecione</option>
              {valendoMenu.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {valendoModalidade && CAN_CHOOSE_COLOCACAO.includes(valendoModalidade) && (
              <>
                <label style={{ fontSize: 12, color: '#111827', fontWeight: 'bold' }}>Colocação</label>
                <select
                  value={valendoColocacao}
                  onChange={(e) => setValendoColocacao(e.target.value)}
                  style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}
                >
                  <option value="">Selecione</option>
                  {COLOCACOES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </>
            )}

            <label style={{ fontSize: 12, color: '#111827', fontWeight: 'bold' }}>Valor</label>
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={valendoValor}
              onChange={(e) => setValendoValor(e.target.value)}
              style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, fontSize: 16 }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setValendoModoValor('todos')}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: valendoModoValor === 'todos' ? '#dcfce7' : '#fff',
                  fontWeight: 'bold',
                  color: '#166534',
                }}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setValendoModoValor('cada')}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: valendoModoValor === 'cada' ? '#dcfce7' : '#fff',
                  fontWeight: 'bold',
                  color: '#166534',
                }}
              >
                Cada número
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff' }}
                onClick={() => setShowValendo(false)}
              >
                Cancelar
              </button>
              <button
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  border: 'none',
                  background: '#166534',
                  color: '#fff',
                  fontWeight: 'bold',
                }}
                onClick={confirmValendo}
              >
                Adicionar linha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoteriasResumoPage;

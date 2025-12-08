import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import api from '../utils/api';
import Spinner from '../components/Spinner';
import './PulesPage.css';

const PulesPage = () => {
  const navigate = useNavigate();
  const [bets, setBets] = useState([]);
  const [balance, setBalance] = useState(null);
  const [showBalance, setShowBalance] = useState(true);
  const [error, setError] = useState('');
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingBets, setLoadingBets] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchBets = async (nextPage = 1, replace = false) => {
    setLoadingBets(true);
    try {
      const res = await api.get('/bets', { params: { page: nextPage, pageSize: 10 } });
      const newBets = res.data?.bets || [];
      setBets((prev) => (replace ? newBets : [...prev, ...newBets]));
      setHasMore(Boolean(res.data?.hasMore));
      setPage(nextPage);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar pules.');
    } finally {
      setLoadingBets(false);
    }
  };

  useEffect(() => {
    const loggedIn = localStorage.getItem('loggedIn') || sessionStorage.getItem('loggedIn');
    if (!loggedIn) {
      setError('Faça login para ver o saldo e suas pules.');
      setLoadingBalance(false);
      setLoadingBets(false);
      return;
    }

    const fetchBalance = async () => {
      setLoadingBalance(true);
      try {
        const res = await api.get('/wallet/me');
        setBalance(res.data.balance ?? 0);
      } catch (err) {
        setError(err.response?.data?.error || 'Erro ao carregar saldo.');
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchBalance();
    fetchBets(1, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;
  const isInitialBetsLoading = loadingBets && bets.length === 0;

  return (
    <div className="pules-page">
      <div className="pules-hero">
        <div className="pules-title">Pandas PULES</div>
        <div className="pules-balance">
          {loadingBalance ? (
            <Spinner size={18} />
          ) : (
            <>
              Saldo: {showBalance ? formatCurrency(balance ?? 0) : '••••'}
              <button
                type="button"
                className="pules-eye"
                onClick={() => setShowBalance((prev) => !prev)}
                aria-label="Alternar visibilidade do saldo"
              >
                {showBalance ? <FaEyeSlash /> : <FaEye />}
              </button>
            </>
          )}
        </div>
        <button className="pules-back" onClick={() => navigate('/home')}>
          Voltar
        </button>
      </div>

      {error && <div className="pules-error">{error}</div>}

      <div className="pules-list">
        {isInitialBetsLoading && (
          <div className="pules-loading">
            <Spinner size={32} />
          </div>
        )}

        {!isInitialBetsLoading && bets.length === 0 && (
          <div className="pules-empty">Nenhuma PULE encontrada.</div>
        )}

        {bets.map((pule) => (
          <div key={pule.id} className="pules-card">
            <div className="pules-card-header">
              <span>{pule.loteria || 'Loteria'}</span>
              <span className="text-xs text-gray-600">{pule.betRef || `${pule.userId || ''}-${pule.id}`}</span>
              <span>{new Date(pule.createdAt).toLocaleString('pt-BR')}</span>
            </div>
            {pule.codigoHorario && <span className="pules-subtext">Horário: {pule.codigoHorario}</span>}
            {(pule.apostas || []).map((ap, i) => (
              <div key={`${pule.id}-ap-${i}`} className="pules-aposta">
                <div className="pules-aposta-header">
                  <span>{ap.modalidade || ap.jogo || 'Aposta'}</span>
                  <span className="pules-subtext">{ap.data || ''}</span>
                </div>
                {ap.colocacao && <span className="pules-subtext">Prêmio: {ap.colocacao}</span>}
                <span className="pules-subtext">Qtd palpites: {ap.palpites?.length || 0}</span>
                {ap.palpites?.length ? (
                  <div className="pules-chips">
                    {ap.palpites.map((n, j) => (
                      <span key={`${n}-${j}`} className="pules-chip">
                        {n}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="pules-row">
                  <span>Valor por número:</span>
                  <span>{formatCurrency(ap.valorPorNumero || ap.valorAposta)}</span>
                </div>
                <div className="pules-row">
                  <span>Valor da aposta:</span>
                  <span>{formatCurrency(ap.total)}</span>
                </div>
              </div>
            ))}
            <div className="pules-total">
              <span>Total:</span>
              <span>{formatCurrency(pule.total)}</span>
            </div>
          </div>
        ))}

        {hasMore && (
          <div className="pules-loadmore">
            <button disabled={loadingBets} onClick={() => !loadingBets && fetchBets(page + 1, false)}>
              {loadingBets ? <Spinner size={18} /> : 'Carregar mais'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PulesPage;

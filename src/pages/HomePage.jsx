import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBars, FaEye, FaEyeSlash, FaWhatsapp, FaDice, FaTicketAlt, FaGamepad, FaQrcode } from 'react-icons/fa'; // Ícones de exemplo
import axios from 'axios';

const HomePage = () => {
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState({
    id: '',
    name: '',
    balance: 0,
    bonus: 0,
  });
  const [error, setError] = useState('');

  const toggleBalance = () => setShowBalance(!showBalance);

  const api = axios.create({
    baseURL: import.meta?.env?.VITE_API_BASE_URL || '/api',
  });

  const getAuthData = () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const rawUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    const user = rawUser ? JSON.parse(rawUser) : null;
    return { token, user };
  };

  const fetchBalance = async () => {
    setLoading(true);
    setError('');
    const { token, user } = getAuthData();
    if (!token || !user) {
      navigate('/');
      return;
    }

    try {
      const res = await api.get('/wallet/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserData({
        id: res.data.id,
        name: res.data.name,
        balance: res.data.balance,
        bonus: res.data.bonus,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar saldo.');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const simulateDeposit = async () => {
    const { token } = getAuthData();
    if (!token) {
      navigate('/');
      return;
    }
    setError('');
    try {
      const res = await api.post(
        '/wallet/deposit',
        { amount: 20 },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setUserData((prev) => ({
        ...prev,
        balance: res.data.balance,
        bonus: res.data.bonus,
      }));
      alert('Depósito simulado de R$ 20,00 realizado.');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao simular depósito.');
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Estilos Inline (Mantendo o padrão do seu projeto)
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#ffffff', // Fundo Branco
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    },
    navbar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '15px 20px',
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #eee',
    },
    menuIcon: {
      fontSize: '24px',
      cursor: 'pointer',
      color: '#333',
    },
    userId: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#166534', // Verde do tema
      letterSpacing: '1px',
    },
    headerSpace: {
      width: '24px', // Espaço vazio para equilibrar o ícone da esquerda
    },
    balanceSection: {
      textAlign: 'center',
      padding: '20px 0',
      backgroundColor: '#f9f9f9',
      marginBottom: '20px',
    },
    balanceLabel: {
      fontSize: '14px',
      color: '#666',
      marginBottom: '5px',
    },
    balanceValue: {
      fontSize: '32px',
      fontWeight: 'bold',
      color: '#333',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
    },
    bonusText: {
      fontSize: '14px',
      color: '#22c55e', // Verde bônus
      marginTop: '5px',
    },
    eyeButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '20px',
      color: '#666',
      display: 'flex',
      alignItems: 'center',
    },
    gridContainer: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr', // 2 colunas iguais
      gap: '15px',
      padding: '0 20px 40px 20px', // Padding inferior maior
      maxWidth: '600px', // Limite de largura para não ficar gigante em PC
      margin: '0 auto', // Centralizar na tela
      width: '100%',
      boxSizing: 'border-box',
    },
    card: {
      aspectRatio: '1 / 1', // Garante que seja sempre quadrado
      backgroundColor: '#dcfce7', // Fundo levemente verde
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
      transition: 'transform 0.1s',
      color: '#166534',
      textAlign: 'center',
      padding: '10px',
    },
    cardTitle: {
      marginTop: '10px',
      fontWeight: 'bold',
      fontSize: '16px',
    },
    iconSize: {
      fontSize: '40px',
    },
    // Estilo especial para os containers 6 e 7 (Grid interno)
    miniGridCard: {
      aspectRatio: '1 / 1',
      backgroundColor: '#f0fdf4',
      borderRadius: '16px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gap: '5px',
      padding: '8px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
    },
    miniItem: {
      backgroundColor: '#bbf7d0', // Verde mais escuro que o fundo
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      color: '#166534',
      fontWeight: 'bold',
    },
  };

  return (
    <div style={styles.container}>
      {/* 1. Navbar Burger + ID */}
      <div style={styles.navbar}>
        <FaBars style={styles.menuIcon} />
        <span style={styles.userId}>ID: {userData.id || '---'}</span>
        <div style={styles.headerSpace}></div>
      </div>

      {/* 2. Saldo e Bônus */}
      <div style={styles.balanceSection}>
        <div style={styles.balanceLabel}>Seu Saldo Disponível</div>
        {loading ? (
          <div style={styles.balanceValue}>Carregando...</div>
        ) : (
          <>
            <div style={styles.balanceValue}>
              R$ {showBalance ? userData.balance.toFixed(2).replace('.', ',') : '••••'}
              <button style={styles.eyeButton} onClick={toggleBalance}>
                {showBalance ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <div style={styles.bonusText}>
              Bônus: R$ {showBalance ? userData.bonus.toFixed(2).replace('.', ',') : '••••'}
            </div>
          </>
        )}
        {error && <div style={{ color: 'red', marginTop: '8px' }}>{error}</div>}
      </div>

      {/* 3. Grid Principal de botões */}
      <div style={styles.gridContainer}>
        
        {/* Container 1: Loterias */}
        <div style={styles.card} onClick={() => console.log('Ir para Loterias')}>
          <FaTicketAlt style={styles.iconSize} />
          <span style={styles.cardTitle}>Loterias</span>
        </div>

        {/* Container 2: Casino */}
        <div style={styles.card} onClick={() => console.log('Ir para Casino')}>
          <FaDice style={styles.iconSize} />
          <span style={styles.cardTitle}>Casino</span>
        </div>

        {/* Container 3: Bingo */}
        <div style={styles.card} onClick={() => console.log('Ir para Bingo')}>
          <FaGamepad style={styles.iconSize} />
          <span style={styles.cardTitle}>Bingo</span>
        </div>

        {/* Container 4: Suporte */}
        <div style={styles.card} onClick={() => window.open('https://wa.me/seunumero', '_blank')}>
          <FaWhatsapp style={styles.iconSize} />
          <span style={styles.cardTitle}>Suporte</span>
        </div>

        {/* Container 5: Recarga Pix */}
        <div style={styles.card} onClick={simulateDeposit}>
          <FaQrcode style={styles.iconSize} />
          <span style={styles.cardTitle}>Recarga Pix</span>
        </div>

        {/* Container 6: Composto (Visual Provisório) */}
        <div style={styles.miniGridCard}>
            <div style={styles.miniItem}>A</div>
            <div style={styles.miniItem}>B</div>
            <div style={styles.miniItem}>C</div>
            <div style={styles.miniItem}>D</div>
        </div>

        {/* Container 7: Composto (Visual Provisório) */}
        <div style={styles.miniGridCard}>
            <div style={styles.miniItem}>1</div>
            <div style={styles.miniItem}>2</div>
            <div style={styles.miniItem}>3</div>
            <div style={styles.miniItem}>4</div>
        </div>

      </div>
    </div>
  );
};

export default HomePage;

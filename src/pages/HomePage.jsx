import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaBars,
  FaEye,
  FaEyeSlash,
  FaHome,
  FaUser,
  FaTicketAlt,
  FaDice,
  FaGamepad,
  FaTrophy,
  FaCheckCircle,
  FaChartBar,
  FaFileAlt,
  FaQrcode,
  FaMoneyCheckAlt,
  FaCog,
  FaLifeRing,
  FaSignOutAlt,
  FaWallet,
} from 'react-icons/fa';
import axios from 'axios';
import casinoImg from '../assets/images/casino.jpeg';
import bingoImg from '../assets/images/bingo.jpeg';
import suporteImg from '../assets/images/suporte.jpeg';
import pixImg from '../assets/images/pix.jpeg';
import loteriasImg from '../assets/images/loterias.jpeg';

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
  const [showMenu, setShowMenu] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

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

  const createPixCharge = async () => {
    const { token } = getAuthData();
    if (!token) {
      navigate('/');
      return;
    }
    setError('');
    try {
      const res = await api.post(
        '/pix/charge',
        { amount: 20 },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const copy = res.data?.copyAndPaste || 'Cobrança Pix criada.';
      alert(`Copie e cole no seu app bancário:\n\n${copy}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao gerar cobrança Pix.');
    }
  };

  const openSupport = () => {
    const phone = '55799989357214'; // (79) 99893-57214
    const message = `Olá Promotor, preciso de ajuda, meu código de unidade é: ${userData.id || 'ID'}`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const closeMenu = () => setShowMenu(false);

  const menuItems = [
    { label: 'Início', icon: <FaHome />, action: () => navigate('/home') },
    { label: 'Perfil', icon: <FaUser />, action: () => navigate('/perfil') },
    { label: 'Loterias', icon: <FaTicketAlt />, action: () => navigate('/loterias') },
    { label: 'Casino', icon: <FaDice />, action: () => window.open('https://pandaloterias.com.br', '_blank') },
    { label: 'Bingo', icon: <FaGamepad />, action: () => alert('Bingo ainda está em implementação.') },
    { label: 'Premiadas', icon: <FaTrophy />, action: () => {} },
    { label: 'Validar Pule', icon: <FaCheckCircle />, action: () => {} },
    { label: 'Resultados', icon: <FaChartBar />, action: () => {} },
    { label: 'Relatórios', icon: <FaFileAlt />, action: () => {} },
    { label: 'Recarga PIX', icon: <FaQrcode />, action: () => createPixCharge() },
    { label: 'Solicitar saque', icon: <FaMoneyCheckAlt />, action: () => {} },
    { label: 'Configurações', icon: <FaCog />, action: () => navigate('/configuracoes') },
    { label: 'Suporte', icon: <FaLifeRing />, action: () => openSupport() },
    { label: 'Pules', icon: <FaTicketAlt />, action: () => navigate('/pules') },
    {
      label: 'Sair',
      icon: <FaSignOutAlt />,
      action: () => {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        navigate('/');
      },
    },
  ];

  const renderMenu = () => {
    if (!showMenu) return null;
    return (
      <>
        <div style={styles.menuOverlay} onClick={closeMenu} />
        <div style={styles.sideMenu}>
          <div style={styles.menuHeader}>
            <span>Menu</span>
            <button
              onClick={closeMenu}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
            >
              ✕
            </button>
          </div>
          {menuItems.map((item) => (
            <div
              key={item.label}
              style={styles.menuItem}
              onClick={() => {
                closeMenu();
                item.action();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </>
    );
  };

  const shortcutItems = [
    { label: 'Resultados', icon: <FaChartBar />, action: () => {} },
    { label: 'Relatórios', icon: <FaFileAlt />, action: () => {} },
    { label: 'Premiadas', icon: <FaTrophy />, action: () => {} },
    { label: 'Saldo', icon: <FaWallet />, action: () => {} },
  ];

  const renderShortcuts = () => {
    if (!showShortcuts) return null;
    return (
      <div style={styles.shortcutOverlay} onClick={() => setShowShortcuts(false)}>
        <div style={styles.shortcutBox} onClick={(e) => e.stopPropagation()}>
          <div style={styles.shortcutTitle}>Atalho</div>
          {shortcutItems.map((item) => (
            <div
              key={item.label}
              style={styles.shortcutItem}
              onClick={() => {
                setShowShortcuts(false);
                item.action();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
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
    menuOverlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.4)',
      zIndex: 20,
    },
    sideMenu: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '260px',
      height: '100%',
      background: '#ffffff',
      boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
      padding: '20px 15px',
      zIndex: 30,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    menuHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '10px',
      fontWeight: 'bold',
      color: '#166534',
    },
    menuItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px',
      borderRadius: '10px',
      cursor: 'pointer',
      color: '#166534',
      background: '#f0fdf4',
    },
    shortcutOverlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.3)',
      zIndex: 25,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    },
    shortcutBox: {
      background: '#fff',
      borderRadius: '14px',
      padding: '16px',
      boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
      minWidth: '240px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    shortcutTitle: {
      fontWeight: 'bold',
      color: '#166534',
      marginBottom: '6px',
    },
    shortcutItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px',
      borderRadius: '10px',
      cursor: 'pointer',
      background: '#f0fdf4',
      color: '#166534',
    },
    navbar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '15px 20px',
      backgroundColor: '#bbf7d0',
      borderBottom: '1px solid #9ed8b6',
      gap: '12px',
    },
    brand: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#166534',
      letterSpacing: '1px',
      flex: 1,
    },
    menuRight: {
      flex: 1,
      display: 'flex',
      justifyContent: 'flex-end',
    },
    menuIcon: {
      fontSize: '24px',
      cursor: 'pointer',
      color: '#166534',
    },
    userId: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#166534', // Verde do tema
      letterSpacing: '1px',
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
      position: 'relative',
      overflow: 'hidden',
    },
    cardTitle: {
      marginTop: '4px',
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
      fontSize: '28px',
      color: '#166534',
      fontWeight: 'bold',
    },
  };

    return (
      <div style={styles.container}>
        {renderMenu()}
        {renderShortcuts()}
        {/* 1. Navbar Burger + ID */}
        <div style={styles.navbar}>
          <span style={styles.brand}>Panda Loterias</span>
          <span style={{ ...styles.userId, flex: 1, textAlign: 'center' }}>ID: {userData.id || '---'}</span>
          <div style={styles.menuRight}>
            <FaBars style={styles.menuIcon} onClick={() => setShowMenu(true)} />
          </div>
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
        <div
          style={{
            ...styles.card,
            backgroundImage: `url(${loteriasImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={() => navigate('/loterias')}
        />

        {/* Container 2: Casino */}
        <div
          style={{
            ...styles.card,
            backgroundImage: `url(${casinoImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={() => window.open('https://pandaloterias.com.br', '_blank')}
        />

        {/* Container 3: Bingo */}
        <div
          style={{
            ...styles.card,
            backgroundImage: `url(${bingoImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={() => alert('Bingo ainda está em implementação.')}
        />

        {/* Container 4: Suporte */}
        <div
          style={{
            ...styles.card,
            backgroundImage: `url(${suporteImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={openSupport}
        />

        {/* Container 5: Recarga Pix */}
        <div
          style={{
            ...styles.card,
            backgroundImage: `url(${pixImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={createPixCharge}
        />

        {/* Container 6: Atalhos */}
        <div style={styles.miniGridCard} onClick={() => setShowShortcuts(true)}>
            <div style={styles.miniItem}>
              <FaChartBar />
            </div>
            <div style={styles.miniItem}>
              <FaFileAlt />
            </div>
            <div style={styles.miniItem}>
              <FaTrophy />
            </div>
            <div style={styles.miniItem}>
              <FaWallet />
            </div>
        </div>

        {/* Container 7: Composto (Visual Provisório) */}
        <div style={styles.miniGridCard}>
            <div style={styles.miniItem} onClick={() => { /* Prêmio */ }}>🎁</div>
            <div style={styles.miniItem} onClick={() => { /* Horóscopo */ }}>♌</div>
            <div style={styles.miniItem} onClick={() => { /* Sonhos */ }}>💤</div>
            <div style={styles.miniItem} onClick={() => { /* Atrasados */ }}>⏰</div>
        </div>

      </div>
    </div>
  );
};

export default HomePage;

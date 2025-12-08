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
import api from '../utils/api';
import Spinner from '../components/Spinner';
import styles from './HomePage.module.css';
import { toast } from 'react-toastify';
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

  const getAuthData = () => {
    const rawUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    const user = rawUser ? JSON.parse(rawUser) : null;
    const loggedIn = localStorage.getItem('loggedIn') || sessionStorage.getItem('loggedIn');
    return { loggedIn, user };
  };

  const fetchBalance = async () => {
    setLoading(true);
    setError('');
    const { loggedIn, user } = getAuthData();
    if (!loggedIn || !user) {
      navigate('/');
      return;
    }

    try {
      const res = await api.get('/wallet/me');
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
    const { loggedIn } = getAuthData();
    if (!loggedIn) {
      navigate('/');
      return;
    }
    setError('');
    try {
      const res = await api.post('/pix/charge', { amount: 20 });
      const copy = res.data?.copyAndPaste || 'Cobrança Pix criada.';
      toast.info(`Copie e cole no seu app bancário:\n${copy}`, { autoClose: 5000 });
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
    { label: 'Bingo', icon: <FaGamepad />, action: () => toast.info('Bingo ainda está em implementação.') },
    { label: 'Premiadas', icon: <FaTrophy />, action: () => {} },
    { label: 'Validar Pule', icon: <FaCheckCircle />, action: () => {} },
    { label: 'Resultados', icon: <FaChartBar />, action: () => {} },
    { label: 'Relatórios', icon: <FaFileAlt />, action: () => navigate('/relatorios') },
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
        localStorage.removeItem('loggedIn');
        sessionStorage.removeItem('loggedIn');
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
        <div className={styles.menuOverlay} onClick={closeMenu} />
        <div className={styles.sideMenu}>
          <div className={styles.menuHeader}>
            <span>Menu</span>
            <button onClick={closeMenu} className={styles.menuClose}>
              ✕
            </button>
          </div>
          {menuItems.map((item) => (
            <div
              key={item.label}
              className={styles.menuItem}
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
    { label: 'Relatórios', icon: <FaFileAlt />, action: () => navigate('/relatorios') },
    { label: 'Premiadas', icon: <FaTrophy />, action: () => {} },
    { label: 'Saldo', icon: <FaWallet />, action: () => navigate('/relatorios/consulta-saldo') },
  ];

  const renderShortcuts = () => {
    if (!showShortcuts) return null;
    return (
      <div className={styles.shortcutOverlay} onClick={() => setShowShortcuts(false)}>
        <div className={styles.shortcutBox} onClick={(e) => e.stopPropagation()}>
          <div className={styles.shortcutTitle}>Atalho</div>
          {shortcutItems.map((item) => (
            <div
              key={item.label}
              className={styles.shortcutItem}
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

    return (
      <div className={styles.container}>
        {renderMenu()}
        {renderShortcuts()}
        {/* 1. Navbar Burger + ID */}
        <div className={styles.navbar}>
          <span className={styles.brand}>Panda Loterias</span>
          <span className={`${styles.userId} ${styles.userIdCenter}`}>ID: {userData.id || '---'}</span>
          <div className={styles.menuRight}>
            <FaBars className={styles.menuIcon} onClick={() => setShowMenu(true)} />
          </div>
        </div>

      {/* 2. Saldo e Bônus */}
      <div
        className={styles.balanceSection}
        role="button"
        tabIndex={0}
        onClick={() => navigate('/relatorios/consulta-saldo')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate('/relatorios/consulta-saldo');
          }
        }}
      >
        <div className={styles.balanceLabel}>Seu Saldo Disponível</div>
        {loading ? (
          <div className={styles.balanceValue}>
            <Spinner size={32} />
          </div>
        ) : (
          <>
            <div className={styles.balanceValue}>
              R$ {showBalance ? userData.balance.toFixed(2).replace('.', ',') : '••••'}
              <button
                className={styles.eyeButton}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBalance();
                }}
              >
                {showBalance ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <div className={styles.bonusText}>
              Bônus: R$ {showBalance ? userData.bonus.toFixed(2).replace('.', ',') : '••••'}
            </div>
          </>
        )}
        {error && <div className={styles.error}>{error}</div>}
      </div>

      {/* 3. Grid Principal de botões */}
      <div className={styles.gridContainer}>
        
        {/* Container 1: Loterias */}
        <div
          className={styles.card}
          style={{
            backgroundImage: `url(${loteriasImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={() => navigate('/loterias')}
        />

        {/* Container 2: Casino */}
        <div
          className={styles.card}
          style={{
            backgroundImage: `url(${casinoImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={() => window.open('https://pandaloterias.com.br', '_blank')}
        />

        {/* Container 3: Bingo */}
        <div
          className={styles.card}
          style={{
            backgroundImage: `url(${bingoImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={() => toast.info('Bingo ainda está em implementação.')}
        />

        {/* Container 4: Suporte */}
        <div
          className={styles.card}
          style={{
            backgroundImage: `url(${suporteImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={openSupport}
        />

        {/* Container 5: Recarga Pix */}
        <div
          className={styles.card}
          style={{
            backgroundImage: `url(${pixImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={createPixCharge}
        />

        {/* Container 6: Atalhos */}
        <div className={styles.miniGridCard} onClick={() => setShowShortcuts(true)}>
            <div className={styles.miniItem}>
              <FaChartBar />
            </div>
            <div className={styles.miniItem}>
              <FaFileAlt />
            </div>
            <div className={styles.miniItem}>
              <FaTrophy />
            </div>
            <div className={styles.miniItem}>
              <FaWallet />
            </div>
        </div>

        {/* Container 7: Composto (Visual Provisório) */}
        <div className={styles.miniGridCard}>
            <div className={styles.miniItem} onClick={() => { /* Prêmio */ }}>🎁</div>
            <div className={styles.miniItem} onClick={() => { /* Horóscopo */ }}>♌</div>
            <div className={styles.miniItem} onClick={() => { /* Sonhos */ }}>💤</div>
            <div className={styles.miniItem} onClick={() => { /* Atrasados */ }}>⏰</div>
        </div>

      </div>
    </div>
  );
};

export default HomePage;

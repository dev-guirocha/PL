import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { updateDraft } from '../utils/receipt';
import Spinner from '../components/Spinner';
import { LOTERIAS } from '../constants/games';
import tradicionalImg from '../assets/images/tradicional.jpeg';
import uruguaiaImg from '../assets/images/uruguaia.jpeg';
import quininhaImg from '../assets/images/quininha.jpeg';
import seninhaImg from '../assets/images/seninha.jpeg';
import super15Img from '../assets/images/super15.jpeg';
import repetirImg from '../assets/images/repetir.jpeg';
import { useAuth } from '../context/AuthContext';

const LoteriasPage = () => {
  const navigate = useNavigate();
  const { balance, loadingUser, refreshUser, authError } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  useEffect(() => {
    refreshUser();
  }, [refreshUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const loteriaImageMap = {
    tradicional: tradicionalImg,
    'tradicional-1-10': tradicionalImg,
    uruguaia: uruguaiaImg,
    quininha: quininhaImg,
    seninha: seninhaImg,
    super15: super15Img,
    'repetir-pule': repetirImg,
  };

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
    saldo: { fontWeight: 'bold', color: '#166534', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
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
    list: {
      width: '100%',
      maxWidth: '640px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    card: {
      background: '#fff',
      borderRadius: '12px',
      boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
      cursor: 'pointer',
      border: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px',
      transition: 'transform 0.08s ease',
    },
    cardImage: {
      width: '56px',
      height: '56px',
      objectFit: 'cover',
      borderRadius: '10px',
    },
    cardBody: {
      color: '#166534',
      fontWeight: 'bold',
      fontSize: '16px',
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
          <button style={styles.backButton} onClick={() => navigate('/home')}>
            Voltar
          </button>
        </div>
      </div>

      {authError && <div style={{ color: 'red' }}>{authError}</div>}

      <div style={styles.list}>
        {LOTERIAS.map((item) => (
          <div
            key={item.title}
            style={styles.card}
            onClick={() => {
              const route = `/loterias/${item.slug}`;
              updateDraft({
                jogo: item.title,
                slug: route,
                selecionadoEm: new Date().toISOString(),
              });
              navigate(route);
            }}
          >
            <img src={loteriaImageMap[item.slug]} alt={item.title} style={styles.cardImage} />
            <div style={styles.cardBody}>{item.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoteriasPage;

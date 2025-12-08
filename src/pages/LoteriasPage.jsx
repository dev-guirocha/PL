import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateDraft } from '../utils/receipt';
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
  const { refreshUser, authError } = useAuth();
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
      padding: '12px 20px 40px',
      gap: '16px',
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

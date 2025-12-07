import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SettingsPage = () => {
  const navigate = useNavigate();
  const [allowNotifications, setAllowNotifications] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('allowNotifications');
    if (saved !== null) {
      setAllowNotifications(saved === 'true');
    }
  }, []);

  const toggleNotifications = () => {
    const next = !allowNotifications;
    setAllowNotifications(next);
    localStorage.setItem('allowNotifications', String(next));
  };

  const styles = {
    container: {
      minHeight: '100vh',
      background: '#f9fafb',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      gap: '16px',
      fontFamily: 'Arial, sans-serif',
    },
    navbar: {
      width: '100%',
      background: '#bbf7d0',
      border: '1px solid #9ed8b6',
      borderRadius: '12px',
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
    },
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
    row: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px',
      background: '#f9fafb',
      borderRadius: '10px',
      border: '1px solid #e5e7eb',
    },
    label: { fontWeight: 'bold', color: '#111827' },
    desc: { color: '#6b7280', fontSize: '13px', marginTop: '4px' },
    switch: {
      width: '48px',
      height: '26px',
      borderRadius: '999px',
      background: allowNotifications ? '#22c55e' : '#d1d5db',
      position: 'relative',
      cursor: 'pointer',
      transition: 'background 0.2s ease',
    },
    knob: {
      position: 'absolute',
      top: '3px',
      left: allowNotifications ? '24px' : '3px',
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      background: '#fff',
      transition: 'left 0.2s ease',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    banner: {
      marginTop: '8px',
      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
      color: '#fff',
      borderRadius: '14px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
    },
    bannerButton: {
      alignSelf: 'flex-start',
      background: '#fff',
      color: '#166534',
      border: 'none',
      borderRadius: '10px',
      padding: '10px 14px',
      cursor: 'pointer',
      fontWeight: 'bold',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.navbar}>
        <span style={{ fontWeight: 'bold', color: '#166534' }}>Configurações</span>
        <button style={styles.backButton} onClick={() => navigate('/home')}>
          Voltar
        </button>
      </div>

      <div style={styles.card}>
        <div style={styles.label}>Notificações</div>
        <div style={styles.row}>
          <div>
            <div style={styles.label}>Permitir notificações</div>
            <div style={styles.desc}>Permite receber notificações do aplicativo.</div>
          </div>
          <div style={styles.switch} onClick={toggleNotifications}>
            <div style={styles.knob}></div>
          </div>
        </div>

        <div style={styles.banner}>
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Adicionar à tela inicial</div>
          <div style={{ fontSize: '13px' }}>
            Baixe o aplicativo/atalho e acesse o Panda Loterias mais rápido.
          </div>
          <button style={styles.bannerButton} onClick={() => alert('Adicionar atalho: implementar')}>
            Adicionar atalho
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

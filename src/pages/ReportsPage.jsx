import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaChartBar, FaListAlt, FaWallet, FaFileAlt, FaClipboardCheck } from 'react-icons/fa';
import { toast } from 'react-toastify';

const reports = [
  { label: 'Consultar saldo', icon: <FaWallet />, description: 'Extrato e saldo atual da carteira.', route: '/relatorios/consulta-saldo' },
  { label: 'Consultar Pule', icon: <FaClipboardCheck />, description: 'Busque e visualize pules emitidas.' },
  { label: 'Movimento loterias', icon: <FaChartBar />, description: 'Resumo das movimentações das loterias.' },
  { label: 'Cotações', icon: <FaFileAlt />, description: 'Confira cotações vigentes.', route: '/relatorios/cotacoes' },
  { label: 'Cotadas', icon: <FaListAlt />, description: 'Listagem de cotadas recentes.' },
];

const ReportsPage = () => {
  const navigate = useNavigate();

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
      maxWidth: '720px',
      background: '#bbf7d0',
      border: '1px solid #9ed8b6',
      borderRadius: '12px',
      padding: '12px 16px',
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
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
    },
    list: {
      width: '100%',
      maxWidth: '720px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '12px',
    },
    card: {
      background: '#fff',
      borderRadius: '14px',
      border: '1px solid #e5e7eb',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      boxShadow: '0 6px 12px rgba(0,0,0,0.06)',
      cursor: 'pointer',
      transition: 'transform 0.1s ease, box-shadow 0.1s ease',
      color: '#166534',
    },
    cardHover: {
      transform: 'translateY(-1px)',
      boxShadow: '0 10px 18px rgba(0,0,0,0.08)',
    },
    cardHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontWeight: 'bold',
      fontSize: '16px',
    },
    description: {
      fontSize: '13px',
      color: '#4b5563',
      lineHeight: 1.4,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.navbar}>
        <span style={{ fontWeight: 'bold', color: '#166534' }}>Relatórios</span>
        <button style={styles.backButton} onClick={() => navigate('/home')}>
          <FaArrowLeft /> Voltar
        </button>
      </div>

      <div style={styles.list}>
        {reports.map((item) => (
          <div
            key={item.label}
            style={styles.card}
            onClick={() => {
              if (item.route) {
                navigate(item.route);
              } else {
                toast.info(`${item.label} em breve`);
              }
            }}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, styles.cardHover);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = styles.card.boxShadow;
            }}
          >
            <div style={styles.cardHeader}>
              {item.icon}
              <span>{item.label}</span>
            </div>
            <div style={styles.description}>{item.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportsPage;

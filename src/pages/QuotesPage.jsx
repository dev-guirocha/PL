import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';

const categories = [
  { slug: 'tradicional', label: 'Tradicional' },
  { slug: 'tradicional-1-10', label: 'Tradicional 1/10' },
  { slug: 'lot-uruguaia', label: 'Lot Uruguaia' },
  { slug: 'quininha', label: 'Quininha' },
  { slug: 'seninha', label: 'Seninha' },
  { slug: 'super15', label: 'Super15' },
];

const QuotesPage = () => {
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
    card: {
      width: '100%',
      maxWidth: '520px',
      background: '#fff',
      borderRadius: '14px',
      boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
      padding: '16px',
      border: '1px solid #e5e7eb',
      color: '#166534',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: { fontWeight: 'bold', fontSize: '18px' },
    subtitle: { color: '#4b5563', fontSize: '13px' },
    list: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '10px',
      marginTop: '8px',
    },
    item: {
      background: '#f0fdf4',
      border: '1px solid #dcfce7',
      borderRadius: '12px',
      padding: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      fontWeight: 'bold',
      color: '#166534',
      transition: 'transform 0.1s ease, box-shadow 0.1s ease',
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
      alignSelf: 'flex-end',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>TABELA DE COTAÇÃO</div>
            <div style={styles.subtitle}>Selecione a categoria; os valores aparecem na próxima página.</div>
          </div>
          <button style={styles.backButton} onClick={() => navigate('/relatorios')}>
            <FaArrowLeft /> Voltar
          </button>
        </div>

        <div style={styles.list}>
          {categories.map((cat) => (
            <div key={cat.slug} style={styles.item} onClick={() => navigate(`/relatorios/cotacoes/${cat.slug}`)}>
              <span>{cat.label}</span>
              <FaArrowRight />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuotesPage;

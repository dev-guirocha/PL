import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';

const defaultRows = [
  { label: 'UNIDADE', value: 'R$ 8,00' },
  { label: 'GRUPO', value: 'R$ 20,00' },
  { label: 'DEZENA', value: 'R$ 80,00' },
  { label: 'CENTENA', value: 'R$ 800,00' },
  { label: 'MILHAR', value: 'R$ 8.000,00' },
  { label: 'DUQUE GP', value: 'R$ 180,00' },
  { label: 'TERNO GP', value: 'R$ 1.500,00' },
  { label: 'QUADRA GP', value: 'R$ 1.000,00' },
  { label: 'QUINA GP 8/5', value: 'R$ 600,00' },
  { label: 'SENA GP 10/6', value: 'R$ 600,00' },
  { label: 'DUQUE DEZ', value: 'R$ 300,00' },
  { label: 'TERNO DEZ SECO', value: 'R$ 10.000,00' },
  { label: 'TERNO DEZ', value: 'R$ 5.000,00' },
  { label: 'PALPITAO', value: 'R$ 800,00' },
  { label: 'PASSE VAI', value: 'R$ 110,00' },
  { label: 'PASSE VAI VEM', value: 'R$ 55,00' },
];

const quininhaRows = [
  { label: 'QUININHA 12D', value: 'R$ 10.000,00' },
  { label: 'QUININHA 13D', value: 'R$ 6.000,00' },
  { label: 'QUININHA 14D', value: 'R$ 4.000,00' },
  { label: 'QUININHA 15D', value: 'R$ 3.000,00' },
  { label: 'QUININHA 16D', value: 'R$ 2.300,00' },
  { label: 'QUININHA 17D', value: 'R$ 1.700,00' },
  { label: 'QUININHA 18D', value: 'R$ 1.250,00' },
  { label: 'QUININHA 19D', value: 'R$ 960,00' },
  { label: 'QUININHA 20D', value: 'R$ 750,00' },
  { label: 'QUININHA 25D', value: 'R$ 230,00' },
  { label: 'QUININHA 30D', value: 'R$ 90,00' },
  { label: 'QUININHA 35D', value: 'R$ 40,00' },
  { label: 'QUININHA 40D', value: 'R$ 22,00' },
  { label: 'QUININHA 45D', value: 'R$ 13,00' },
];

const seninhaRows = [
  { label: 'SENINHA 13D', value: 'R$ 10.000,00' },
  { label: 'SENINHA 14D', value: 'R$ 6.000,00' },
  { label: 'SENINHA 15D', value: 'R$ 4.000,00' },
  { label: 'SENINHA 16D', value: 'R$ 2.600,00' },
  { label: 'SENINHA 17D', value: 'R$ 1.600,00' },
  { label: 'SENINHA 18D', value: 'R$ 1.300,00' },
  { label: 'SENINHA 19D', value: 'R$ 900,00' },
  { label: 'SENINHA 20D', value: 'R$ 650,00' },
  { label: 'SENINHA 25D', value: 'R$ 150,00' },
  { label: 'SENINHA 30D', value: 'R$ 48,00' },
  { label: 'SENINHA 35D', value: 'R$ 18,00' },
  { label: 'SENINHA 40D', value: 'R$ 9,00' },
];

const super15Rows = [
  { label: 'SUPER15 17D', value: 'R$ 5.000,00' },
  { label: 'SUPER15 18D', value: 'R$ 1.000,00' },
  { label: 'SUPER15 19D', value: 'R$ 250,00' },
  { label: 'SUPER15 20D', value: 'R$ 80,00' },
  { label: 'SUPER15 21D', value: 'R$ 25,00' },
  { label: 'SUPER15 22D', value: 'R$ 8,00' },
  { label: 'SUPER15 23D', value: 'R$ 3,00' },
];

const rowsBySlug = {
  quininha: quininhaRows,
  seninha: seninhaRows,
  super15: super15Rows,
};

const QuoteDetailPage = () => {
  const navigate = useNavigate();
  const { slug } = useParams();

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
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    listItem: {
      background: '#f0fdf4',
      borderRadius: '10px',
      padding: '12px 14px',
      border: '1px solid #dcfce7',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    label: { fontWeight: 'bold' },
    value: { fontWeight: 'bold' },
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

  const categoryTitle = slug?.replace(/-/g, ' ') || 'Categoria';
  const rows = rowsBySlug[slug] || defaultRows;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>TABELA DE COTAÇÃO</div>
            <div style={styles.subtitle}>{categoryTitle.toUpperCase()} • Valores por R$1,00 (aposta seca)</div>
          </div>
          <button style={styles.backButton} onClick={() => navigate('/relatorios/cotacoes')}>
            <FaArrowLeft /> Voltar
          </button>
        </div>

        <div style={styles.list}>
          {rows.map((row) => (
            <div key={row.label} style={styles.listItem}>
              <span style={styles.label}>{row.label}</span>
              <span style={styles.value}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuoteDetailPage;

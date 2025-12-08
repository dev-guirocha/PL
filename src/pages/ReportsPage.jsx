import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaChartBar, FaListAlt, FaWallet, FaFileAlt, FaClipboardCheck } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './ReportsPage.css';

const reports = [
  { label: 'Consultar saldo', icon: <FaWallet />, description: 'Extrato e saldo atual da carteira.', route: '/relatorios/consulta-saldo' },
  { label: 'Consultar Pule', icon: <FaClipboardCheck />, description: 'Busque e visualize pules emitidas.' },
  { label: 'Movimento loterias', icon: <FaChartBar />, description: 'Resumo das movimentações das loterias.' },
  { label: 'Cotações', icon: <FaFileAlt />, description: 'Confira cotações vigentes.', route: '/relatorios/cotacoes' },
  { label: 'Cotadas', icon: <FaListAlt />, description: 'Listagem de cotadas recentes.' },
];

const ReportsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="reports-page">
      <div className="reports-hero">
        <span className="reports-title">Relatórios</span>
        <button className="reports-back" onClick={() => navigate('/home')}>
          <FaArrowLeft /> Voltar
        </button>
      </div>

      <div className="reports-grid">
        {reports.map((item) => (
          <div
            key={item.label}
            className="reports-card"
            onClick={() => {
              if (item.route) {
                navigate(item.route);
              } else {
                toast.info(`${item.label} em breve`);
              }
            }}
          >
            <div className="reports-card-header">
              {item.icon}
              <span>{item.label}</span>
            </div>
            <div className="reports-description">{item.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportsPage;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaChartBar, FaListAlt, FaWallet, FaFileAlt, FaClipboardCheck } from 'react-icons/fa';
import { toast } from 'react-toastify';

const reports = [
  { label: 'Consultar saldo', icon: <FaWallet />, description: 'Extrato e saldo atual da carteira.', route: '/relatorios/consulta-saldo' },
  { label: 'Resultados', icon: <FaClipboardCheck />, description: 'Consulta de resultados e PULEs geradas.', route: '/relatorios/pules-resultado' },
  { label: 'Movimento loterias', icon: <FaChartBar />, description: 'Resumo das movimentações das loterias.' },
  { label: 'Cotações', icon: <FaFileAlt />, description: 'Confira cotações vigentes.', route: '/relatorios/cotacoes' },
  { label: 'Cotadas', icon: <FaListAlt />, description: 'Listagem de cotadas recentes.' },
];

const ReportsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-sky-100 px-4 py-7">
      <div className="mx-auto flex max-w-5xl items-center justify-between rounded-2xl border border-emerald-50 bg-white/90 px-4 py-3 text-emerald-800 shadow-xl">
        <span className="text-lg font-extrabold">Relatórios</span>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-3 py-2 text-sm font-extrabold text-white shadow-lg transition hover:from-emerald-800 hover:to-emerald-700"
          onClick={() => navigate('/home')}
        >
          <FaArrowLeft /> Voltar
        </button>
      </div>

      <div className="mx-auto mt-4 grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-emerald-800 shadow-lg transition hover:-translate-y-1 hover:border-emerald-100 hover:shadow-xl"
            onClick={() => {
              if (item.route) {
                navigate(item.route);
              } else {
                toast.info(`${item.label} em breve`);
              }
            }}
          >
            <div className="inline-flex items-center gap-2 text-sm font-extrabold">
              {item.icon}
              <span>{item.label}</span>
            </div>
            <div className="text-sm text-slate-600">{item.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportsPage;

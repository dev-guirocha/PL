import React from 'react';
import { useNavigate } from 'react-router-dom';

const AdminPlaceholderPage = ({ title, description }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 pb-20 font-sans">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-md p-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-emerald-800">{title}</h1>
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
        <button
          className="bg-emerald-700 text-white font-semibold px-3 py-2 rounded-lg shadow hover:bg-emerald-800 transition"
          onClick={() => navigate('/admin')}
        >
          Voltar ao painel
        </button>
      </div>
      <div className="w-full max-w-4xl bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-4 text-emerald-800">
        Funcionalidades detalhadas serão adicionadas aqui.
      </div>
    </div>
  );
};

export default AdminPlaceholderPage;

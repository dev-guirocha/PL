import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';

const AdminLayout = ({ title, subtitle, children, actions }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition"
            title="Voltar ao App"
          >
            <FaArrowLeft />
          </button>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-emerald-800 leading-tight">PLA</h1>
            <span className="text-xs text-slate-500 font-medium">Painel Administrativo</span>
          </div>
        </div>

        <button
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="text-sm font-semibold text-red-600 hover:text-red-700 px-3 py-1 rounded-md hover:bg-red-50 transition flex items-center gap-2"
        >
          Sair <FaSignOutAlt />
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
            {subtitle && <p className="text-slate-500 mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>

        <div className="animate-fade-in">{children}</div>
      </div>
    </div>
  );
};

export default AdminLayout;

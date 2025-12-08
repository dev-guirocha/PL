import React from 'react';

export const StatusBadge = ({ status }) => {
  const styles = {
    paid: 'bg-emerald-100 text-emerald-700',
    won: 'bg-emerald-100 text-emerald-700',
    'nao premiado': 'bg-slate-100 text-slate-600',
    approved: 'bg-blue-100 text-blue-700',
    pending: 'bg-amber-100 text-amber-700',
    open: 'bg-amber-100 text-amber-700',
    lost: 'bg-red-100 text-red-700',
    rejected: 'bg-red-100 text-red-700',
    active: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-slate-100 text-slate-500',
  };

  const normalized = String(status).toLowerCase();
  const classes = styles[normalized] || 'bg-slate-100 text-slate-700';

  const labels = {
    paid: 'Pago',
    won: 'Ganhou',
    'nao premiado': 'Não premiado',
    approved: 'Aprovado',
    pending: 'Pendente',
    open: 'Aberto',
    lost: 'Perdeu',
    rejected: 'Rejeitado',
    active: 'Ativo',
    inactive: 'Inativo',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${classes}`}>
      {labels[normalized] || status}
    </span>
  );
};

const AdminTable = ({ headers, children }) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
      <table className="w-full text-sm text-left text-slate-600">
        <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-xs">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-6 py-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
};

export const AdminTableRow = ({ children }) => (
  <tr className="hover:bg-slate-50 transition-colors last:border-0">{children}</tr>
);

export const AdminTableCell = ({ children, className = '', ...rest }) => (
  <td className={`px-6 py-4 whitespace-nowrap ${className}`} {...rest}>
    {children}
  </td>
);

export default AdminTable;

import React from 'react';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const WithdrawalsManager = ({ withdrawals, updateWithdrawal, formatCurrency }) => (
  <div className="admin-card">
    <div className="admin-card-header">Saques</div>
    <div className="admin-table">
      <div className="admin-table-head">
        <span>ID</span>
        <span>Usuário</span>
        <span>Valor</span>
        <span>Status</span>
        <span>Ação</span>
      </div>
      {withdrawals.map((w) => (
        <div key={w.id} className="admin-table-row">
          <span>{w.id}</span>
          <span>{w.user?.name || w.userId}</span>
          <span>{formatCurrency(w.amount)}</span>
          <span>
            <span className={`admin-pill ${w.status}`}>{w.status}</span>
          </span>
          <span className="admin-actions-inline">
            <button onClick={() => updateWithdrawal(w.id, 'approved')} className="btn-small success" title="Aprovar">
              <FaCheckCircle />
            </button>
            <button onClick={() => updateWithdrawal(w.id, 'rejected')} className="btn-small danger" title="Rejeitar">
              <FaTimesCircle />
            </button>
            <button onClick={() => updateWithdrawal(w.id, 'paid')} className="btn-small success" title="Marcar pago">
              Pago
            </button>
          </span>
        </div>
      ))}
    </div>
  </div>
);

export default WithdrawalsManager;

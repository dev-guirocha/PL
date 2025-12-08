import React from 'react';

const StatsCards = ({ stats, formatCurrency }) => (
  <section className="admin-section">
    <div className="stat-grid">
      <div className="stat-card emerald">
        <div className="stat-title">Saldo Plataforma</div>
        <div className="stat-value">{formatCurrency(stats?.platformFunds || 0)}</div>
        <div className="stat-sub">
          Carteiras {formatCurrency(stats?.wallets?.totalBalance || 0)} | Bônus {formatCurrency(stats?.wallets?.totalBonus || 0)}
        </div>
        <div className="stat-sub">
          Usuários {stats?.usersCount || 0} (Ativos 30d {stats?.activeUsersLast30d || 0})
        </div>
      </div>
      <div className="stat-card amber">
        <div className="stat-title">Apostas</div>
        <div className="stat-value">{stats?.betsCount || 0}</div>
        <div className="stat-sub">Saída em apostas {formatCurrency(stats?.moneyOut?.bets || 0)}</div>
      </div>
      <div className="stat-card cyan">
        <div className="stat-title">Retiradas</div>
        <div className="stat-value">{formatCurrency(stats?.moneyOut?.withdrawals || 0)}</div>
        <div className="stat-sub">Entradas (depósitos) {formatCurrency(stats?.moneyIn?.deposits || 0)}</div>
      </div>
    </div>
  </section>
);

export default StatsCards;

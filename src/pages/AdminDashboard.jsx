import React, { useEffect, useState } from 'react';
import { FaArrowLeft, FaSyncAlt, FaUsers, FaTicketAlt, FaDollarSign, FaClipboardList, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import api from '../utils/api';
import Spinner from '../components/Spinner';
import './AdminDashboard.css';

const formatCurrency = (value) => `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [bets, setBets] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [results, setResults] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [error, setError] = useState('');

  const [supForm, setSupForm] = useState({ name: '', phone: '', code: '' });
  const [resultForm, setResultForm] = useState({ loteria: '', codigoHorario: '', dataJogo: '', numeros: '' });
  const [couponForm, setCouponForm] = useState({ code: '', type: 'bonus', amount: '', expiresAt: '' });
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const [expandedSupervisor, setExpandedSupervisor] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes, betsRes, supRes, resRes, wdRes, coupRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users', { params: { page: 1, pageSize: 5 } }),
        api.get('/admin/bets', { params: { page: 1, pageSize: 5 } }),
        api.get('/admin/supervisors', { params: { page: 1, pageSize: 5 } }),
        api.get('/admin/results', { params: { page: 1, pageSize: 5 } }),
        api.get('/admin/withdrawals', { params: { page: 1, pageSize: 5 } }),
        api.get('/admin/coupons', { params: { page: 1, pageSize: 5 } }),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data?.users || []);
      setBets(betsRes.data?.bets || []);
      setSupervisors(supRes.data?.supervisors || []);
      setResults(resRes.data?.results || []);
      setWithdrawals(wdRes.data?.withdrawals || []);
      setCoupons(coupRes.data?.coupons || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const createSupervisor = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/supervisors', supForm);
      setSupForm({ name: '', phone: '', code: '' });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar supervisor.');
    }
  };

  const createResult = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const numerosList = resultForm.numeros
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      await api.post('/admin/results', { ...resultForm, numeros: numerosList });
      setResultForm({ loteria: '', codigoHorario: '', dataJogo: '', numeros: '' });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar resultado.');
    }
  };

  const deleteSupervisor = async (id) => {
    setError('');
    try {
      await api.delete(`/admin/supervisors/${id}`);
      if (expandedSupervisor === id) setExpandedSupervisor(null);
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao excluir supervisor.');
    }
  };

  const createCoupon = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/coupons', { ...couponForm, amount: Number(couponForm.amount) });
      setCouponForm({ code: '', type: 'bonus', amount: '', expiresAt: '' });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar cupom.');
    }
  };

  const updateWithdrawal = async (id, status) => {
    setError('');
    try {
      await api.patch(`/admin/withdrawals/${id}/status`, { status });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao atualizar saque.');
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <p className="admin-subtitle">Painel Administrador</p>
          <h2 className="admin-title">Visão Geral</h2>
          <p className="admin-lead">Acompanhe métricas-chave, supervisores, resultados e saques em um só lugar.</p>
        </div>
        <div className="admin-header-actions">
          <button className="admin-refresh" onClick={fetchAll} disabled={loading}>
            <FaSyncAlt /> Atualizar
          </button>
          <button className="admin-back" onClick={() => (window.location.href = '/home')}>
            <FaArrowLeft /> Voltar ao app
          </button>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="admin-loading">
          <Spinner size={32} />
        </div>
      ) : (
        <>
          <section className="admin-section">
            <div className="stat-grid">
              <div className="stat-card emerald">
                <div className="stat-title">Saldo Plataforma</div>
                <div className="stat-value">{formatCurrency(stats?.platformFunds || 0)}</div>
                <div className="stat-sub">Carteiras {formatCurrency(stats?.wallets?.totalBalance || 0)} | Bônus {formatCurrency(stats?.wallets?.totalBonus || 0)}</div>
                <div className="stat-sub">Usuários {stats?.usersCount || 0} (Ativos 30d {stats?.activeUsersLast30d || 0})</div>
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

          <section className="admin-section">
            <div className="admin-grid">
              <div className="admin-card">
                <div className="admin-card-header">Últimos Usuários</div>
                <div className="admin-table">
                  <div className="admin-table-head">
                    <span>ID</span>
                    <span>Nome</span>
                    <span>Phone</span>
                    <span>Saldo</span>
                  </div>
                  {users.map((u) => (
                    <div key={u.id} className="admin-table-row">
                      <span>{u.id}</span>
                      <span>{u.name}</span>
                      <span>{u.phone}</span>
                      <span>{formatCurrency(u.balance)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-card">
                  <div className="admin-card-header">Últimas Apostas</div>
                <div className="admin-table">
                  <div className="admin-table-head">
                    <span>ID</span>
                    <span>Ref</span>
                    <span>Usuário</span>
                    <span>Loteria</span>
                    <span>Total</span>
                  </div>
                  {bets.map((b) => (
                    <div key={b.id} className="admin-table-row">
                      <span>{b.id}</span>
                      <span className="muted">{b.betRef || `${b.userId}-${b.id}`}</span>
                      <span>{b.user?.name || b.userId}</span>
                      <span>{b.loteria || '-'}</span>
                      <span>{formatCurrency(b.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="admin-section two-col">
            <div className="admin-card supervisors">
              <div className="admin-card-header">Supervisores</div>
              <form className="admin-form" onSubmit={createSupervisor}>
                <input placeholder="Nome" value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} required />
                <input placeholder="Telefone" value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} />
                <input placeholder="Código" value={supForm.code} onChange={(e) => setSupForm({ ...supForm, code: e.target.value })} required />
                <button type="submit">Cadastrar</button>
              </form>
              <div className="admin-list">
                {supervisors.map((s) => {
                  const link = origin ? `${origin}/?sup=${s.code}` : `/?sup=${s.code}`;
                  const isOpen = expandedSupervisor === s.id;
                  return (
                    <div key={s.id} className="admin-list-item">
                      <div className="admin-sup-top">
                        <div>
                          <strong>{s.code}</strong> — {s.name} {s.phone ? `(${s.phone})` : ''}
                        </div>
                        <div className="admin-sup-actions">
                          <button
                            type="button"
                            className="btn-small danger"
                            title="Excluir supervisor"
                            onClick={() => deleteSupervisor(s.id)}
                          >
                            Excluir
                          </button>
                          <button
                            type="button"
                            className="btn-small"
                            title="Ver vinculados"
                            onClick={() => setExpandedSupervisor(isOpen ? null : s.id)}
                          >
                            Vinculados ({s.users?.length || 0})
                          </button>
                        </div>
                      </div>
                      <div className="admin-sup-link">
                        <span>{link}</span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(link)}
                          className="btn-small"
                          title="Copiar link"
                        >
                          Copiar
                        </button>
                      </div>
                      {isOpen && (s.users?.length || 0) > 0 && (
                        <div className="admin-sub-list">
                          {s.users.map((u) => (
                            <div key={u.id} className="admin-sub-list-item">
                              <span>{u.name}</span>
                              <span>{u.phone}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="admin-card results">
              <div className="admin-card-header">Resultados</div>
              <form className="admin-form" onSubmit={createResult}>
                <input placeholder="Loteria" value={resultForm.loteria} onChange={(e) => setResultForm({ ...resultForm, loteria: e.target.value })} required />
                <input placeholder="Código/Horário" value={resultForm.codigoHorario} onChange={(e) => setResultForm({ ...resultForm, codigoHorario: e.target.value })} />
                <input placeholder="Data do jogo" value={resultForm.dataJogo} onChange={(e) => setResultForm({ ...resultForm, dataJogo: e.target.value })} />
                <input
                  placeholder="Números (separe por vírgula)"
                  value={resultForm.numeros}
                  onChange={(e) => setResultForm({ ...resultForm, numeros: e.target.value })}
                  required
                />
                <button type="submit">Registrar resultado</button>
              </form>
              <div className="admin-list">
                {results.map((r) => (
                  <div key={r.id} className="admin-list-item">
                    <strong>{r.loteria}</strong> {r.codigoHorario ? `- ${r.codigoHorario}` : ''} {r.dataJogo ? `(${r.dataJogo})` : ''} —{' '}
                    {(r.numeros || []).join(', ')} — Bets: {r.bets?.length || 0}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="admin-section two-col">
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

            <div className="admin-card">
              <div className="admin-card-header">Cupons</div>
              <form className="admin-form" onSubmit={createCoupon}>
                <input placeholder="Código" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} required />
                <select value={couponForm.type} onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value })}>
                  <option value="bonus">Bônus</option>
                  <option value="saldo">Saldo</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Valor"
                  value={couponForm.amount}
                  onChange={(e) => setCouponForm({ ...couponForm, amount: e.target.value })}
                  required
                />
                <input
                  type="date"
                  value={couponForm.expiresAt}
                  onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })}
                  placeholder="Expiração (opcional)"
                />
                <button type="submit">Criar cupom</button>
              </form>
              <div className="admin-list">
                {coupons.map((c) => (
                  <div key={c.id} className="admin-list-item">
                    <strong>{c.code}</strong> — {c.type} {formatCurrency(c.amount)} — <span className={`admin-pill ${c.active ? 'active' : 'inactive'}`}>
                      {c.active ? 'Ativo' : 'Inativo'}
                    </span>{' '}
                    {c.expiresAt ? `até ${new Date(c.expiresAt).toLocaleDateString('pt-BR')}` : ''}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;

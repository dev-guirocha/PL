import React from 'react';

const SupervisorsManager = ({
  supForm,
  setSupForm,
  supervisors,
  expandedSupervisor,
  setExpandedSupervisor,
  createSupervisor,
  deleteSupervisor,
  origin,
}) => (
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
                <button type="button" className="btn-small danger" title="Excluir supervisor" onClick={() => deleteSupervisor(s.id)}>
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
              <button type="button" onClick={() => navigator.clipboard?.writeText(link)} className="btn-small" title="Copiar link">
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
);

export default SupervisorsManager;

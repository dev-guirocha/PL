import React from 'react';

const ResultsManager = ({ resultForm, setResultForm, results, createResult }) => (
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
);

export default ResultsManager;

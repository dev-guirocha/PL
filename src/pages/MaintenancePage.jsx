import logo from '../assets/images/logo.png';

function MaintenancePage() {
  const year = new Date().getFullYear();

  return (
    <main className="maintenance-page">
      <div className="maintenance-orb maintenance-orb-left" aria-hidden="true" />
      <div className="maintenance-orb maintenance-orb-right" aria-hidden="true" />

      <section className="maintenance-shell">
        <div className="maintenance-hero">
          <div className="maintenance-brand">
            <div className="maintenance-logo-wrap">
              <img src={logo} alt="Panda Loterias" className="maintenance-logo" />
            </div>
            <span className="maintenance-badge">Site temporariamente desativado</span>
          </div>

          <p className="maintenance-kicker">Panda Loterias</p>
          <h1 className="maintenance-title">Estamos em manutenção para voltar com mais estabilidade.</h1>
          <p className="maintenance-copy">
            A plataforma está temporariamente indisponível enquanto realizamos ajustes técnicos e melhorias
            internas. Assim que o trabalho for concluído, o acesso será restabelecido.
          </p>

          <div className="maintenance-highlights">
            <article className="maintenance-highlight">
              <strong>Estabilidade</strong>
              <span>Revisão da infraestrutura e correções operacionais.</span>
            </article>
            <article className="maintenance-highlight">
              <strong>Segurança</strong>
              <span>Atualizações preventivas para um retorno mais confiável.</span>
            </article>
            <article className="maintenance-highlight">
              <strong>Retorno</strong>
              <span>O site será reaberto assim que os ajustes forem finalizados.</span>
            </article>
          </div>
        </div>

        <aside className="maintenance-panel" aria-label="Status da manutenção">
          <div className="maintenance-status">
            <span className="maintenance-status-dot" aria-hidden="true" />
            <span>Manutenção em andamento</span>
          </div>

          <div className="maintenance-panel-block">
            <p className="maintenance-panel-label">Status atual</p>
            <p className="maintenance-panel-value">Indisponível por tempo limitado</p>
          </div>

          <div className="maintenance-panel-block">
            <p className="maintenance-panel-label">O que estamos fazendo</p>
            <p className="maintenance-panel-text">
              Ajustes técnicos, revisão de performance e preparação do ambiente para reativação.
            </p>
          </div>

          <div className="maintenance-panel-block">
            <p className="maintenance-panel-label">Mensagem</p>
            <p className="maintenance-panel-text">
              Agradecemos a compreensão. Se você tentou acessar o site agora, esta pausa é intencional.
            </p>
          </div>

          <footer className="maintenance-footer">Panda Loterias © {year}</footer>
        </aside>
      </section>
    </main>
  );
}

export default MaintenancePage;

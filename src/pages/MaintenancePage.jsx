import React from 'react';

function MaintenancePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10 text-[#f5efe6]">
      <section className="w-full max-w-xl text-center">
        <div className="mb-6 inline-flex items-center rounded-full border border-[#d0a961]/40 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#d0a961]">
          Manutencao
        </div>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          Plataforma temporariamente fora do ar
        </h1>
        <p className="mt-5 text-base leading-7 text-[#d9c8ad] sm:text-lg">
          Estamos realizando uma manutencao programada. O acesso sera restabelecido assim que o
          servico estiver normalizado.
        </p>
      </section>
    </main>
  );
}

export default MaintenancePage;

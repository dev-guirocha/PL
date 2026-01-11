import React, { useState, useEffect } from 'react';
// Importa o parser que criamos (ajuste o caminho se sua pasta utils estiver em outro lugar)
import { parseBetInput } from '../../utils/betParser'; 

export default function SmartBetInput({ modalidadeSelecionada, onAddPalpites }) {
  const [textInput, setTextInput] = useState('');
  
  // Estado inicial seguro
  const [result, setResult] = useState({ 
    valid: [], 
    meta: { 
      discarded: 0, 
      totalProcessed: 0, 
      totalValid: 0, 
      isGroup: false, 
      error: null 
    } 
  });

  // Re-processa sempre que o usuário digita ou troca a modalidade
  useEffect(() => {
    const res = parseBetInput(textInput, modalidadeSelecionada);
    setResult(res);
  }, [textInput, modalidadeSelecionada]);

  const handleAdd = () => {
    if (result?.valid?.length > 0) {
      onAddPalpites(result.valid);
      setTextInput(''); // Limpa o campo após adicionar
      // O result se atualiza automaticamente via useEffect
    }
  };

  // Lógica para gerar a mensagem de aviso correta
  const getWarningMessage = () => {
    const meta = result?.meta || {};
    
    // 1. Erro Crítico: Modalidade não suportada
    if (meta.error === 'MODALIDADE_NAO_SUPORTADA') {
      return `A modalidade "${modalidadeSelecionada}" não suporta a função Copiar e Colar.`;
    }

    const discarded = Number(meta.discarded || 0);
    
    // 2. Sem erros
    if (!discarded) return null;

    // 3. Avisos Específicos
    if (meta.isGroup) {
      return `${discarded} número(s) inválido(s) (fora de 1-25) foram ignorados.`;
    }
    return `${discarded} dígito(s) sobrando no final foram ignorados (incompleto).`;
  };

  const warning = getWarningMessage();
  const hasCriticalError = result?.meta?.error === 'MODALIDADE_NAO_SUPORTADA';
  const isGroup = result?.meta?.isGroup === true;
  const count = result?.valid?.length || 0;

  return (
    <div 
      className={`border rounded-lg p-3 shadow-sm transition-colors duration-200
      ${hasCriticalError ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}
    >
      {/* --- CABEÇALHO --- */}
      <div className="flex justify-between items-center mb-2">
        <label className={`text-sm font-semibold ${hasCriticalError ? 'text-red-700' : 'text-gray-700'}`}>
          Copiar e Colar ({modalidadeSelecionada})
        </label>

        {count > 0 && !hasCriticalError && (
          <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-bold shadow-sm">
            {count} prontos
          </span>
        )}
      </div>

      {/* --- ÁREA DE TEXTO --- */}
      <textarea
        className={`w-full h-24 p-2 text-sm border rounded focus:ring-2 focus:outline-none font-mono resize-none transition-all
          ${hasCriticalError 
            ? 'border-red-300 bg-white text-red-900 focus:ring-red-200 placeholder-red-300' 
            : 'border-gray-300 focus:ring-blue-500 text-gray-800'}`}
        placeholder={
            hasCriticalError 
            ? "Selecione outra modalidade para usar esta função."
            : isGroup 
                ? "Ex: 1, 5, 10, 25..." 
                : "Cole sua lista aqui (WhatsApp, Excel, Bloco de Notas)..."
        }
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        spellCheck={false}
      />

      {/* --- ÁREA DE FEEDBACK --- */}
      <div className="mt-2 min-h-[1.5rem]">
        {/* Avisos de Erro/Alerta */}
        {warning && (
          <p className={`text-xs mb-2 font-medium flex items-center ${hasCriticalError ? 'text-red-600' : 'text-orange-600'}`}>
            <span className="mr-1">{hasCriticalError ? '⛔' : '⚠️'}</span> 
            {warning}
          </p>
        )}

        {/* Preview dos Chips (Números Válidos) */}
        {count > 0 && !hasCriticalError && (
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1 custom-scrollbar">
            {result.valid.slice(0, 50).map((p, i) => (
              <span
                key={`${p}-${i}`}
                className="bg-white border border-gray-300 text-gray-700 px-1.5 py-0.5 rounded text-xs font-mono select-none"
              >
                {p}
              </span>
            ))}
            {count > 50 && (
              <span className="text-xs text-gray-400 self-center pl-1 font-medium">
                ...e mais {count - 50}
              </span>
            )}
          </div>
        )}
      </div>

      {/* --- BOTÃO DE AÇÃO --- */}
      <button
        onClick={handleAdd}
        disabled={count === 0 || !!hasCriticalError}
        className={`mt-2 w-full py-2.5 rounded text-sm font-bold transition-all transform
          ${count > 0 && !hasCriticalError
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg active:scale-[0.98]'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
      >
        {count > 0 && !hasCriticalError
          ? `Adicionar ${count} Jogo${count > 1 ? 's' : ''}`
          : 'Cole números para adicionar'}
      </button>
    </div>
  );
}
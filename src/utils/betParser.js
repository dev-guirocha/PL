/**
 * src/utils/betParser.js
 * Transforma texto "sujo" em palpites limpos.
 * V2.3 - Adicionado Suporte a UNIDADE (Chunk 1) + Aliases UN
 */

export const parseBetInput = (rawText, modalidade) => {
  const text = String(rawText ?? '');
  
  // Retorno padrão vazio
  const emptyResult = { 
    valid: [], 
    meta: { 
      discarded: 0, 
      totalProcessed: 0, 
      totalValid: 0, 
      isGroup: false, 
      error: null 
    } 
  };

  if (!text.trim()) return emptyResult;

  // --- 1. PREPARAÇÃO ---
  const modRaw = String(modalidade ?? '').toUpperCase().trim();
  const tokens = modRaw.match(/[A-Z0-9]+/g) || [];

  const ALIASES = {
    'GP': 'GRUPO',
    'GRP': 'GRUPO',
    'DZ': 'DEZENA',
    'CT': 'CENTENA',
    'MC': 'MILHAR',
    'UN': 'UNIDADE',
    'U': 'UNIDADE',
  };

  let mod = modRaw; // Default: string original

  // --- 2. HIERARQUIA DE RESOLUÇÃO (Blindada) ---
  
  // FIX: Detecta "M C" (separado) via Regex
  const isHybridRegex = /\bM\s*[-/]?\s*C\b/.test(modRaw);
  
  // FIX: Usa tokens exatos para evitar falso positivo em substring ("GANHE UM MILHAR")
  // Prioridade absoluta para MILHAR se encontrado como token ou regex híbrido
  const hasMilharKeyword = tokens.includes('MILHAR') || tokens.includes('MC') || isHybridRegex;

  if (hasMilharKeyword) {
    mod = 'MILHAR';
  } else {
    // Só procura outros aliases se NÃO for Milhar
    for (const t of tokens) {
      if (t.length < 2 && t !== 'U') continue;
      if (ALIASES[t]) {
        mod = ALIASES[t];
        break; 
      }
    }
  }

  // --- 3. DEFINIÇÃO DA ESTRATÉGIA ---
  let chunkSize = 0;
  let isGroup = false;

  if (mod.includes('MILHAR')) {
    chunkSize = 4;
  } else if (mod.includes('CENTENA')) {
    chunkSize = 3;
  } else if (mod.includes('DEZENA')) {
    chunkSize = 2;
  } else if (mod.includes('UNIDADE')) {
    chunkSize = 1;
  } else if (mod.includes('GRUPO')) {
    isGroup = true;
  } else {
    return { 
      ...emptyResult, 
      meta: { ...emptyResult.meta, error: 'MODALIDADE_NAO_SUPORTADA' } 
    };
  }

  // --- 4. PROCESSAMENTO: GRUPO (Tokenize) ---
  if (isGroup) {
    const tokensNum = text.split(/[^0-9]+/).filter(Boolean);
    let valid = [];
    let discarded = 0;

    for (const t of tokensNum) {
      const val = Number(t);
      if (Number.isInteger(val) && val >= 1 && val <= 25) {
        valid.push(String(val).padStart(2, '0'));
      } else {
        discarded++; 
      }
    }

    return {
      valid,
      meta: { 
        discarded, 
        totalProcessed: tokensNum.length, 
        totalValid: valid.length, // Nova Métrica
        isGroup: true,
        error: null
      }
    };
  }

  // --- 5. PROCESSAMENTO: FIXOS (M/C/D/U) ---
  const cleanDigits = text.replace(/\D/g, '');
  const totalLen = cleanDigits.length;
  let valid = [];
  let chunksCount = 0;
  let discardedDigits = 0;

  for (let i = 0; i < totalLen; i += chunkSize) {
    const chunk = cleanDigits.slice(i, i + chunkSize);
    
    if (chunk.length === chunkSize) {
      valid.push(chunk);
      chunksCount++;
    } else {
      discardedDigits += chunk.length; 
    }
  }

  const totalChunksPossible = Math.ceil(totalLen / chunkSize); // Nova Métrica

  return {
    valid,
    meta: { 
      discarded: discardedDigits, 
      totalProcessed: totalChunksPossible, // Tentativas
      totalValid: chunksCount, // Sucessos
      isGroup: false,
      error: null
    }
  };
};

/**
 * Helper para UI: Define quais modalidades suportam Smart Input.
 * Centraliza a regra para usar em LoteriasPalpitesPage, Modais, Mobile, etc.
 */
export const isSmartInputSupported = (modalidade) => {
  const mod = String(modalidade || '').toUpperCase();
  const supported = [
    'MILHAR',
    'CENTENA',
    'DEZENA',
    'UNIDADE',
    'GRUPO',
    'MC',
    'M C',
    'MILHAR E CENTENA',
  ];

  return supported.some((s) => mod.includes(s));
};

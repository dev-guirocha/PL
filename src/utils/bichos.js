// Mapeamento fixo de grupo -> bicho (jogo do bicho)
export const BICHOS_NOME = {
  1: 'Avestruz',
  2: 'Águia',
  3: 'Burro',
  4: 'Borboleta',
  5: 'Cachorro',
  6: 'Cabra',
  7: 'Carneiro',
  8: 'Camelo',
  9: 'Cobra',
  10: 'Coelho',
  11: 'Cavalo',
  12: 'Elefante',
  13: 'Galo',
  14: 'Gato',
  15: 'Jacaré',
  16: 'Leão',
  17: 'Macaco',
  18: 'Porco',
  19: 'Pavão',
  20: 'Peru',
  21: 'Touro',
  22: 'Tigre',
  23: 'Urso',
  24: 'Veado',
  25: 'Vaca',
};

// Recebe MILHAR ou DEZENA e retorna o GRUPO (1-25)
export const getGrupoDoBicho = (numero) => {
  const str = String(numero).padStart(2, '0');
  const dezenaStr = str.slice(-2);
  const dezena = parseInt(dezenaStr, 10);
  if (Number.isNaN(dezena)) return null;
  if (dezena === 0) return 25; // Vaca
  return Math.ceil(dezena / 4);
};

export const getNomeBicho = (grupo) => {
  const g = parseInt(grupo, 10);
  return BICHOS_NOME[g] || '';
};

export const getNomeDoBicho = (numeroOrGrupo, isGrupo = false) => {
  let grupo;
  if (isGrupo) grupo = parseInt(numeroOrGrupo, 10);
  else grupo = getGrupoDoBicho(numeroOrGrupo);
  return BICHOS_NOME[grupo] || '';
};

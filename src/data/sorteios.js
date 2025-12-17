// 1. PRIMEIRO: Funções Utilitárias
// (Precisam existir antes de serem chamadas)

const getDayOfWeek = () => {
  const now = new Date();
  // Retorna 0 (Dom) a 6 (Sáb)
  return now.getDay();
};

const isFederalDay = () => {
  const day = getDayOfWeek();
  // Retorna TRUE se for Quarta (3) ou Sábado (6)
  return day === 3 || day === 6;
};

// 2. SEGUNDO: Funções Geradoras de Horários
// (Usam as funções acima, então precisam vir depois delas)

const getHorariosRio = () => {
  const base = ['LT PT RIO 09HS', 'LT PT RIO 11HS', 'LT PT RIO 14HS', 'LT PT RIO 16HS', 'LT PT RIO 18HS', 'LT PT RIO 21HS'];

  if (isFederalDay()) {
    // Nos dias de Federal:
    // 1. Filtra para remover o das 18HS
    // 2. Adiciona o da Federal
    // 3. Retorna ordenado manualmente
    return ['LT PT RIO 09HS', 'LT PT RIO 11HS', 'LT PT RIO 14HS', 'LT PT RIO 16HS', 'FEDERAL 20H', 'LT PT RIO 21HS'];
  }

  return base;
};

const getHorariosMaluquinha = () => {
  const base = ['LT MALUQ RIO 09HS', 'LT MALUQ RIO 11HS', 'LT MALUQ RIO 14HS', 'LT MALUQ RIO 16HS', 'LT MALUQ RIO 18HS', 'LT MALUQ RIO 21HS'];

  if (isFederalDay()) {
    // Dias de Federal: Remove 18HS e troca por FEDERAL 20HS
    return ['LT MALUQ RIO 09HS', 'LT MALUQ RIO 11HS', 'LT MALUQ RIO 14HS', 'LT MALUQ RIO 16HS', 'LT MALUQ FEDERAL 20HS', 'LT MALUQ RIO 21HS'];
  }

  return base;
};

// 3. TERCEIRO: A Lista Principal
// (Só pode ser criada depois que TUDO acima já existe)

export const LOTERIAS_SORTEIOS = [
  {
    nome: 'RIO/FEDERAL',
    slug: 'rio-federal',
    horarios: getHorariosRio(), // Chama a função aqui
  },
  {
    nome: 'MALUQUINHA',
    slug: 'maluquinha',
    horarios: getHorariosMaluquinha(), // Chama a função aqui
  },
  {
    nome: 'NACIONAL',
    slug: 'nacional',
    horarios: ['LT NACIONAL 02HS', 'LT NACIONAL 08HS', 'LT NACIONAL 10HS', 'LT NACIONAL 12HS', 'LT NACIONAL 15HS', 'LT NACIONAL 17HS', 'LT NACIONAL 21HS', 'LT NACIONAL 23HS'],
  },
  {
    nome: 'LOOK/GOIAS',
    slug: 'look-goias',
    horarios: [
      'LT LOOK 07HS',
      'LT LOOK 09HS',
      'LT LOOK 11HS',
      'LT LOOK 14HS',
      'LT LOOK 16HS',
      'LT LOOK 18HS',
      'LT LOOK 21HS',
      'LT LOOK 23HS',
      'LT BOA SORTE 09HS',
      'LT BOA SORTE 11HS',
      'LT BOA SORTE 14HS',
      'LT BOA SORTE 16HS',
      'LT BOA SORTE 18HS',
      'LT BOA SORTE 21HS',
    ],
  },
  {
    nome: 'SAO-PAULO',
    slug: 'sao-paulo',
    horarios: ['PT SP 08HS', 'PT SP 10HS', 'PT SP 12HS', 'PT SP 13HS', 'PT SP 17HS', 'PT SP 19HS', 'PT SP 20HS', 'LT BAND 15HS'],
  },
  {
    nome: 'LOTECE/LOTEP',
    slug: 'lotece-lotep',
    horarios: ['LT LOTEP 09HS', 'LT LOTEP 10HS', 'LT LOTEP 12HS', 'LT LOTEP 15HS', 'LT LOTEP 18HS', 'LT LOTEP 20HS', 'LT LOTECE 10HS', 'LT LOTECE 14HS', 'LT LOTECE 16HS', 'LT LOTECE 19HS'],
  },
  {
    nome: 'BAHIA',
    slug: 'bahia',
    horarios: ['LT BAHIA 10HS', 'LT BAHIA 12HS', 'LT BAHIA 15HS', 'LT BAHIA 19HS', 'LT BAHIA 21HS', 'LT BA MALUCA 10HS', 'LT BA MALUCA 12HS', 'LT BA MALUCA 15HS', 'LT BA MALUCA 19HS', 'LT BA MALUCA 21HS'],
  },
  {
    nome: 'CAPITAL',
    slug: 'capital',
    horarios: ['LT CAPITAL 10HS', 'LT CAPITAL 11HS', 'LT CAPITAL 13HS', 'LT CAPITAL 14HS', 'LT CAPITAL 16HS', 'LT CAPITAL 18HS', 'LT CAPITAL 20HS', 'LT CAPITAL 22HS'],
  },
  {
    nome: 'MINAS GERAIS',
    slug: 'minas-gerais',
    horarios: ['LT ALVORADA 12HS', 'LT MINAS DIA 15HS', 'LT MINAS NOITE 19HS', 'LT MINAS PREF 21HS'],
  },
  {
    nome: 'SORTE',
    slug: 'sorte',
    horarios: ['LT SORTE 14HS', 'LT SORTE 18HS'],
  },
  {
    nome: 'LOTERIA INSTANTANEA',
    slug: 'loteria-instantanea',
    horarios: ['LT INSTANTANEA 22HS'],
  },
  {
    nome: 'LOTERIA URUGUAIA',
    slug: 'uruguaia',
    horarios: ['URUGUAIA 09HS', 'URUGUAIA 12HS', 'URUGUAIA 15HS', 'URUGUAIA 18HS', 'URUGUAIA 21HS'],
  },
  {
    nome: 'QUININHA',
    slug: 'quininha',
    horarios: ['19:00'],
  },
  {
    nome: 'SENINHA',
    slug: 'seninha',
    horarios: ['QUA-SAB', 'EXTRA TER/QUI'],
  },
  {
    nome: 'SUPER 15',
    slug: 'super15',
    horarios: ['SEG-SAB'],
  },
];

// Helper extra para compatibilidade
export const getLoteriasSorteios = () => LOTERIAS_SORTEIOS;

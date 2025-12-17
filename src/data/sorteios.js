const baseLoterias = [
  {
    nome: 'RIO/FEDERAL',
    slug: 'rio-federal',
    horarios: ['LT PT RIO 09HS', 'LT PT RIO 11HS', 'LT PT RIO 14HS', 'LT PT RIO 16HS', 'LT PT RIO 18HS', 'LT PT RIO 21HS'],
  },
  {
    nome: 'MALUQUINHA',
    slug: 'maluquinha',
    horarios: ['LT MALUQ RIO 09HS', 'LT MALUQ RIO 11HS', 'LT MALUQ RIO 14HS', 'LT MALUQ RIO 16HS', 'LT MALUQ RIO 18HS', 'LT MALUQ RIO 21HS'],
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

const isFederalDay = (dateStr) => {
  const baseDate = dateStr ? new Date(dateStr) : new Date();
  const day = baseDate.getDay(); // 0=dom, 3=qua, 6=sab
  return day === 3 || day === 6;
};

const buildHorarios = (lot, dateStr) => {
  if (!isFederalDay(dateStr)) return lot.horarios;

  if (lot.slug === 'rio-federal') {
    return lot.horarios.map((h) => (h === 'LT PT RIO 18HS' ? 'LT FEDERAL 20HS' : h));
  }

  if (lot.slug === 'maluquinha') {
    return lot.horarios.map((h) => (h === 'LT MALUQ RIO 18HS' ? 'LT MALUQ FEDERAL 20HS' : h));
  }

  return lot.horarios;
};

export function getLoteriasSorteios(dateStr) {
  return baseLoterias.map((lot) => ({
    ...lot,
    horarios: buildHorarios(lot, dateStr),
  }));
}

// Mantém export antigo para compatibilidade, usando a data de hoje
export const LOTERIAS_SORTEIOS = getLoteriasSorteios();

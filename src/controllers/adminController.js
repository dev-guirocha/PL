// --- IMPORTANTE: NÃO MEXA NESTA LINHA ---
// Importamos a conexão já configurada do seu projeto (com Neon/Adapter)
// Não use "new PrismaClient()" aqui, pois vai quebrar a conexão com o Neon.
const prisma = require('../utils/prismaClient');

// --- FUNÇÕES DE LIMPEZA (SHERLOCK HOLMES) ---

// 1. Extrai a HORA cheia (Núcleo da comparação)
// Ex: "LT PT RIO 18HS" -> "18"
// Ex: "18:00" -> "18"
const extractHour = (str) => {
  if (!str) return 'XX';
  // Remove tudo que não é número
  const nums = String(str).replace(/\D/g, '');
  
  // Se não sobrou número nenhum, erro
  if (nums.length === 0) return 'XX';

  // Se tem 3 ou 4 digitos (1800), pega os 2 primeiros
  if (nums.length >= 3) return nums.slice(0, 2);
  
  // Se tem 1 ou 2 digitos (18), garante 2 casas (18)
  return nums.padStart(2, '0');
};

// 2. Normaliza Data para YYYY-MM-DD
const normalizeDate = (dateStr) => {
  if (!dateStr) return 'INVALID';
  // Pega só a primeira parte se tiver espaço ou T
  let clean = String(dateStr).split('T')[0].split(' ')[0];
  
  // Se for DD/MM/YYYY vira YYYY-MM-DD
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
  }
  return clean;
};

// 3. Chave de Loteria Simplificada
// Transforma "LT PT RIO" em "PTRIO"
// Transforma "PT-RIO" em "PTRIO"
const getLotteryKey = (name) => {
  return String(name || '')
    .toUpperCase()
    .replace('FEDERAL', '') // Remove FEDERAL pra não confundir
    .replace('RIO', '')     // Remove RIO
    .replace(/^LT/, '')     // Remove LT
    .replace(/[^A-Z0-9]/g, ''); // Remove espaços e traços
};

const isFederal = (name) => String(name).toUpperCase().includes('FEDERAL');
const isMaluquinha = (name) => String(name).toUpperCase().includes('MALUQ');

// --- CONTROLLERS ---

exports.createResult = async (req, res) => {
  try {
    const { loteria, dataJogo, codigoHorario, numeros, grupos } = req.body;
    const result = await prisma.result.create({
      data: { loteria, dataJogo, codigoHorario, numeros, grupos: grupos || [] },
    });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar resultado.' });
  }
};

exports.listResults = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const results = await prisma.result.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const total = await prisma.result.count();
    res.json({ results, total, page, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar resultados.' });
  }
};

exports.updateResult = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await prisma.result.update({ where: { id }, data: req.body });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar resultado.' });
  }
};

exports.deleteResult = async (req, res) => {
  try {
    await prisma.result.delete({ where: { id: req.params.id } });
    res.json({ message: 'Resultado deletado.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar.' });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({ 
      take: 50, 
      orderBy: { createdAt: 'desc' }, 
      select: { id: true, name: true, phone: true, balance: true, cpf: true, isAdmin: true } 
    });
    res.json({ users, total: users.length });
  } catch(e) { 
    res.status(500).json({error: 'Erro list users'}); 
  }
};

// --- A FUNÇÃO QUE IMPORTA: LIQUIDAÇÃO ---
exports.settleBetsForResult = async (req, res) => {
  const { id } = req.params;
  
  // LOG DE DEBUG PARA CONFIRMAR QUE O CÓDIGO NOVO SUBIU
  console.log(`\n🚀 [V4-FIX] INICIANDO LIQUIDAÇÃO DO RESULTADO ID: ${id}`);

  try {
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) return res.status(404).json({ error: 'Resultado não encontrado' });

    // 1. Dados do GABARITO (Resultado)
    const resDate = normalizeDate(result.dataJogo);
    const resHour = extractHour(result.codigoHorario);
    const resIsFed = isFederal(result.loteria);
    const resIsMaluq = isMaluquinha(result.loteria);
    const resKey = getLotteryKey(result.loteria); 

    console.log(`📊 GABARITO: Data=[${resDate}] Hora=[${resHour}] Tipo=[${resIsFed ? 'FED' : resIsMaluq ? 'MALUQ' : resKey}] String=[${result.loteria}]`);

    // Prepara números
    let numerosSorteados = [];
    try {
      numerosSorteados = Array.isArray(result.numeros) ? result.numeros : JSON.parse(result.numeros);
    } catch { numerosSorteados = []; }
    const premios = numerosSorteados.map(n => String(n).replace(/\D/g, '').slice(-4).padStart(4, '0'));

    // 2. Busca TODAS as apostas abertas
    const bets = await prisma.bet.findMany({
      where: { status: 'open' },
      include: { user: true }
    });

    console.log(`🔎 Analisando ${bets.length} apostas abertas...`);
    const summary = { totalBets: 0, processed: 0, wins: 0, errors: [] };

    for (const bet of bets) {
      try {
        // --- COMPARAÇÃO ---
        const betDate = normalizeDate(bet.dataJogo);
        const betHour = extractHour(bet.codigoHorario);

        // 1. Filtro DATA
        if (betDate !== resDate) continue;

        // 2. Filtro HORA
        if (betHour !== resHour) {
            // console.log(`   Ignorando hora: Bet(${betHour}) != Res(${resHour})`);
            continue; 
        }

        // 3. Filtro LOTERIA
        const betIsFed = isFederal(bet.loteria);
        const betIsMaluq = isMaluquinha(bet.loteria);
        const betKey = getLotteryKey(bet.loteria);

        let match = false;

        if (resIsFed) {
          if (betIsFed) match = true;
        } else if (resIsMaluq) {
          if (betIsMaluq) match = true;
        } else {
          // Loterias Normais
          if (betKey && resKey && (betKey === resKey || betKey.includes(resKey) || resKey.includes(betKey))) {
            match = true;
          }
          // Fallback de string crua
          if (!match && (result.loteria.includes(bet.loteria) || bet.loteria.includes(result.loteria))) {
            match = true;
          }
        }

        if (!match) continue; // Não é essa loteria

        // --- MATCH CONFIRMADO! ---
        console.log(`✅ MATCH! Aposta #${bet.id} (User ${bet.userId})`);
        summary.totalBets++;

        const apostas = parseApostasFromBet(bet);
        if (!apostas || !apostas.length) {
           await prisma.bet.update({ where: { id: bet.id }, data: { status: 'nao premiado', settledAt: new Date(), resultId: id } });
           summary.processed++;
           continue;
        }

        let prize = 0;
        apostas.forEach((aposta) => {
          const modal = aposta.modalidade || bet.modalidade;
          const payout = resolvePayout(modal);
          if (!payout) return;

          const palpites = Array.isArray(aposta.palpites) ? aposta.palpites : [];
          const totalPalpitesNaBet = apostas.reduce((acc, curr) => acc + (curr.palpites?.length || 0), 0);
          
          // Cálculo do Unit Stake (Valor apostado dividido pelos palpites)
          const unitStake = bet.total / (totalPalpitesNaBet > 0 ? totalPalpitesNaBet : 1);
          
          const { factor } = checkVictory({ modal, palpites, premios });

          if (factor > 0) {
            const winVal = unitStake * payout * factor;
            prize += winVal;
            console.log(`      💰 GANHOU! ${modal} | Prêmio: ${winVal.toFixed(2)}`);
          }
        });

        const finalPrize = Number(prize.toFixed(2));
        const status = finalPrize > 0 ? 'won' : 'nao premiado';

        await prisma.$transaction(async (tx) => {
          await tx.bet.update({
            where: { id: bet.id },
            data: { status, prize: finalPrize, settledAt: new Date(), resultId: id },
          });

          if (finalPrize > 0) {
            await tx.user.update({
              where: { id: bet.userId },
              data: { balance: { increment: finalPrize } },
            });
            await tx.transaction.create({
              data: {
                userId: bet.userId,
                type: 'prize',
                amount: finalPrize,
                description: `Prêmio ${bet.modalidade} (${bet.id})`,
              },
            });
          }
        });

        summary.processed++;
        if (finalPrize > 0) summary.wins++;

      } catch (innerErr) {
        console.error(`❌ Erro Bet ${bet.id}:`, innerErr);
        summary.errors.push({ id: bet.id, msg: innerErr.message });
      }
    }

    console.log('🏁 FIM DA LIQUIDAÇÃO:', summary);
    res.json({ message: 'Processamento concluído', summary });

  } catch (err) {
    console.error('Erro fatal:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
};

// --- HELPERS ---
function parseApostasFromBet(bet) {
  try {
    if (typeof bet.palpites === 'string') return JSON.parse(bet.palpites);
    if (Array.isArray(bet.palpites)) return bet.palpites;
    return []; 
  } catch { return []; }
}

function resolvePayout(modalidade) {
  const table = {
    'MILHAR': 4000, 'CENTENA': 400, 'DEZENA': 60, 'GRUPO': 18,
    'DUQUE DEZENA': 300, 'TERNO DEZENA': 3000, 'DUQUE GRUPO': 18, 'TERNO GRUPO': 150
  };
  const key = String(modalidade).toUpperCase();
  for (const k in table) if (key.includes(k)) return table[k];
  return 0;
}

function checkVictory({ modal, palpites, premios }) {
  let factor = 0;
  const m = String(modal).toUpperCase();
  const cleanPalpites = palpites.map(p => String(p).replace(/\D/g, ''));

  if (m.includes('MILHAR')) {
    if (cleanPalpites.includes(premios[0])) factor += 1;
  }
  else if (m.includes('CENTENA')) {
    const centenasPremios = premios.map(p => p.slice(-3));
    if (cleanPalpites.includes(centenasPremios[0])) factor += 1;
  }
  else if (m.includes('GRUPO')) {
    const getGrp = (n) => {
      const d = parseInt(n.slice(-2));
      if (d === 0) return '25';
      return String(Math.ceil(d / 4));
    };
    const gruposPremios = premios.map(getGrp);
    if (cleanPalpites.includes(gruposPremios[0])) factor += 1;
  }
  return { factor };
}

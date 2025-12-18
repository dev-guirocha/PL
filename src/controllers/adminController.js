const { PrismaClient } = require('@prisma/client');
// Prisma 7 exige options não-vazios; usamos conexão padrão via env
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// --- FUNÇÕES DE LIMPEZA (EXTREMAS) ---

// 1. Extrai a HORA cheia de qualquer string (ex: "LT PT RIO 18HS" -> "18")
const extractHour = (str) => {
  if (!str) return 'XX';
  // Remove tudo que não é número
  const nums = String(str).replace(/\D/g, '');
  // Se tiver muitos números (ex: 202412181800), tenta ser inteligente, mas foca no simples:
  // Se string for pequena (ex: 18, 09, 1800), pega os 2 primeiros
  if (nums.length >= 1) {
    return nums.slice(0, 2).padStart(2, '0');
  }
  return 'XX'; // Não achou hora
};

// 2. Normaliza Data para YYYY-MM-DD
const normalizeDate = (dateStr) => {
  if (!dateStr) return 'INVALID';
  let clean = String(dateStr).trim();
  // Remove hora se vier junto (ISO)
  if (clean.includes('T')) clean = clean.split('T')[0];
  if (clean.includes(' ')) clean = clean.split(' ')[0];
  
  // Se for DD/MM/YYYY
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
  }
  return clean;
};

// 3. Normaliza Loteria (Remove LT, espaços, traços)
const normalizeLottery = (name) => {
  return String(name || '')
    .toUpperCase()
    .replace('FEDERAL', '') // Remove FEDERAL temporariamente para evitar conflito RIO/FEDERAL
    .replace('RIO', '')     // Remove RIO para focar no núcleo (PT, MALUQ, LOOK)
    .replace(/^LT/, '')     // Remove LT do começo
    .replace(/[^A-Z0-9]/g, ''); // Remove tudo que não é letra/número
};

// 4. Verifica se é Federal (Caso Especial)
const isFederal = (name) => {
  return String(name).toUpperCase().includes('FEDERAL');
};

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

// --- FUNÇÃO DE LIQUIDAÇÃO (A MÁGICA) ---
exports.settleBetsForResult = async (req, res) => {
  const { id } = req.params;
  console.log(`\n🚀 INICIANDO LIQUIDAÇÃO DO RESULTADO ID: ${id}`);

  try {
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) return res.status(404).json({ error: 'Resultado não encontrado' });

    // 1. Prepara dados do Gabarito
    const resDate = normalizeDate(result.dataJogo);
    const resHour = extractHour(result.codigoHorario);
    const resIsFed = isFederal(result.loteria);
    // Para loteria, usamos uma chave simplificada (ex: "PT" ou "LOOK")
    // Se for federal, a chave é FEDERAL
    const resKey = resIsFed ? 'FEDERAL' : normalizeLottery(result.loteria);

    console.log(`📊 GABARITO: Data=[${resDate}] Hora=[${resHour}] Chave=[${resKey}] Original=[${result.loteria}]`);

    // Prepara os números sorteados
    let numerosSorteados = [];
    try {
      numerosSorteados = Array.isArray(result.numeros) ? result.numeros : JSON.parse(result.numeros);
    } catch { numerosSorteados = []; }
    
    // Normaliza para strings de 4 dígitos
    const premios = numerosSorteados.map(n => String(n).replace(/\D/g, '').slice(-4).padStart(4, '0'));

    // 2. Busca TODAS as apostas em aberto
    // Trazemos tudo para filtrar no código, pois o banco é burro para strings diferentes
    const bets = await prisma.bet.findMany({
      where: { status: 'open' },
      include: { user: true } // Precisamos do user para pagar
    });

    console.log(`🔎 Analisando ${bets.length} apostas em aberto...`);

    const summary = { totalBets: 0, processed: 0, wins: 0, errors: [] };

    for (const bet of bets) {
      try {
        // --- COMPARAÇÃO (DEBUG LIGADO) ---
        const betDate = normalizeDate(bet.dataJogo);
        const betHour = extractHour(bet.codigoHorario);
        const betIsFed = isFederal(bet.loteria) || (bet.loteria && bet.loteria.includes('FEDERAL'));
        const betKey = betIsFed ? 'FEDERAL' : normalizeLottery(bet.loteria);

        // 1. Checa Data
        if (betDate !== resDate) continue; // Data diferente, ignora silenciosamente

        // 2. Checa Hora
        if (betHour !== resHour) continue; // Hora diferente, ignora

        // 3. Checa Loteria (Parte mais difícil)
        // Se ambos são federal -> Match
        // Se não, verifica se a chave simplificada está contida
        let matchLottery = false;
        if (resIsFed && betIsFed) {
            matchLottery = true;
        } else if (!resIsFed && !betIsFed) {
            // Ex: PTRIO contem PT ou vice versa
            if (betKey.includes(resKey) || resKey.includes(betKey)) matchLottery = true;
            // Fallback: Verifica string original
            if (result.loteria.includes(bet.loteria) || bet.loteria.includes(result.loteria)) matchLottery = true;
        }

        if (!matchLottery) continue; // Loteria diferente

        // --- SE CHEGOU AQUI, É A APOSTA CERTA! ---
        console.log(`✅ MATCH ENCONTRADO! Aposta ID: ${bet.id} do User ${bet.userId}`);
        
        summary.totalBets++; // Contabiliza como processada para este sorteio

        const apostas = parseApostasFromBet(bet); // Função auxiliar abaixo
        let prize = 0;

        if (!apostas || !apostas.length) {
           console.warn('   Aposta sem palpites válidos.');
           // Marca como nao premiado para limpar
           await prisma.bet.update({ where: { id: bet.id }, data: { status: 'nao premiado', settledAt: new Date(), resultId: id } });
           summary.processed++;
           continue;
        }

        apostas.forEach((aposta) => {
          const modal = aposta.modalidade || bet.modalidade;
          const payout = resolvePayout(modal); // Função auxiliar
          if (!payout) return;

          const palpites = Array.isArray(aposta.palpites) ? aposta.palpites : [];
          // Calcula valor por palpite
          const unitStake = (bet.total / apostas.length) / (palpites.length > 0 ? 1 : 1); 
          // Ajuste fino: sua lógica de unitStake pode variar, simplifiquei aqui:
          // O ideal é: (Valor da ApostaItem) / (Qtd Palpites no Item)
          
          // Como sua estrutura varia, vamos assumir que bet.total é o total do bilhete
          // E precisamos saber quanto vale esse palpite específico.
          // Se sua estrutura de 'aposta' já tem o valor individual, use-o.
          // Vou usar uma lógica genérica segura:
          const realUnitStake = resolveUnitStake(aposta, apostas.length, bet.total);

          const { factor } = checkVictory({ modal, palpites, premios });

          if (factor > 0) {
            const winVal = realUnitStake * payout * factor;
            prize += winVal;
            console.log(`      💰 Ganhou! Modal: ${modal} | Fator: ${factor} | Prêmio: ${winVal}`);
          }
        });

        const finalPrize = Number(prize.toFixed(2));
        const status = finalPrize > 0 ? 'won' : 'nao premiado';

        // Atualiza BD
        await prisma.$transaction(async (tx) => {
          await tx.bet.update({
            where: { id: bet.id },
            data: {
              status,
              prize: finalPrize,
              settledAt: new Date(),
              resultId: id,
            },
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
        console.error(`❌ Erro ao processar aposta ${bet.id}:`, innerErr);
        summary.errors.push({ id: bet.id, msg: innerErr.message });
      }
    }

    console.log('🏁 FIM DA LIQUIDAÇÃO:', summary);
    res.json({ message: 'Processamento concluído', summary });

  } catch (err) {
    console.error('Erro fatal no settle:', err);
    res.status(500).json({ error: 'Erro interno ao liquidar.' });
  }
};

// --- FUNÇÕES DE REGRA DE NEGÓCIO (Reaproveitadas/Ajustadas) ---

function parseApostasFromBet(bet) {
  // Tenta extrair o array de apostas do JSON
  try {
    if (typeof bet.palpites === 'string') return JSON.parse(bet.palpites);
    if (Array.isArray(bet.palpites)) return bet.palpites;
    return []; 
  } catch {
    return [];
  }
}

function resolvePayout(modalidade) {
  // Defina suas cotações aqui ou busque do banco se tiver tabela
  const table = {
    'MILHAR': 4000,
    'CENTENA': 400,
    'DEZENA': 60,
    'GRUPO': 18,
    'DUQUE DEZENA': 300,
    'TERNO DEZENA': 3000,
    'DUQUE GRUPO': 18,
    'TERNO GRUPO': 150,
    // Adicione variações de escrita para garantir
    'Milhar': 4000, 'Centena': 400, 'Grupo': 18
  };
  
  // Normaliza chave
  const key = String(modalidade).toUpperCase();
  // Busca parcial
  for (const k in table) {
    if (key.includes(k)) return table[k];
  }
  return 0;
}

function resolveUnitStake(apostaItem, totalItems, totalBetValue) {
  // Tenta descobrir quanto vale essa aposta específica
  // Se o front manda 'valor' no item:
  if (apostaItem.valor) return Number(apostaItem.valor);
  
  // Se não, divide o total pelo número de itens
  if (totalItems > 0) return totalBetValue / totalItems;
  
  return 0;
}

function checkVictory({ modal, palpites, premios }) {
  // Lógica Simplificada de Vitória
  // Retorna fator multiplicador (0 = perdeu, 1 = ganhou 1x, etc)
  
  let factor = 0;
  const m = String(modal).toUpperCase();
  const cleanPalpites = palpites.map(p => String(p).replace(/\D/g, ''));

  // 1. MILHAR (Cabeça / 1º premio)
  if (m.includes('MILHAR')) {
    // Verifica apenas no 1º prêmio (índice 0) se for seco
    // Se for do 1 ao 5, verifica em todos.
    // Vamos assumir "1 ao 5" se não especificado, ou ajustar conforme sua regra.
    // REGRA PADRÃO COMUM: Se acertar a milhar na cabeça
    if (cleanPalpites.includes(premios[0])) factor += 1;
    
    // Se a aposta for "pelos 5", o payout deve ser dividido por 5 lá na cotação
    // ou aqui detectamos e ajustamos.
  }
  
  // 2. CENTENA
  else if (m.includes('CENTENA')) {
    const centenasPremios = premios.map(p => p.slice(-3));
    // Verifica cabeça
    if (cleanPalpites.includes(centenasPremios[0])) factor += 1;
  }

  // 3. GRUPO
  else if (m.includes('GRUPO')) {
    // Grupo = (Dezena do premio / 4) arredondado pra cima
    // Ex: 25 -> Gr 7.  00 -> Gr 25.
    const getGrp = (n) => {
      const d = parseInt(n.slice(-2));
      if (d === 0) return '25';
      return String(Math.ceil(d / 4));
    };
    const gruposPremios = premios.map(getGrp);
    
    // Se for aposta seca (1º premio)
    if (cleanPalpites.includes(gruposPremios[0])) factor += 1;
  }

  // ... Adicione outras lógicas (Duque, Terno) aqui conforme necessário

  return { factor };
}

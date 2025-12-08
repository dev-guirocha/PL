const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');

const prisma = new PrismaClient();

const betPayloadSchema = z.object({
  loteria: z.string().optional(),
  codigoHorario: z.string().optional(),
  apostas: z
    .array(
      z.object({
        jogo: z.string().optional(),
        data: z.string().optional(),
        modalidade: z.string().optional(),
        colocacao: z.string().optional(),
        palpites: z.array(z.union([z.string(), z.number()])).default([]),
        modoValor: z.enum(['cada', 'todos']).optional(),
        valorAposta: z.number().optional(),
        valorPorNumero: z.number().optional(),
        total: z.number(),
      }),
    )
    .min(1, 'Envie ao menos uma aposta.'),
});

exports.create = async (req, res) => {
  const parsed = betPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.errors?.[0]?.message || 'Dados de aposta inválidos.';
    return res.status(400).json({ error: message });
  }

  const { loteria, codigoHorario, apostas } = parsed.data;
  const total = apostas.reduce((sum, ap) => sum + (ap.total || 0), 0);

  try {
    const bet = await prisma.bet.create({
      data: {
        userId: req.userId,
        loteria,
        codigoHorario,
        total,
        dataJogo: apostas?.[0]?.data || null,
        modalidade: apostas?.[0]?.modalidade || null,
        colocacao: apostas?.[0]?.colocacao || null,
        palpites: JSON.stringify(apostas),
      },
      select: { id: true, loteria: true, total: true, createdAt: true },
    });

    return res.status(201).json({ bet });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao salvar aposta.' });
  }
};

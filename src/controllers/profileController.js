const { Prisma } = require('@prisma/client');
const prisma = require('../prisma');

exports.update = async (req, res) => {
  const { name, phone, cpf, birthDate, email } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
  }

  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: 'Telefone inválido.' });
  }

  const sanitizedCpf = cpf ? cpf.replace(/\D/g, '') : null;
  if (sanitizedCpf && sanitizedCpf.length !== 11) {
    return res.status(400).json({ error: 'CPF deve conter 11 dígitos.' });
  }

  try {
    const current = await prisma.user.findUnique({ where: { id: req.userId }, select: { cpf: true } });
    if (!current) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (current.cpf && sanitizedCpf && sanitizedCpf !== (current.cpf || '').replace(/\D/g, '')) {
      return res.status(400).json({ error: 'CPF já cadastrado. Para alterar, contate o suporte via WhatsApp.' });
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        name,
        phone: cleanPhone,
        cpf: sanitizedCpf || current.cpf || null,
        birthDate: birthDate || null,
        email: email || null,
      },
    });

    return res.json({ user });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(400).json({ error: 'Telefone ou CPF já cadastrado.' });
    }
    return res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
};

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

  try {
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        name,
        phone: cleanPhone,
        cpf: cpf || null,
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

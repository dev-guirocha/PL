const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta';

// Função auxiliar para validar formato de telefone brasileiro (Celular)
// Aceita: (11) 99999-9999, 11 999999999, 11999999999
function isValidPhone(phone) {
  // Remove tudo que não é número
  const cleanPhone = phone.replace(/\D/g, '');
  // Verifica se tem 11 dígitos (DDD + 9 + 8 números)
  const regex = /^[1-9]{2}9[0-9]{8}$/;
  return regex.test(cleanPhone);
}

exports.register = async (req, res) => {
  const { name, phone, password } = req.body;

  // 1. Validação de Campos
  if (!name || !phone || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }

  // 2. Validação RIGOROSA de Telefone
  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: 'Telefone inválido. Use o formato com DDD e 9 dígitos.' });
  }

  // Limpa o telefone para salvar apenas números
  const cleanPhone = phone.replace(/\D/g, '');

  try {
    const existingUser = await prisma.user.findUnique({ where: { phone: cleanPhone } });
    if (existingUser) {
      return res.status(400).json({ error: 'Este telefone já está cadastrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        phone: cleanPhone,
        password: hashedPassword,
      },
    });

    // Gera token para login automático
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user, token });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar conta.' });
  }
};

exports.login = async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: 'Preencha telefone e senha.' });
  }

  const cleanPhone = phone.replace(/\D/g, '');

  try {
    const user = await prisma.user.findUnique({ where: { phone: cleanPhone } });

    if (!user) {
      return res.status(400).json({ error: 'Telefone não encontrado ou senha incorreta.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Telefone não encontrado ou senha incorreta.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ user, token });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
};
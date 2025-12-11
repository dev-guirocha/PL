const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias

const phoneSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/\D/g, ''))
  .refine((val) => /^[1-9]{2}9[0-9]{8}$/.test(val), {
    message: 'Telefone inválido. Use o formato com DDD e 9 dígitos.',
  });

const passwordSchema = z
  .string()
  .min(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  .max(64, { message: 'A senha é muito longa.' })
  .refine((val) => /[A-Za-z]/.test(val) && /\d/.test(val), {
    message: 'A senha deve conter letras e números.',
  });

const registerSchema = z.object({
  name: z.string().trim().min(2, { message: 'Nome obrigatório.' }),
  phone: phoneSchema,
  password: passwordSchema,
  supervisorCode: z.string().trim().optional(),
});

const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, { message: 'Informe a senha.' }),
});

// Remove campos sensíveis antes de enviar para o cliente
function toSafeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

exports.register = async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.errors?.[0]?.message || 'Dados inválidos.';
    return res.status(400).json({ error: message });
  }
  const { name, phone, password, supervisorCode } = parsed.data;

  try {
    let pendingSupCode = null;
    if (supervisorCode) {
      const sup = await prisma.supervisor.findUnique({ where: { code: supervisorCode.toUpperCase() } });
      if (sup) pendingSupCode = sup.code; // guardamos o código; vínculo acontece após primeiro depósito
    }

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({ error: 'Este telefone já está cadastrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        password: hashedPassword,
        pendingSupCode,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        isAdmin: true,
        balance: true,
        bonus: true,
        cpf: true,
        birthDate: true,
        email: true,
        supervisorId: true,
        pendingSupCode: true,
        createdAt: true,
      },
    });

    // Gera token para login automático
    const token = jwt.sign({ userId: user.id, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE,
    });

    res.status(201).json({ user, token });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar conta.' });
  }
};

exports.login = async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.errors?.[0]?.message || 'Dados inválidos.';
    return res.status(400).json({ error: message });
  }
  const { phone, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      return res.status(400).json({ error: 'Telefone não encontrado ou senha incorreta.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Telefone não encontrado ou senha incorreta.' });
    }

    const token = jwt.sign({ userId: user.id, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE,
    });

    res.json({ user: toSafeUser(user), token });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'Senha atual incorreta.' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashed },
    });
    return res.json({ message: 'Senha alterada com sucesso.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao alterar senha.' });
  }
};

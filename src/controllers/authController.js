const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../prisma');
const { sendRecoveryCode } = require('../services/whatsappService');

const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias
const sendResetCodeInResponse = process.env.SEND_RESET_CODE_IN_RESPONSE === 'true' || process.env.NODE_ENV !== 'production';

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
  .refine((val) => /[A-Za-z]/.test(val) && /\d/.test(val) && /[^A-Za-z0-9]/.test(val), {
    message: 'A senha deve conter letras, números e ao menos um caractere especial.',
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

function getFirstIssue(zodError) {
  const issue = zodError?.errors?.[0];
  if (!issue) return { message: 'Dados inválidos.' };
  return { message: issue.message, field: issue.path?.[0] };
}

// Remove campos sensíveis antes de enviar para o cliente
function toSafeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

exports.register = async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const { message, field } = getFirstIssue(parsed.error);
    return res.status(400).json({ error: message, field });
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
      return res.status(400).json({ error: 'Este telefone já está cadastrado.', field: 'phone' });
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
      sameSite: 'none', // permitir cross-site (Vercel -> Railway)
      secure: true,
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
    const { message, field } = getFirstIssue(parsed.error);
    return res.status(400).json({ error: message, field });
  }
  const { phone, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      return res.status(400).json({ error: 'telefone ou senha incorretos.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'telefone ou senha incorretos.' });
    }

    const token = jwt.sign({ userId: user.id, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'none', // permitir cross-site (Vercel -> Railway)
      secure: true,
      maxAge: COOKIE_MAX_AGE,
    });

    res.json({ user: toSafeUser(user), token });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
};

exports.requestPasswordReset = async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Informe seu telefone.', field: 'phone' });
  }
  const cleanPhone = phone.replace(/\D/g, '');

  try {
    const user = await prisma.user.findUnique({ where: { phone: cleanPhone } });
    if (!user) {
      return res.status(404).json({ error: 'Telefone não cadastrado.', field: 'phone' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await prisma.user.update({
      where: { id: user.id },
      data: { resetCode: code, resetExpires: expires },
    });

    // Log de contingência (plano B) para o Admin ver nos logs do servidor
    console.log(`🔑 RECUPERAÇÃO DE SENHA | User: ${cleanPhone} | Código: ${code}`);

    // Tenta enviar via WhatsApp
    const sendResult = await sendRecoveryCode(cleanPhone, code);

    // Se o envio falhar, ou se estivermos fora de produção, retornamos o código para não travar o usuário
    const shouldExposeCode = !sendResult?.success || process.env.NODE_ENV !== 'production' || sendResetCodeInResponse;

    const payload = {
      message: sendResult?.success ? 'Código enviado para seu WhatsApp.' : 'Não foi possível enviar SMS automaticamente.',
    };

    if (shouldExposeCode) {
      payload.detail = 'Use este código provisoriamente (Z-API indisponível ou ambiente de testes).';
      payload.code = code;
    }

    return res.status(200).json(payload);
  } catch (error) {
    console.error('Erro reset senha:', error);
    return res.status(500).json({ error: 'Erro ao processar solicitação.' });
  }
};

exports.resetPassword = async (req, res) => {
  const { phone, code, newPassword } = req.body;
  if (!phone || !code || !newPassword) {
    return res.status(400).json({ error: 'Preencha todos os dados.' });
  }
  const cleanPhone = phone.replace(/\D/g, '');

  try {
    const user = await prisma.user.findUnique({ where: { phone: cleanPhone } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    if (user.resetCode !== code) {
      return res.status(400).json({ error: 'Código inválido.', field: 'resetCode' });
    }

    if (!user.resetExpires || new Date() > new Date(user.resetExpires)) {
      return res.status(400).json({ error: 'Código expirado. Solicite um novo.', field: 'resetCode' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetCode: null, resetExpires: null },
    });
    return res.json({ message: 'Senha alterada com sucesso! Faça login.' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao redefinir senha.' });
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

// src/controllers/webhookController.js
// VERSÃO V7 - PRODUCTION FORTRESS (BASE64 SAFE + DUAL HMAC + STRICT PARSING)
// - SECURITY: Validação HMAC SHA256/SHA1, suporta Hex/Base64 corretamente.
// - DATA: Parse estrito de valor e correlationID.
// - ATOMIC: Mantém lógica de cupom, lock financeiro e atualização de TXID.

const prisma = require('../utils/prismaClient');
const { Prisma } = require('@prisma/client');
const crypto = require('crypto');

// Constantes Decimal
const HUNDRED = new Prisma.Decimal(100);
const ZERO = new Prisma.Decimal(0);
const SANITY_LIMIT_MULTIPLIER = new Prisma.Decimal(2);

// Helper para detectar Hex
const isHex = (s) => /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;

// Validação de Assinatura Robusta
const validateSignature = (req) => {
  const secret = process.env.WOOVI_WEBHOOK_SECRET;
  if (!secret) return false; // Fail-closed

  let signature = req.headers['x-openpix-signature'] || req.headers['x-webhook-signature'];
  const payload = req.rawBody; // Requer app.use(express.json({ verify: ... }))

  if (!signature || !payload) return false;

  signature = String(signature).trim();

  // Remove apenas prefixos conhecidos (não quebra padding "=" do base64)
  const lower = signature.toLowerCase();
  if (lower.startsWith('sha256=')) signature = signature.slice(7).trim();
  else if (lower.startsWith('sha1=')) signature = signature.slice(5).trim();

  // Gera os hashes esperados (Raw Buffers)
  const expected256 = crypto.createHmac('sha256', secret).update(payload).digest();
  const expected1 = crypto.createHmac('sha1', secret).update(payload).digest();

  // Comparação segura (previne timing attacks e erro de length)
  const compare = (sigBuf, expectedBuf) => {
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  };

  // Tenta HEX (apenas se parecer hex)
  if (isHex(signature)) {
    try {
      const sigBuf = Buffer.from(signature, 'hex');
      if (compare(sigBuf, expected256) || compare(sigBuf, expected1)) return true;
    } catch {}
  }

  // Tenta BASE64 (Padrão para muitas APIs)
  try {
    const sigBuf = Buffer.from(signature, 'base64');
    if (compare(sigBuf, expected256) || compare(sigBuf, expected1)) return true;
  } catch {}

  return false;
};

exports.handleOpenPixWebhook = async (req, res) => {
  try {
    // 1. Segurança Primeiro
    if (!validateSignature(req)) {
      console.warn('⛔ Webhook: Assinatura Inválida.');
      return res.status(401).send('Unauthorized');
    }

    const charge = req.body?.charge || req.body?.data?.charge || req.body;
    if (!charge) return res.status(200).send('OK (Ignored)');

    const status = (charge.status || '').toUpperCase();
    const isPaid = ['COMPLETED', 'PAID', 'SETTLED'].includes(status);

    if (!isPaid) return res.status(200).send('OK (Not Paid)');

    // CorrelationID Estrito (Não usa charge.id para evitar erro de not found)
    const correlationID = charge.correlationID || charge.correlationId;
    
    if (!correlationID) {
      console.warn('⚠️ Webhook sem correlationID válido. Ignorando.');
      return res.status(200).send('OK');
    }

    // Extração Segura de Dados do Gateway
    const pixData = charge.paymentMethods?.pix || charge.pix || {};
    const gatewayTxId = pixData.txId || charge.transactionID || null;
    
    // Parse Estrito de Valor (Centavos -> Decimal)
    const paidCentsRaw = charge.value ?? charge.amount; 
    let paidValue = null;
    
    if (paidCentsRaw !== undefined && paidCentsRaw !== null) {
        const centsStr = String(paidCentsRaw).trim();
        // Regex garante que é string de inteiros
        if (/^\d+$/.test(centsStr)) {
             paidValue = new Prisma.Decimal(centsStr).div(HUNDRED);
        } else {
            console.warn(`⚠️ Valor inválido no payload (formato incorreto): ${paidCentsRaw}`);
        }
    }

    // Transação Atômica
    await prisma.$transaction(async (tx) => {
      // 2. Busca PixCharge
      const pixCharge = await tx.pixCharge.findUnique({
        where: { correlationId: correlationID },
        include: { user: true }
      });

      if (!pixCharge) {
        console.warn(`⚠️ PixCharge não encontrada: ${correlationID}`);
        return;
      }

      // 3. Atualiza TXID (Idempotência de Dados - roda sempre, fora do lock financeiro)
      if (gatewayTxId && gatewayTxId !== pixCharge.txid) {
          await tx.pixCharge.update({
              where: { id: pixCharge.id },
              data: { txid: gatewayTxId }
          });
      }

      // 4. Validação de Valor e Sanity Check (Anti-Drift)
      let finalDepositValue = pixCharge.amount;

      if (paidValue) {
          if (!paidValue.equals(pixCharge.amount)) {
              
              // Sanity Check: Trava se > 2x o esperado
              if (paidValue.greaterThan(pixCharge.amount.mul(SANITY_LIMIT_MULTIPLIER))) {
                  throw new Error(`Sanity Check Failed: Pago=${paidValue.toFixed(2)} > 2x Esperado=${pixCharge.amount.toFixed(2)}`);
              }

              console.warn(`⚠️ Valor Divergente [${correlationID}]: Esperado ${pixCharge.amount.toFixed(2)} / Pago ${paidValue.toFixed(2)}`);
              finalDepositValue = paidValue;
          }
      }

      // 5. LOCK FINANCEIRO (Idempotência Forte - roda só uma vez)
      const lock = await tx.pixCharge.updateMany({
        where: {
            correlationId: correlationID,
            credited: false
        },
        data: {
          status: 'PAID',
          credited: true,
          paidAt: new Date(),
          amount: finalDepositValue, // Grava o valor real pago
        },
      });

      if (lock.count === 0) return; // Já creditado, para aqui.

      // 6. Credita Saldo Real
      await tx.user.update({
        where: { id: pixCharge.userId },
        data: { balance: { increment: finalDepositValue } },
      });

      // 7. Lógica de Bônus
      let bonusToApply = null;
      let couponUsed = null;
      
      const couponCodeRaw = (pixCharge.couponCode || '').trim();
      const userProvidedCoupon = couponCodeRaw.length > 0;

      // A. Tenta Cupom
      if (userProvidedCoupon) {
        const code = couponCodeRaw.toUpperCase();
        const coupon = await tx.coupon.findUnique({ where: { code } });

        if (coupon && coupon.active) {
            const now = new Date();
            const isExpired = coupon.expiresAt && coupon.expiresAt < now;
            
            // Valida mínimo com o valor FINAL depositado
            if (!isExpired && finalDepositValue.greaterThanOrEqualTo(coupon.minDeposit)) {
                
                const userUses = await tx.couponRedemption.count({
                    where: { couponId: coupon.id, userId: pixCharge.userId }
                });

                if (userUses < coupon.perUser) {
                    if (coupon.type === 'percent') {
                        bonusToApply = finalDepositValue.mul(coupon.value).div(HUNDRED);
                    } else {
                        bonusToApply = coupon.value;
                    }

                    if (bonusToApply.greaterThan(ZERO)) {
                        // Atomicidade Global
                        const inc = await tx.coupon.updateMany({
                            where: {
                                id: coupon.id,
                                active: true,
                                usedCount: { lt: coupon.maxUses },
                                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
                            },
                            data: { usedCount: { increment: 1 } }
                        });

                        if (inc.count === 1) {
                            couponUsed = coupon;
                        } else {
                            bonusToApply = null;
                        }
                    }
                }
            }
        }
      }

      // B. Fallback (Só se NÃO tentou cupom)
      if (!couponUsed && !userProvidedCoupon) {
          if (pixCharge.bonusAmount && pixCharge.bonusAmount.greaterThan(ZERO)) {
              bonusToApply = pixCharge.bonusAmount;
          }
      }

      // 8. Aplica Bônus e Registra
      if (bonusToApply && bonusToApply.greaterThan(ZERO)) {
          await tx.user.update({
              where: { id: pixCharge.userId },
              data: { bonus: { increment: bonusToApply } }
          });

          if (couponUsed) {
              await tx.couponRedemption.create({
                  data: {
                      couponId: couponUsed.id,
                      userId: pixCharge.userId,
                      depositId: pixCharge.correlationId,
                      amountApplied: bonusToApply
                  }
              });
          }

          await tx.transaction.create({
              data: {
                  userId: pixCharge.userId,
                  type: 'bonus',
                  amount: bonusToApply,
                  description: couponUsed ? `Bônus Cupom ${couponUsed.code}` : 'Bônus Depósito'
              }
          });
      }

      // 9. Log Extrato Depósito
      await tx.transaction.create({
          data: {
              userId: pixCharge.userId,
              type: 'deposit',
              amount: finalDepositValue,
              description: 'Depósito PIX'
          }
      });

      const bonusLog = bonusToApply ? bonusToApply.toFixed(2) : '0.00';
      console.log(`✅ Pix ${correlationID} processado. Valor: ${finalDepositValue.toFixed(2)} | Bônus: ${bonusLog}`);
    });

    return res.status(200).send('OK');

  } catch (error) {
    console.error('❌ Erro Webhook:', error.message); // Log apenas a mensagem para não sujar com stack
    return res.status(500).send('Internal Error'); 
  }
};

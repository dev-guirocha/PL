const recordTransaction = async ({ client, userId, type, amount, description, suppressErrors = true }) => {
  try {
    await client.transaction.create({
      data: { userId, type, amount, description },
    });
  } catch (err) {
    // Registro financeiro não deve quebrar o fluxo principal quando suprimido
    console.error('Erro ao registrar transação', err);
    if (!suppressErrors) throw err;
  }
};

module.exports = { recordTransaction };

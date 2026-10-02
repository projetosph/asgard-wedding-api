const crypto = require("crypto");
const { pool } = require("../db");

function hashTicket(ticket) {
  return crypto
    .createHash("sha256")
    .update(String(ticket))
    .digest("hex");
}

async function validarTicketMercadoPago(req, res, next) {
  const client = await pool.connect();

  try {
    const ticket = String(req.query.ticket || "").trim();
    const slug = String(req.params.slug || "").trim();

    if (!ticket || !slug) {
      return res.status(401).json({
        erro: "Autorização para conectar Mercado Pago ausente."
      });
    }

    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT
         t.token_hash,
         t.casamento_id,
         t.expires_at,
         t.usado_em,
         c.slug
       FROM mercadopago_connect_tickets t
       JOIN casamentos c
         ON c.id = t.casamento_id
       WHERE t.token_hash = $1
       FOR UPDATE`,
      [hashTicket(ticket)]
    );

    const registro = rows[0];

    if (
      !registro ||
      registro.slug !== slug ||
      registro.usado_em ||
      new Date(registro.expires_at).getTime() <= Date.now()
    ) {
      await client.query("ROLLBACK");

      return res.status(401).json({
        erro: "Autorização inválida ou expirada."
      });
    }

    await client.query(
      `UPDATE mercadopago_connect_tickets
       SET usado_em = NOW()
       WHERE token_hash = $1`,
      [registro.token_hash]
    );

    await client.query("COMMIT");

    req.casamentoTicketId = registro.casamento_id;

    return next();

  } catch (erro) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error("Erro no ticket Mercado Pago:", erro);

    return res.status(500).json({
      erro: "Não foi possível validar a conexão com Mercado Pago."
    });

  } finally {
    client.release();
  }
}

module.exports = {
  validarTicketMercadoPago,
  hashTicket
};

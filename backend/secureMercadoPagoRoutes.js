const express = require("express");
const crypto = require("crypto");

const { pool } = require("./db");
const {
  autenticar,
  autorizarCasamentoPorSlug
} = require("./middleware/auth");

const {
  hashTicket
} = require("./middleware/mercadoPagoConnectTicket");

const router = express.Router();

router.post(
  "/api/casamentos/:slug/mercadopago/conectar-ticket",
  autenticar,
  autorizarCasamentoPorSlug,
  async (req, res) => {
    try {
      const ticket = crypto.randomBytes(32).toString("base64url");
      const tokenHash = hashTicket(ticket);

      await pool.query(
        `DELETE FROM mercadopago_connect_tickets
         WHERE expires_at < NOW()
            OR usado_em IS NOT NULL`
      );

      await pool.query(
        `INSERT INTO mercadopago_connect_tickets (
           token_hash,
           usuario_id,
           casamento_id,
           expires_at
         )
         VALUES (
           $1,
           $2,
           $3,
           NOW() + INTERVAL '2 minutes'
         )`,
        [
          tokenHash,
          Number(req.usuario.sub),
          Number(req.casamentoAutorizado.id)
        ]
      );

      const baseUrl =
        process.env.PUBLIC_URL ||
        "https://asgard-wedding-api.onrender.com";

      const url =
        `${baseUrl}/api/casamentos/` +
        `${encodeURIComponent(req.params.slug)}/mercadopago/conectar` +
        `?ticket=${encodeURIComponent(ticket)}`;

      return res.json({
        url,
        expiraEmSegundos: 120
      });

    } catch (erro) {
      console.error("Erro ao criar ticket Mercado Pago:", erro);

      return res.status(500).json({
        erro: "Não foi possível iniciar a conexão com Mercado Pago."
      });
    }
  }
);

module.exports = router;

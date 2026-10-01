const express = require("express");

const { pool } = require("./db");
const {
  consultarOrder
} = require("./services/mercadoPagoOrders");

const {
  validarAssinaturaWebhook
} = require("./services/mercadoPagoWebhook");

const router = express.Router();

async function aplicarOrderProcessada(orderId, order = null) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT *
       FROM casamento_pagamentos
       WHERE order_id = $1
       FOR UPDATE`,
      [String(orderId)]
    );

    const registro = rows[0];

    if (!registro) {
      await client.query("ROLLBACK");
      return null;
    }

    if (registro.aplicado_em) {
      await client.query("COMMIT");
      return registro;
    }

    const status = order?.status || registro.status;
    const statusDetail =
      order?.status_detail || registro.status_detail;

    if (
      !(
        status === "processed" &&
        statusDetail === "accredited"
      )
    ) {
      await client.query("COMMIT");
      return registro;
    }

    const { rows: presenteRows } = await client.query(
      `SELECT id, valor, arrecadado
       FROM casamento_presentes
       WHERE id = $1
         AND casamento_id = $2
       FOR UPDATE`,
      [
        registro.presente_id,
        registro.casamento_id
      ]
    );

    const presente = presenteRows[0];

    if (!presente) {
      throw new Error(
        "Presente vinculado à Order não encontrado."
      );
    }

    const valorTotal =
      Number(presente.valor) || 0;

    const arrecadadoAtual =
      Number(presente.arrecadado) || 0;

    const valorPago =
      Number(
        order?.total_paid_amount ??
        order?.total_amount ??
        registro.valor
      ) || 0;

    const novoArrecadado =
      Math.min(
        arrecadadoAtual + valorPago,
        valorTotal
      );

    await client.query(
      `UPDATE casamento_presentes
       SET arrecadado = $1,
           comprado = ($1 >= valor)
       WHERE id = $2`,
      [novoArrecadado, presente.id]
    );

    await client.query(
      `UPDATE casamento_pagamentos
       SET status = 'processed',
           status_detail = 'accredited',
           valor = $1,
           aplicado_em = NOW(),
           atualizado_em = NOW()
       WHERE order_id = $2`,
      [valorPago, String(orderId)]
    );

    await client.query("COMMIT");

    return {
      aplicado: true,
      valor: valorPago
    };
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  } finally {
    client.release();
  }
}

router.post(
  "/api/mercadopago/webhook/orders",
  async (req, res) => {
    try {
      const assinaturaValida =
        validarAssinaturaWebhook(req);

      if (!assinaturaValida) {
        return res.status(401).json({
          erro: "Assinatura do webhook inválida."
        });
      }

      const orderId =
        String(
          req.query?.["data.id"] ||
          req.query?.data_id ||
          req.body?.data?.id ||
          ""
        ).trim();

      const type =
        String(
          req.query?.type ||
          req.body?.type ||
          ""
        ).trim();

      if (!orderId || type !== "order") {
        return res.sendStatus(200);
      }

      const notificationId =
        String(req.body?.id || "").trim() || null;

      const action =
        String(req.body?.action || "").trim() || null;

      if (notificationId) {
        const { rowCount } = await pool.query(
          `INSERT INTO mercadopago_webhook_eventos (
             notification_id,
             order_id,
             action
           )
           VALUES ($1,$2,$3)
           ON CONFLICT (notification_id)
           DO NOTHING`,
          [
            notificationId,
            orderId,
            action
          ]
        );

        if (!rowCount) {
          return res.sendStatus(200);
        }
      }

      const { rows } = await pool.query(
        `SELECT casamento_id
         FROM casamento_pagamentos
         WHERE order_id = $1
         LIMIT 1`,
        [orderId]
      );

      const pagamentoLocal = rows[0];

      if (!pagamentoLocal) {
        if (notificationId) {
          await pool.query(
            `UPDATE mercadopago_webhook_eventos
             SET status_processamento = 'ignorado',
                 processado_em = NOW(),
                 erro = 'Order não encontrada localmente'
             WHERE notification_id = $1`,
            [notificationId]
          );
        }

        return res.sendStatus(200);
      }

      const order = await consultarOrder({
        casamentoId:
          pagamentoLocal.casamento_id,
        orderId
      });

      await pool.query(
        `UPDATE casamento_pagamentos
         SET status = $1,
             status_detail = $2,
             atualizado_em = NOW()
         WHERE order_id = $3`,
        [
          order.status || null,
          order.status_detail || null,
          orderId
        ]
      );

      if (
        order.status === "processed" &&
        order.status_detail === "accredited"
      ) {
        await aplicarOrderProcessada(
          orderId,
          order
        );
      }

      if (notificationId) {
        await pool.query(
          `UPDATE mercadopago_webhook_eventos
           SET status_processamento = 'processado',
               processado_em = NOW()
           WHERE notification_id = $1`,
          [notificationId]
        );
      }

      return res.sendStatus(200);

    } catch (erro) {
      console.error(
        "Erro no webhook de Orders:",
        erro
      );

      try {
        const notificationId =
          String(req.body?.id || "").trim();

        if (notificationId) {
          await pool.query(
            `UPDATE mercadopago_webhook_eventos
             SET status_processamento = 'erro',
                 processado_em = NOW(),
                 erro = $1
             WHERE notification_id = $2`,
            [
              String(erro.message || "Erro"),
              notificationId
            ]
          );
        }
      } catch {}

      return res.status(500).json({
        erro:
          "Falha ao processar webhook."
      });
    }
  }
);

module.exports = router;

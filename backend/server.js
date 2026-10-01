const express = require("express");
const cors = require("cors");
const webhookRoutes = require("./webhookRoutes");
const authRoutes = require("./authRoutes");
const adminRoutes = require("./adminRoutes");

const {
  pool,
  buscarCasamentoPorSlug,
  buscarPresenteDoCasamento
} = require("./db");

const oauthRoutes =
  require("./oauthRoutes");

const {
  criarOrderPix,
  criarOrderCartao,
  consultarOrder,
  primeiraTransacao,
  extrairPix
} = require("./services/mercadoPagoOrders");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(oauthRoutes);
app.use(webhookRoutes);
app.use(authRoutes);
app.use(adminRoutes);

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    ok: true,
    servico: "asgard-wedding-api",
    versao: "fase-4-orders-oauth"
  });
});

// =====================================================
// CASAMENTOS
// =====================================================

app.get("/api/casamentos/:slug", async (req, res) => {
  try {
    const casamento =
      await buscarCasamentoPorSlug(req.params.slug);

    if (!casamento || casamento.status === "inativo") {
      return res.status(404).json({
        erro: "Casamento não encontrado."
      });
    }

    res.json(casamento);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Erro ao carregar o casamento."
    });
  }
});

// =====================================================
// PRESENTES
// =====================================================

app.get("/api/casamentos/:slug/presentes", async (req, res) => {
  try {
    const casamento =
      await buscarCasamentoPorSlug(req.params.slug);

    if (!casamento) {
      return res.status(404).json({
        erro: "Casamento não encontrado."
      });
    }

    const { rows } = await pool.query(
      `SELECT
         id,
         nome,
         descricao,
         valor,
         arrecadado,
         imagem,
         link,
         comprado
       FROM casamento_presentes
       WHERE casamento_id = $1
         AND ativo = TRUE
       ORDER BY id`,
      [casamento.id]
    );

    res.json(rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Erro ao carregar presentes."
    });
  }
});

// =====================================================
// PRESENÇAS
// =====================================================

app.post("/api/casamentos/:slug/presencas", async (req, res) => {
  try {
    const casamento =
      await buscarCasamentoPorSlug(req.params.slug);

    if (!casamento) {
      return res.status(404).json({
        erro: "Casamento não encontrado."
      });
    }

    const {
      nome,
      nomes,
      quantidade,
      mensagem
    } = req.body;

    const listaNomes =
      Array.isArray(nomes) ? nomes : [];

    const qtd =
      Number(quantidade);

    if (
      !nome ||
      !Number.isInteger(qtd) ||
      qtd < 1
    ) {
      return res.status(400).json({
        erro: "Nome e quantidade são obrigatórios."
      });
    }

    if (listaNomes.length !== qtd) {
      return res.status(400).json({
        erro:
          "A quantidade de nomes deve ser igual à quantidade de pessoas."
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO casamento_presencas
         (
           casamento_id,
           nome_titular,
           nomes,
           quantidade,
           mensagem
         )
       VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING
         id,
         nome_titular,
         nomes,
         quantidade,
         mensagem,
         criado_em`,
      [
        casamento.id,
        String(nome).trim(),
        JSON.stringify(listaNomes),
        qtd,
        mensagem?.trim() || null
      ]
    );

    res.status(201).json(rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Erro ao confirmar presença."
    });
  }
});

// =====================================================
// RECADOS
// =====================================================

app.get("/api/casamentos/:slug/recados", async (req, res) => {
  try {
    const casamento =
      await buscarCasamentoPorSlug(req.params.slug);

    if (!casamento) {
      return res.status(404).json({
        erro: "Casamento não encontrado."
      });
    }

    const { rows } = await pool.query(
      `SELECT
         id,
         nome,
         mensagem,
         criado_em
       FROM casamento_recados
       WHERE casamento_id = $1
       ORDER BY criado_em DESC`,
      [casamento.id]
    );

    res.json(rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Erro ao carregar recados."
    });
  }
});

app.post("/api/casamentos/:slug/recados", async (req, res) => {
  try {
    const casamento =
      await buscarCasamentoPorSlug(req.params.slug);

    if (!casamento) {
      return res.status(404).json({
        erro: "Casamento não encontrado."
      });
    }

    const nome =
      String(req.body.nome || "").trim();

    const mensagem =
      String(req.body.mensagem || "").trim();

    if (!nome || !mensagem) {
      return res.status(400).json({
        erro: "Nome e mensagem são obrigatórios."
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO casamento_recados
         (casamento_id, nome, mensagem)
       VALUES ($1, $2, $3)
       RETURNING
         id,
         nome,
         mensagem,
         criado_em`,
      [
        casamento.id,
        nome,
        mensagem
      ]
    );

    res.status(201).json(rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Erro ao enviar recado."
    });
  }
});

// =====================================================
// CONFIG MERCADO PAGO
// =====================================================

app.get("/api/config/mercadopago", (req, res) => {
  const publicKey =
    process.env.MERCADO_PAGO_PUBLIC_KEY;

  if (!publicKey) {
    return res.status(500).json({
      erro:
        "MERCADO_PAGO_PUBLIC_KEY não configurada."
    });
  }

  res.json({ publicKey });
});

// =====================================================
// HELPERS DE COMPRA
// =====================================================

async function prepararCompra(
  slug,
  body
) {
  const casamento =
    await buscarCasamentoPorSlug(slug);

  if (!casamento) {
    const erro =
      new Error("Casamento não encontrado.");
    erro.status = 404;
    throw erro;
  }

  const presenteId =
    Number(body.produtoId);

  if (
    !Number.isInteger(presenteId) ||
    presenteId <= 0
  ) {
    const erro =
      new Error("Presente inválido.");
    erro.status = 400;
    throw erro;
  }

  const presente =
    await buscarPresenteDoCasamento(
      casamento.id,
      presenteId
    );

  if (!presente) {
    const erro = new Error(
      "Este presente não pertence a este casamento."
    );
    erro.status = 400;
    throw erro;
  }

  const valor =
    Number(body.valor);

  const valorTotal =
    Number(presente.valor) || 0;

  const arrecadado =
    Number(presente.arrecadado) || 0;

  const restante =
    Math.max(
      valorTotal - arrecadado,
      0
    );

  if (
    !Number.isFinite(valor) ||
    valor <= 0
  ) {
    const erro =
      new Error("Valor inválido.");
    erro.status = 400;
    throw erro;
  }

  if (restante <= 0) {
    const erro =
      new Error(
        "Este presente já foi completado."
      );
    erro.status = 409;
    throw erro;
  }

  if (valor > restante) {
    const erro = new Error(
      `O valor máximo disponível é ${restante.toFixed(2)}.`
    );
    erro.status = 409;
    throw erro;
  }

  const nome =
    String(body.nome || "").trim();

  const email =
    String(body.email || "").trim();

  if (!nome || !email) {
    const erro = new Error(
      "Nome e e-mail são obrigatórios."
    );
    erro.status = 400;
    throw erro;
  }

  return {
    casamento,
    presente,
    valor,
    nome,
    email,
    tipoContribuicao:
      String(
        body.tipoContribuicao || ""
      )
  };
}

async function registrarOrder({
  compra,
  order,
  metodoPagamento
}) {
  const transacao =
    primeiraTransacao(order);

  await pool.query(
    `INSERT INTO casamento_pagamentos (
       casamento_id,
       presente_id,
       pagamento_id,
       order_id,
       transacao_id,
       nome,
       email,
       valor,
       status,
       status_detail,
       metodo_pagamento,
       external_reference,
       produto_nome,
       produto_imagem,
       tipo_contribuicao,
       parcelas,
       payment_method_id,
       atualizado_em
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,
       $10,$11,$12,$13,$14,$15,$16,
       $17,NOW()
     )
     ON CONFLICT (pagamento_id)
     DO UPDATE SET
       order_id = EXCLUDED.order_id,
       transacao_id = EXCLUDED.transacao_id,
       status = EXCLUDED.status,
       status_detail = EXCLUDED.status_detail,
       atualizado_em = NOW()`,
    [
      compra.casamento.id,
      compra.presente.id,

      // Compatibilidade com a tabela antiga:
      // pagamento_id passa a guardar o order_id.
      String(order.id),

      String(order.id),
      transacao?.id
        ? String(transacao.id)
        : null,

      compra.nome,
      compra.email,
      Number(order.total_amount) ||
        compra.valor,

      order.status || null,
      order.status_detail || null,

      metodoPagamento,

      order.external_reference || null,

      compra.presente.nome,
      compra.presente.imagem || null,

      compra.tipoContribuicao || null,

      transacao?.payment_method?.installments ||
        null,

      transacao?.payment_method?.id ||
        null
    ]
  );
}

async function aplicarOrderProcessada(
  orderId,
  order = null
) {
  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } =
      await client.query(
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

    const status =
      order?.status ||
      registro.status;

    const statusDetail =
      order?.status_detail ||
      registro.status_detail;

    if (
      !(
        status === "processed" &&
        statusDetail === "accredited"
      )
    ) {
      await client.query("COMMIT");
      return registro;
    }

    const { rows: presenteRows } =
      await client.query(
        `SELECT
           id,
           valor,
           arrecadado
         FROM casamento_presentes
         WHERE id = $1
           AND casamento_id = $2
         FOR UPDATE`,
        [
          registro.presente_id,
          registro.casamento_id
        ]
      );

    const presente =
      presenteRows[0];

    if (!presente) {
      throw new Error(
        "Presente do pagamento não encontrado."
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
       SET
         arrecadado = $1,
         comprado = ($1 >= valor)
       WHERE id = $2`,
      [
        novoArrecadado,
        presente.id
      ]
    );

    await client.query(
      `UPDATE casamento_pagamentos
       SET
         status = 'processed',
         status_detail = 'accredited',
         valor = $1,
         aplicado_em = NOW(),
         atualizado_em = NOW()
       WHERE order_id = $2`,
      [
        valorPago,
        String(orderId)
      ]
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

// =====================================================
// PIX - ORDERS API
// =====================================================

app.post(
  "/api/casamentos/:slug/pagamentos/pix",
  async (req, res) => {
    try {
      const compra =
        await prepararCompra(
          req.params.slug,
          req.body
        );

      const order =
        await criarOrderPix({
          casamento:
            compra.casamento,
          presente:
            compra.presente,
          valor:
            compra.valor,
          email:
            compra.email
        });

      await registrarOrder({
        compra,
        order,
        metodoPagamento: "pix"
      });

      const pix =
        extrairPix(order);

      return res.status(201).json({
        orderId:
          String(order.id),

        // compatibilidade com o checkout atual
        pagamentoId:
          String(order.id),

        status:
          order.status,

        statusDetail:
          order.status_detail,

        valor:
          Number(order.total_amount) ||
          compra.valor,

        qrCode:
          pix.qrCode,

        qrCodeBase64:
          pix.qrCodeBase64,

        ticketUrl:
          pix.ticketUrl
      });

    } catch (erro) {
      console.error(
        "Erro ao criar Order PIX:",
        erro
      );

      return res
        .status(erro.status || 500)
        .json({
          erro:
            erro.message ||
            "Não foi possível gerar o PIX.",
          detalhe:
            erro?.detalhes?.message ||
            erro.message
        });
    }
  }
);

// =====================================================
// CARTÃO - ORDERS API
// =====================================================

app.post(
  "/api/casamentos/:slug/pagamentos/cartao",
  async (req, res) => {
    try {
      const compra =
        await prepararCompra(
          req.params.slug,
          req.body
        );

      const parcelas =
        Number(req.body.installments);

      if (
        !req.body.token ||
        !req.body.payment_method_id ||
        !Number.isInteger(parcelas) ||
        parcelas <= 0
      ) {
        return res.status(400).json({
          erro:
            "Dados do cartão incompletos."
        });
      }

      const order =
        await criarOrderCartao({
          casamento:
            compra.casamento,

          presente:
            compra.presente,

          valor:
            compra.valor,

          email:
            compra.email,

          token:
            req.body.token,

          installments:
            parcelas,

          paymentMethodId:
            req.body.payment_method_id,

          paymentTypeId:
            req.body.payment_type_id,

          payer:
            req.body.payer
        });

      await registrarOrder({
        compra,
        order,
        metodoPagamento: "cartao"
      });

      if (
        order.status === "processed" &&
        order.status_detail === "accredited"
      ) {
        await aplicarOrderProcessada(
          order.id,
          order
        );
      }

      return res.status(201).json({
        orderId:
          String(order.id),

        pagamentoId:
          String(order.id),

        status:
          order.status,

        statusDetail:
          order.status_detail,

        valor:
          Number(order.total_amount) ||
          compra.valor
      });

    } catch (erro) {
      console.error(
        "Erro ao criar Order de cartão:",
        erro
      );

      return res
        .status(erro.status || 500)
        .json({
          erro:
            erro.message ||
            "Não foi possível processar o cartão.",

          detalhe:
            erro?.detalhes?.message ||
            erro.message,

          erros:
            erro?.detalhes?.errors ||
            []
        });
    }
  }
);

// =====================================================
// STATUS DA ORDER
// =====================================================

app.get(
  "/api/casamentos/:slug/pagamentos/:id/status",
  async (req, res) => {
    try {
      const casamento =
        await buscarCasamentoPorSlug(
          req.params.slug
        );

      if (!casamento) {
        return res.status(404).json({
          erro: "Casamento não encontrado."
        });
      }

      const { rows } =
        await pool.query(
          `SELECT
             casamento_id,
             order_id
           FROM casamento_pagamentos
           WHERE order_id = $1
             AND casamento_id = $2
           LIMIT 1`,
          [
            String(req.params.id),
            casamento.id
          ]
        );

      if (!rows[0]) {
        return res.status(404).json({
          erro:
            "Order não encontrada para este casamento."
        });
      }

      const order =
        await consultarOrder({
          casamentoId:
            casamento.id,

          orderId:
            req.params.id
        });

      const transacao =
        primeiraTransacao(order);

      await pool.query(
        `UPDATE casamento_pagamentos
         SET
           status = $1,
           status_detail = $2,
           transacao_id = COALESCE($3, transacao_id),
           atualizado_em = NOW()
         WHERE order_id = $4
           AND casamento_id = $5`,
        [
          order.status || null,
          order.status_detail || null,
          transacao?.id
            ? String(transacao.id)
            : null,
          String(order.id),
          casamento.id
        ]
      );

      const aprovado =
        order.status === "processed" &&
        order.status_detail === "accredited";

      if (aprovado) {
        await aplicarOrderProcessada(
          order.id,
          order
        );
      }

      return res.json({
        orderId:
          String(order.id),

        pagamentoId:
          String(order.id),

        status:
          order.status,

        statusDetail:
          order.status_detail,

        valor:
          Number(
            order.total_paid_amount ??
            order.total_amount
          ) || 0,

        aprovado
      });

    } catch (erro) {
      console.error(
        "Erro ao consultar Order:",
        erro
      );

      return res
        .status(erro.status || 500)
        .json({
          erro:
            "Não foi possível consultar a Order.",
          detalhe:
            erro.message
        });
    }
  }
);

app.listen(PORT, () => {
  console.log(
    `Asgard Wedding API Fase 4 rodando na porta ${PORT}`
  );
});

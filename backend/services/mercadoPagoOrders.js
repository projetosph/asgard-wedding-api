const crypto = require("crypto");

const { pool } = require("../db");
const {
  descriptografar,
  criptografar
} = require("./mercadoPagoOAuth");

const API_URL = "https://api.mercadopago.com";

function dinheiro(valor) {
  return Number(valor).toFixed(2);
}

function referenciaSegura(valor) {
  return String(valor)
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .slice(0, 64);
}

async function chamarMercadoPago({
  accessToken,
  caminho,
  method = "GET",
  body,
  idempotencyKey
}) {
  const headers = {
    accept: "application/json",
    Authorization: `Bearer ${accessToken}`
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (idempotencyKey) {
    headers["X-Idempotency-Key"] = idempotencyKey;
  }

  const resposta = await fetch(`${API_URL}${caminho}`, {
    method,
    headers,
    body: body === undefined
      ? undefined
      : JSON.stringify(body)
  });

  const texto = await resposta.text();

  let dados = {};
  try {
    dados = texto ? JSON.parse(texto) : {};
  } catch {
    dados = { message: texto };
  }

  if (!resposta.ok) {
    const detalhe =
      dados?.errors?.map?.((e) => e.message || e.code).join(" | ") ||
      dados?.message ||
      dados?.error ||
      `Mercado Pago respondeu com status ${resposta.status}.`;

    const erro = new Error(detalhe);
    erro.status = resposta.status;
    erro.detalhes = dados;
    throw erro;
  }

  return dados;
}

async function renovarAccessToken({
  casamentoId,
  conexao
}) {
  const refreshToken =
    descriptografar(conexao.refresh_token_encrypted);

  if (!refreshToken) {
    throw new Error(
      "A conexão Mercado Pago não possui refresh token. Reconecte a conta."
    );
  }

  const resposta = await fetch(
    `${API_URL}/oauth/token`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id:
          process.env.MERCADO_PAGO_CLIENT_ID,
        client_secret:
          process.env.MERCADO_PAGO_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken
      })
    }
  );

  const texto = await resposta.text();

  let dados = {};
  try {
    dados = texto ? JSON.parse(texto) : {};
  } catch {
    dados = { message: texto };
  }

  if (!resposta.ok || !dados.access_token) {
    const erro = new Error(
      dados.message ||
      dados.error_description ||
      "Não foi possível renovar a conexão Mercado Pago."
    );
    erro.status = resposta.status;
    erro.detalhes = dados;
    throw erro;
  }

  const expiresIn =
    Number(dados.expires_in) || 0;

  const expiresAt =
    expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

  await pool.query(
    `UPDATE casamento_mercadopago
     SET access_token_encrypted = $1,
         refresh_token_encrypted = $2,
         public_key = COALESCE($3, public_key),
         scope = COALESCE($4, scope),
         expires_at = $5,
         atualizado_em = NOW()
     WHERE casamento_id = $6`,
    [
      criptografar(dados.access_token),
      criptografar(
        dados.refresh_token || refreshToken
      ),
      dados.public_key || null,
      dados.scope || null,
      expiresAt,
      casamentoId
    ]
  );

  return dados.access_token;
}

async function obterAccessTokenCasamento(
  casamentoId
) {
  const { rows } = await pool.query(
    `SELECT
       access_token_encrypted,
       refresh_token_encrypted,
       expires_at
     FROM casamento_mercadopago
     WHERE casamento_id = $1
     LIMIT 1`,
    [casamentoId]
  );

  const conexao = rows[0];

  if (!conexao) {
    const erro = new Error(
      "Este casamento ainda não conectou uma conta Mercado Pago."
    );
    erro.status = 409;
    erro.codigo = "mercadopago_nao_conectado";
    throw erro;
  }

  const accessToken =
    descriptografar(
      conexao.access_token_encrypted
    );

  if (!accessToken) {
    const erro = new Error(
      "A conexão Mercado Pago deste casamento está incompleta."
    );
    erro.status = 409;
    throw erro;
  }

  const expiraEm =
    conexao.expires_at
      ? new Date(conexao.expires_at).getTime()
      : 0;

  const margemRenovacao =
    24 * 60 * 60 * 1000; // 24 horas

  if (
    expiraEm &&
    expiraEm <= Date.now() + margemRenovacao
  ) {
    return renovarAccessToken({
      casamentoId,
      conexao
    });
  }

  return accessToken;
}

async function criarOrderPix({
  casamento,
  presente,
  valor,
  email
}) {
  const accessToken =
    await obterAccessTokenCasamento(
      casamento.id
    );

  const externalReference =
    referenciaSegura(
      `${casamento.slug}-${presente.id}-${Date.now()}`
    );

  const order =
    await chamarMercadoPago({
      accessToken,
      caminho: "/v1/orders",
      method: "POST",
      idempotencyKey:
        crypto.randomUUID(),
      body: {
        type: "online",
        total_amount: dinheiro(valor),
        external_reference:
          externalReference,
        processing_mode: "automatic",
        description:
          `Presente: ${presente.nome}`,
        transactions: {
          payments: [
            {
              amount: dinheiro(valor),
              payment_method: {
                id: "pix",
                type: "bank_transfer"
              },
              expiration_time: "P1D"
            }
          ]
        },
        payer: {
          email: String(email).trim()
        }
      }
    });

  return order;
}

async function criarOrderCartao({
  casamento,
  presente,
  valor,
  email,
  token,
  installments,
  paymentMethodId,
  paymentTypeId,
  payer
}) {
  const accessToken =
    await obterAccessTokenCasamento(
      casamento.id
    );

  const externalReference =
    referenciaSegura(
      `${casamento.slug}-${presente.id}-${Date.now()}`
    );

  const paymentMethod = {
    id: String(paymentMethodId),
    type:
      String(paymentTypeId || "credit_card"),
    token: String(token),
    installments:
      Number(installments)
  };

  const payerBody = {
    email:
      payer?.email ||
      String(email).trim()
  };

  if (
    payer?.identification?.type &&
    payer?.identification?.number
  ) {
    payerBody.identification = {
      type: payer.identification.type,
      number: payer.identification.number
    };
  }

  return chamarMercadoPago({
    accessToken,
    caminho: "/v1/orders",
    method: "POST",
    idempotencyKey:
      crypto.randomUUID(),
    body: {
      type: "online",
      total_amount: dinheiro(valor),
      external_reference:
        externalReference,
      processing_mode: "automatic",
      description:
        `Presente: ${presente.nome}`,
      transactions: {
        payments: [
          {
            amount: dinheiro(valor),
            payment_method: paymentMethod
          }
        ]
      },
      payer: payerBody
    }
  });
}

async function consultarOrder({
  casamentoId,
  orderId
}) {
  const accessToken =
    await obterAccessTokenCasamento(
      casamentoId
    );

  return chamarMercadoPago({
    accessToken,
    caminho:
      `/v1/orders/${encodeURIComponent(orderId)}`,
    method: "GET"
  });
}

function primeiraTransacao(order) {
  return (
    order?.transactions?.payments?.[0] ||
    null
  );
}

function extrairPix(order) {
  const transacao =
    primeiraTransacao(order);

  const metodo =
    transacao?.payment_method || {};

  return {
    transacaoId:
      transacao?.id || null,
    qrCode:
      metodo.qr_code || "",
    qrCodeBase64:
      metodo.qr_code_base64 || "",
    ticketUrl:
      metodo.ticket_url || ""
  };
}

module.exports = {
  obterAccessTokenCasamento,
  criarOrderPix,
  criarOrderCartao,
  consultarOrder,
  primeiraTransacao,
  extrairPix
};

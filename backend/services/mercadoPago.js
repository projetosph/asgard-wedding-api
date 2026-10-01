const crypto = require("crypto");

const API_URL = "https://api.mercadopago.com";
const ACCESS_TOKEN = process.env.MERCADO_PAGO_TOKEN;

function validarToken() {
  if (!ACCESS_TOKEN) throw new Error("MERCADO_PAGO_TOKEN não configurada.");
}

async function chamarMercadoPago(caminho, opcoes = {}) {
  validarToken();
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(opcoes.headers || {})
    }
  });
  const texto = await resposta.text();
  let dados = {};
  try { dados = texto ? JSON.parse(texto) : {}; }
  catch { dados = { message: texto }; }

  if (!resposta.ok) {
    const erro = new Error(dados.message || `Mercado Pago respondeu com status ${resposta.status}.`);
    erro.status = resposta.status;
    erro.detalhes = dados;
    throw erro;
  }
  return dados;
}

function separarNome(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: partes.shift() || "Convidado",
    lastName: partes.join(" ") || "Convidado"
  };
}

async function criarPix(d) {
  const { firstName, lastName } = separarNome(d.nome);
  return chamarMercadoPago("/v1/payments", {
    method: "POST",
    headers: { "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({
      transaction_amount: Number(d.valor),
      description: `Presente: ${d.produtoNome}`,
      payment_method_id: "pix",
      external_reference: String(d.externalReference),
      notification_url: d.notificationUrl,
      payer: { email: String(d.email).trim(), first_name: firstName, last_name: lastName },
      metadata: {
        casamento_id: String(d.casamentoId),
        casamento_slug: String(d.casamentoSlug),
        produto_id: String(d.produtoId),
        produto_nome: String(d.produtoNome),
        tipo_contribuicao: String(d.tipoContribuicao || "")
      }
    })
  });
}

async function criarPagamentoCartao(d) {
  const { firstName, lastName } = separarNome(d.nome);
  const corpo = {
    transaction_amount: Number(d.valor),
    token: d.token,
    description: `Presente: ${d.produtoNome}`,
    installments: Number(d.installments),
    payment_method_id: d.paymentMethodId,
    external_reference: String(d.externalReference),
    notification_url: d.notificationUrl,
    payer: {
      email: d.payer?.email || String(d.email).trim(),
      first_name: d.payer?.first_name || firstName,
      last_name: d.payer?.last_name || lastName,
      identification: d.payer?.identification
    },
    metadata: {
      casamento_id: String(d.casamentoId),
      casamento_slug: String(d.casamentoSlug),
      produto_id: String(d.produtoId),
      produto_nome: String(d.produtoNome),
      tipo_contribuicao: String(d.tipoContribuicao || "")
    }
  };
  if (d.issuerId) corpo.issuer_id = d.issuerId;
  return chamarMercadoPago("/v1/payments", {
    method: "POST",
    headers: { "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(corpo)
  });
}

async function consultarPagamento(id) {
  return chamarMercadoPago(`/v1/payments/${encodeURIComponent(id)}`, { method:"GET" });
}

module.exports = { criarPix, criarPagamentoCartao, consultarPagamento };

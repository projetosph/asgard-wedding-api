const crypto = require("crypto");

const AUTH_URL = "https://auth.mercadopago.com/authorization";
const TOKEN_URL = "https://api.mercadopago.com/oauth/token";

function exigirVariaveisOAuth() {
  const obrigatorias = [
    "MERCADO_PAGO_CLIENT_ID",
    "MERCADO_PAGO_CLIENT_SECRET",
    "MERCADO_PAGO_REDIRECT_URI",
    "OAUTH_TOKEN_ENCRYPTION_KEY"
  ];

  const faltando = obrigatorias.filter((nome) => !process.env[nome]);

  if (faltando.length) {
    throw new Error(`Variáveis OAuth ausentes: ${faltando.join(", ")}`);
  }
}

function obterChaveCriptografia() {
  exigirVariaveisOAuth();
  const chave = Buffer.from(process.env.OAUTH_TOKEN_ENCRYPTION_KEY, "base64");

  if (chave.length !== 32) {
    throw new Error(
      "OAUTH_TOKEN_ENCRYPTION_KEY deve representar exatamente 32 bytes em Base64."
    );
  }

  return chave;
}

function base64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function gerarPkce() {
  const codeVerifier = base64Url(crypto.randomBytes(64));

  const codeChallenge = base64Url(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );

  return { codeVerifier, codeChallenge };
}

function gerarState() {
  return base64Url(crypto.randomBytes(32));
}

function construirUrlAutorizacao({ state, codeChallenge }) {
  exigirVariaveisOAuth();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.MERCADO_PAGO_CLIENT_ID,
    redirect_uri: process.env.MERCADO_PAGO_REDIRECT_URI,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });

  return `${AUTH_URL}?${params.toString()}`;
}

async function trocarCodigoPorToken({ code, codeVerifier }) {
  exigirVariaveisOAuth();

  const corpo = new URLSearchParams({
    client_id: process.env.MERCADO_PAGO_CLIENT_ID,
    client_secret: process.env.MERCADO_PAGO_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.MERCADO_PAGO_REDIRECT_URI,
    code_verifier: codeVerifier
  });

  const resposta = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: corpo.toString()
  });

  const texto = await resposta.text();

  let dados = {};
  try {
    dados = texto ? JSON.parse(texto) : {};
  } catch {
    dados = { message: texto };
  }

  if (!resposta.ok) {
    const erro = new Error(
      dados.message ||
      dados.error_description ||
      `Mercado Pago OAuth respondeu com status ${resposta.status}.`
    );
    erro.status = resposta.status;
    erro.detalhes = dados;
    throw erro;
  }

  if (!dados.access_token || !dados.refresh_token || !dados.user_id) {
    throw new Error(
      "O Mercado Pago não retornou todos os dados necessários da conexão."
    );
  }

  return dados;
}

function criptografar(texto) {
  if (!texto) return null;

  const chave = obterChaveCriptografia();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", chave, iv);

  const ciphertext = Buffer.concat([
    cipher.update(String(texto), "utf8"),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64")
  ].join(":");
}

function descriptografar(valor) {
  if (!valor) return null;

  const partes = String(valor).split(":");

  if (partes.length !== 4 || partes[0] !== "v1") {
    throw new Error("Formato de token criptografado inválido.");
  }

  const [, ivB64, tagB64, textoB64] = partes;

  const chave = obterChaveCriptografia();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(textoB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", chave, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return plain.toString("utf8");
}

module.exports = {
  gerarPkce,
  gerarState,
  construirUrlAutorizacao,
  trocarCodigoPorToken,
  criptografar,
  descriptografar
};

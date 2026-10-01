const crypto = require("crypto");

function parseSignature(header) {
  const partes = String(header || "").split(",");
  const out = {};

  for (const parte of partes) {
    const [k, v] = parte.split("=", 2);
    if (k && v) out[k.trim()] = v.trim();
  }

  return out;
}

function validarAssinaturaWebhook(req) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("MERCADO_PAGO_WEBHOOK_SECRET não configurada.");
  }

  const xSignature = req.get("x-signature");
  const xRequestId = req.get("x-request-id");

  if (!xSignature) return false;

  const { ts, v1 } = parseSignature(xSignature);

  if (!ts || !v1) return false;

  const dataIdBruto =
    req.query?.["data.id"] ||
    req.query?.data_id ||
    req.body?.data?.id ||
    "";

  const dataId = String(dataIdBruto).toLowerCase();

  const partesManifest = [];

  if (dataId) {
    partesManifest.push(`id:${dataId};`);
  }

  if (xRequestId) {
    partesManifest.push(`request-id:${xRequestId};`);
  }

  if (ts) {
    partesManifest.push(`ts:${ts};`);
  }

  const manifest = partesManifest.join("");

  const esperado = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(String(v1), "utf8");

  return a.length === b.length &&
    crypto.timingSafeEqual(a, b);
}

module.exports = {
  validarAssinaturaWebhook
};

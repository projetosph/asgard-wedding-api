const crypto = require("crypto");

function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(senha), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verificarSenha(senha, armazenada) {
  const partes = String(armazenada || "").split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;

  const [, salt, hashHex] = partes;
  const calculado = crypto.scryptSync(String(senha), salt, 64);
  const esperado = Buffer.from(hashHex, "hex");

  return calculado.length === esperado.length &&
    crypto.timingSafeEqual(calculado, esperado);
}

module.exports = { hashSenha, verificarSenha };

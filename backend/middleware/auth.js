const jwt = require("jsonwebtoken");

function secret() {
  if (!process.env.AUTH_JWT_SECRET) {
    throw new Error("AUTH_JWT_SECRET não configurada.");
  }
  return process.env.AUTH_JWT_SECRET;
}

function autenticar(req, res, next) {
  try {
    const auth = String(req.get("authorization") || "");
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ erro: "Autenticação necessária." });
    }

    req.usuario = jwt.verify(auth.slice(7).trim(), secret());
    next();
  } catch {
    return res.status(401).json({ erro: "Sessão inválida ou expirada." });
  }
}

function somenteAdmin(req, res, next) {
  if (req.usuario?.perfil !== "admin") {
    return res.status(403).json({ erro: "Acesso restrito ao administrador." });
  }
  next();
}

module.exports = { autenticar, somenteAdmin };

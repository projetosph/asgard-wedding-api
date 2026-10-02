const jwt = require("jsonwebtoken");
const { pool } = require("../db");

function jwtSecret() {
  if (!process.env.AUTH_JWT_SECRET) {
    throw new Error("AUTH_JWT_SECRET não configurada.");
  }

  return process.env.AUTH_JWT_SECRET;
}

function autenticar(req, res, next) {
  try {
    const authorization = String(req.get("authorization") || "");

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        erro: "Faça login para continuar."
      });
    }

    const token = authorization.slice(7).trim();

    req.usuario = jwt.verify(
      token,
      jwtSecret(),
      {
        issuer: "asgard-wedding-api",
        audience: "asgard-wedding"
      }
    );

    return next();

  } catch (erro) {
    return res.status(401).json({
      erro: "Sessão inválida ou expirada."
    });
  }
}

function somenteAdmin(req, res, next) {
  if (req.usuario?.perfil !== "admin") {
    return res.status(403).json({
      erro: "Acesso permitido somente ao administrador."
    });
  }

  return next();
}

function somenteCasal(req, res, next) {
  if (req.usuario?.perfil !== "casal") {
    return res.status(403).json({
      erro: "Acesso permitido somente ao casal."
    });
  }

  return next();
}

/*
 * Protege qualquer rota que use :slug.
 *
 * ADM:
 *   pode acessar qualquer casamento.
 *
 * CASAL:
 *   só pode acessar o casamento cujo id está no JWT.
 */
async function autorizarCasamentoPorSlug(req, res, next) {
  try {
    const slug = String(req.params.slug || "").trim();

    if (!slug) {
      return res.status(400).json({
        erro: "Casamento não informado."
      });
    }

    const { rows } = await pool.query(
      `SELECT id, slug
       FROM casamentos
       WHERE slug = $1
       LIMIT 1`,
      [slug]
    );

    const casamento = rows[0];

    if (!casamento) {
      return res.status(404).json({
        erro: "Casamento não encontrado."
      });
    }

    if (req.usuario?.perfil === "admin") {
      req.casamentoAutorizado = casamento;
      return next();
    }

    if (
      req.usuario?.perfil === "casal" &&
      String(req.usuario.casamentoId) === String(casamento.id)
    ) {
      req.casamentoAutorizado = casamento;
      return next();
    }

    return res.status(403).json({
      erro: "Você não tem acesso a este casamento."
    });

  } catch (erro) {
    console.error("Erro ao validar acesso ao casamento:", erro);

    return res.status(500).json({
      erro: "Não foi possível validar o acesso."
    });
  }
}

module.exports = {
  autenticar,
  somenteAdmin,
  somenteCasal,
  autorizarCasamentoPorSlug
};

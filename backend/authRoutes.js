const express = require("express");
const jwt = require("jsonwebtoken");

const { pool } = require("./db");
const { hashSenha, verificarSenha } = require("./services/senha");
const { autenticar } = require("./middleware/auth");

const router = express.Router();

function gerarToken(usuario) {
  if (!process.env.AUTH_JWT_SECRET) {
    throw new Error("AUTH_JWT_SECRET não configurada.");
  }

  return jwt.sign(
    {
      sub: String(usuario.id),
      perfil: usuario.perfil,
      casamentoId: usuario.casamento_id ? String(usuario.casamento_id) : null,
      nome: usuario.nome,
      email: usuario.email
    },
    process.env.AUTH_JWT_SECRET,
    {
      expiresIn: "8h",
      issuer: "asgard-wedding-api",
      audience: "asgard-wedding"
    }
  );
}

router.post("/api/auth/bootstrap-admin", async (req, res) => {
  try {
    const recebido = String(req.body.secret || "");
    const esperado = String(process.env.ADMIN_BOOTSTRAP_SECRET || "");

    if (!esperado || recebido !== esperado) {
      return res.status(403).json({ erro: "Bootstrap não autorizado." });
    }

    const { rows: admins } = await pool.query(
      `SELECT id FROM usuarios WHERE perfil='admin' LIMIT 1`
    );

    if (admins.length) {
      return res.status(409).json({ erro: "Já existe um administrador cadastrado." });
    }

    const nome = String(req.body.nome || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const senha = String(req.body.senha || "");

    if (!nome || !email || senha.length < 8) {
      return res.status(400).json({
        erro: "Informe nome, e-mail e senha com pelo menos 8 caracteres."
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome,email,senha_hash,perfil)
       VALUES ($1,$2,$3,'admin')
       RETURNING id,nome,email,perfil,criado_em`,
      [nome,email,hashSenha(senha)]
    );

    return res.status(201).json({ criado:true, usuario:rows[0] });

  } catch (erro) {
    console.error("Erro bootstrap:", erro);

    if (erro.code === "23505") {
      return res.status(409).json({ erro:"Esse e-mail já está cadastrado." });
    }

    return res.status(500).json({ erro:"Não foi possível criar o administrador." });
  }
});

router.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const senha = String(req.body.senha || "");

    const { rows } = await pool.query(
      `SELECT id,casamento_id,nome,email,senha_hash,perfil,ativo
       FROM usuarios
       WHERE email=$1
       LIMIT 1`,
      [email]
    );

    const usuario = rows[0];

    if (!usuario || !usuario.ativo || !verificarSenha(senha, usuario.senha_hash)) {
      return res.status(401).json({ erro:"E-mail ou senha inválidos." });
    }

    await pool.query(
      `UPDATE usuarios SET ultimo_login_em=NOW(), atualizado_em=NOW() WHERE id=$1`,
      [usuario.id]
    );

    return res.json({
      token: gerarToken(usuario),
      usuario: {
        id:usuario.id,
        casamentoId:usuario.casamento_id,
        nome:usuario.nome,
        email:usuario.email,
        perfil:usuario.perfil
      }
    });

  } catch (erro) {
    console.error("Erro login:", erro);
    return res.status(500).json({ erro:"Não foi possível entrar agora." });
  }
});

router.get("/api/auth/me", autenticar, (req,res) => {
  res.json({ usuario:req.usuario });
});

module.exports = router;

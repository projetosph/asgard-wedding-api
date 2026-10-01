const express = require("express");
const { pool } = require("./db");
const { autenticar, somenteAdmin } = require("./middleware/auth");
const { hashSenha } = require("./services/senha");

const router = express.Router();
router.use("/api/admin", autenticar, somenteAdmin);

router.get("/api/admin/dashboard", async (req,res) => {
  try {
    const [c,p,pr,mp] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int total,
                         COUNT(*) FILTER (WHERE status='publicado')::int publicados
                  FROM casamentos`),
      pool.query(`SELECT COALESCE(SUM(valor) FILTER (
                         WHERE status='processed' AND status_detail='accredited'
                       ),0)::numeric(12,2) arrecadado
                  FROM casamento_pagamentos`),
      pool.query(`SELECT COALESCE(SUM(quantidade),0)::int confirmados
                  FROM casamento_presencas`),
      pool.query(`SELECT COUNT(*)::int conectados FROM casamento_mercadopago`)
    ]);

    res.json({
      casamentosTotal:c.rows[0].total,
      casamentosPublicados:c.rows[0].publicados,
      arrecadadoTotal:p.rows[0].arrecadado,
      convidadosConfirmados:pr.rows[0].confirmados,
      mercadoPagoConectados:mp.rows[0].conectados
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro:"Não foi possível carregar o dashboard." });
  }
});

router.get("/api/admin/casamentos", async (req,res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         c.id,c.slug,c.noivo,c.noiva,c.data_casamento,c.horario,
         c.local_nome,c.local_endereco,c.template,c.status,
         c.cor_primaria,c.cor_secundaria,
         (mp.casamento_id IS NOT NULL) mercadopago_conectado,
         COALESCE(p.total_presentes,0)::int total_presentes,
         COALESCE(pr.total_confirmados,0)::int total_confirmados
       FROM casamentos c
       LEFT JOIN casamento_mercadopago mp ON mp.casamento_id=c.id
       LEFT JOIN (
         SELECT casamento_id, COUNT(*) total_presentes
         FROM casamento_presentes
         WHERE ativo=TRUE
         GROUP BY casamento_id
       ) p ON p.casamento_id=c.id
       LEFT JOIN (
         SELECT casamento_id, SUM(quantidade) total_confirmados
         FROM casamento_presencas
         GROUP BY casamento_id
       ) pr ON pr.casamento_id=c.id
       ORDER BY c.data_casamento ASC, c.id ASC`
    );

    res.json(rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro:"Não foi possível carregar os casamentos." });
  }
});

router.post("/api/admin/casamentos", async (req,res) => {
  try {
    const slug = String(req.body.slug || "")
      .trim().toLowerCase()
      .replace(/[^a-z0-9-]/g,"-")
      .replace(/-+/g,"-")
      .replace(/^-|-$/g,"");

    if (!slug || !req.body.noivo || !req.body.noiva || !req.body.dataCasamento) {
      return res.status(400).json({
        erro:"Slug, noivo, noiva e data são obrigatórios."
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO casamentos (
         slug,noivo,noiva,data_casamento,horario,local_nome,local_endereco,
         mapa_url,template,status,cor_primaria,cor_secundaria,foto_capa
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        slug,
        String(req.body.noivo).trim(),
        String(req.body.noiva).trim(),
        req.body.dataCasamento,
        req.body.horario || null,
        req.body.localNome || null,
        req.body.localEndereco || null,
        req.body.mapaUrl || null,
        req.body.template || "template-01",
        req.body.status || "rascunho",
        req.body.corPrimaria || null,
        req.body.corSecundaria || null,
        req.body.fotoCapa || null
      ]
    );

    res.status(201).json(rows[0]);

  } catch (erro) {
    console.error(erro);

    if (erro.code === "23505") {
      return res.status(409).json({ erro:"Já existe um casamento com esse slug." });
    }

    res.status(500).json({ erro:"Não foi possível criar o casamento." });
  }
});

router.put("/api/admin/casamentos/:id", async (req,res) => {
  try {
    const id = Number(req.params.id);

    const mapa = {
      noivo:req.body.noivo,
      noiva:req.body.noiva,
      data_casamento:req.body.dataCasamento,
      horario:req.body.horario,
      local_nome:req.body.localNome,
      local_endereco:req.body.localEndereco,
      mapa_url:req.body.mapaUrl,
      template:req.body.template,
      status:req.body.status,
      cor_primaria:req.body.corPrimaria,
      cor_secundaria:req.body.corSecundaria,
      foto_capa:req.body.fotoCapa
    };

    const chaves = Object.keys(mapa).filter(k => mapa[k] !== undefined);

    if (!chaves.length) {
      return res.status(400).json({ erro:"Nenhuma alteração informada." });
    }

    const valores = chaves.map(k => mapa[k]);
    valores.push(id);

    const sets = chaves.map((k,i) => `${k}=$${i+1}`);

    const { rows } = await pool.query(
      `UPDATE casamentos SET ${sets.join(", ")}
       WHERE id=$${valores.length}
       RETURNING *`,
      valores
    );

    if (!rows[0]) {
      return res.status(404).json({ erro:"Casamento não encontrado." });
    }

    res.json(rows[0]);

  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro:"Não foi possível editar o casamento." });
  }
});

router.post("/api/admin/casamentos/:id/usuario-casal", async (req,res) => {
  try {
    const casamentoId = Number(req.params.id);
    const nome = String(req.body.nome || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const senha = String(req.body.senha || "");

    if (!Number.isInteger(casamentoId) || !nome || !email || senha.length < 8) {
      return res.status(400).json({
        erro:"Informe casamento, nome, e-mail e senha com pelo menos 8 caracteres."
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO usuarios (
         casamento_id,nome,email,senha_hash,perfil
       )
       VALUES ($1,$2,$3,$4,'casal')
       ON CONFLICT (email)
       DO UPDATE SET
         casamento_id=EXCLUDED.casamento_id,
         nome=EXCLUDED.nome,
         senha_hash=EXCLUDED.senha_hash,
         perfil='casal',
         ativo=TRUE,
         atualizado_em=NOW()
       RETURNING id,casamento_id,nome,email,perfil,ativo`,
      [casamentoId,nome,email,hashSenha(senha)]
    );

    res.status(201).json({ criado:true, usuario:rows[0] });

  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro:"Não foi possível criar o acesso do casal." });
  }
});

module.exports = router;

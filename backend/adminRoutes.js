const express = require("express");
const { pool } = require("./db");
const { autenticar, somenteAdmin } = require("./middleware/auth");
const { hashSenha } = require("./services/senha");

const router = express.Router();

router.use("/api/admin", autenticar, somenteAdmin);

const STATUS_VALIDOS = new Set([
  "rascunho",
  "publicado",
  "pausado",
  "concluido",
  "cancelado",
  "arquivado"
]);

function normalizarStatus(valor) {
  const s = String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const aliases = {
    "no-ar": "publicado",
    "no_ar": "publicado",
    "online": "publicado",
    "ativo": "publicado",
    "publicar": "publicado",
    "pausar": "pausado",
    "pausa": "pausado",
    "concluido": "concluido",
    "concluído": "concluido",
    "finalizado": "concluido",
    "cancelar": "cancelado",
    "cancelado": "cancelado",
    "arquivar": "arquivado",
    "arquivado": "arquivado",
    "rascunho": "rascunho"
  };

  return aliases[s] || s;
}

async function registrarHistoricoOpcional(client, casamentoId, statusAnterior, statusNovo, motivo = null) {
  try {
    await client.query(
      `INSERT INTO casamento_status_historico
         (casamento_id, status_anterior, status_novo, motivo, criado_em)
       VALUES ($1,$2,$3,$4,NOW())`,
      [casamentoId, statusAnterior || null, statusNovo, motivo || null]
    );
  } catch (erro) {
    // O histórico é adicional. Não impede a alteração de status.
    if (!["42P01", "42703"].includes(erro.code)) {
      throw erro;
    }
  }
}

async function alterarStatus(req, res) {
  const casamentoId = Number(req.params.id);
  const statusNovo = normalizarStatus(
    req.body?.status ??
    req.body?.novoStatus ??
    req.body?.novo_status
  );
  const motivo = String(req.body?.motivo || "").trim() || null;

  if (!Number.isInteger(casamentoId) || casamentoId <= 0) {
    return res.status(400).json({ erro: "ID do casamento inválido." });
  }

  if (!STATUS_VALIDOS.has(statusNovo)) {
    return res.status(400).json({
      erro: `Status inválido: ${statusNovo || "(vazio)"}.`
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const atual = await client.query(
      `SELECT id, slug, noivo, noiva, status
       FROM casamentos
       WHERE id=$1
       FOR UPDATE`,
      [casamentoId]
    );

    if (!atual.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Casamento não encontrado." });
    }

    const statusAnterior = atual.rows[0].status;

    // Atualiza SOMENTE a coluna status.
    // Isso deixa a rota compatível mesmo se as colunas novas ainda não existirem.
    const atualizado = await client.query(
      `UPDATE casamentos
       SET status=$1
       WHERE id=$2
       RETURNING *`,
      [statusNovo, casamentoId]
    );

    // Campos extras são opcionais; se ainda não existirem, não bloqueiam o comando.
    try {
      await client.query(
        `UPDATE casamentos
         SET
           status_atualizado_em=NOW(),
           arquivado_em=CASE
             WHEN $1='arquivado' THEN NOW()
             ELSE NULL
           END
         WHERE id=$2`,
        [statusNovo, casamentoId]
      );
    } catch (erro) {
      if (erro.code !== "42703") {
        throw erro;
      }
    }

    await registrarHistoricoOpcional(
      client,
      casamentoId,
      statusAnterior,
      statusNovo,
      motivo
    );

    await client.query("COMMIT");

    return res.json({
      ok: true,
      casamento: atualizado.rows[0],
      statusAnterior,
      statusNovo
    });
  } catch (erro) {
    try { await client.query("ROLLBACK"); } catch {}

    console.error("Erro ao alterar status do casamento:", erro);

    if (erro.code === "23514") {
      return res.status(400).json({
        erro:
          "O banco possui uma restrição antiga na coluna status. " +
          "Execute a migration 010_status_sites.sql e tente novamente.",
        codigo: erro.code
      });
    }

    return res.status(500).json({
      erro: "Não foi possível alterar o status do casamento.",
      codigo: erro.code || null
    });
  } finally {
    client.release();
  }
}


// =====================================================
// DASHBOARD
// =====================================================

router.get("/api/admin/dashboard", async (req,res) => {
  try {
    const [c,p,pr,mp] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int total,
          COUNT(*) FILTER (WHERE status='publicado')::int publicados
        FROM casamentos
      `),
      pool.query(`
        SELECT COALESCE(SUM(valor) FILTER (
          WHERE status='processed' AND status_detail='accredited'
        ),0)::numeric(12,2) arrecadado
        FROM casamento_pagamentos
      `),
      pool.query(`
        SELECT COALESCE(SUM(quantidade),0)::int confirmados
        FROM casamento_presencas
      `),
      pool.query(`
        SELECT COUNT(*)::int conectados
        FROM casamento_mercadopago
      `)
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


// =====================================================
// LISTAR CASAMENTOS
// =====================================================

router.get("/api/admin/casamentos", async (req,res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
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
      ORDER BY c.data_casamento ASC, c.id ASC
    `);

    res.json(rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro:"Não foi possível carregar os casamentos." });
  }
});


// =====================================================
// CRIAR CASAMENTO
// =====================================================

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

    const status = normalizarStatus(req.body.status || "rascunho");

    if (!STATUS_VALIDOS.has(status)) {
      return res.status(400).json({ erro:"Status inválido." });
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
        status,
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


// =====================================================
// EDITAR CASAMENTO
// =====================================================

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
      cor_primaria:req.body.corPrimaria,
      cor_secundaria:req.body.corSecundaria,
      foto_capa:req.body.fotoCapa
    };

    if (req.body.status !== undefined) {
      const status = normalizarStatus(req.body.status);

      if (!STATUS_VALIDOS.has(status)) {
        return res.status(400).json({ erro:"Status inválido." });
      }

      mapa.status = status;
    }

    const chaves = Object.keys(mapa).filter(k => mapa[k] !== undefined);

    if (!chaves.length) {
      return res.status(400).json({ erro:"Nenhuma alteração informada." });
    }

    const valores = chaves.map(k => mapa[k]);
    valores.push(id);

    const sets = chaves.map((k,i) => `${k}=$${i+1}`);

    const { rows } = await pool.query(
      `UPDATE casamentos
       SET ${sets.join(", ")}
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


// =====================================================
// STATUS / CICLO DE VIDA
// Suporta POST, PUT e PATCH para evitar incompatibilidade
// entre versões antigas e novas do frontend.
// =====================================================

router.post("/api/admin/casamentos/:id/status", alterarStatus);
router.put("/api/admin/casamentos/:id/status", alterarStatus);
router.patch("/api/admin/casamentos/:id/status", alterarStatus);


// =====================================================
// HISTÓRICO
// =====================================================

router.get("/api/admin/casamentos/:id/historico-status", async (req,res) => {
  const casamentoId = Number(req.params.id);

  try {
    const { rows } = await pool.query(
      `SELECT id, casamento_id, status_anterior, status_novo, motivo, criado_em
       FROM casamento_status_historico
       WHERE casamento_id=$1
       ORDER BY criado_em DESC, id DESC`,
      [casamentoId]
    );

    res.json(rows);
  } catch (erro) {
    if (erro.code === "42P01") {
      return res.json([]);
    }

    console.error(erro);
    res.status(500).json({ erro:"Não foi possível carregar o histórico." });
  }
});


// =====================================================
// LOGIN DO CASAL
// Protege contas ADM contra sobrescrita.
// =====================================================

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

    const existente = await pool.query(
      `SELECT id, perfil
       FROM usuarios
       WHERE LOWER(email)=LOWER($1)
       LIMIT 1`,
      [email]
    );

    if (existente.rows[0]?.perfil === "admin") {
      return res.status(409).json({
        erro:"Esse e-mail pertence a um administrador e não pode ser usado como acesso de casal."
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
       WHERE usuarios.perfil <> 'admin'
       RETURNING id,casamento_id,nome,email,perfil,ativo`,
      [casamentoId,nome,email,hashSenha(senha)]
    );

    if (!rows[0]) {
      return res.status(409).json({
        erro:"Não foi possível usar esse e-mail para o casal."
      });
    }

    res.status(201).json({ criado:true, usuario:rows[0] });

  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro:"Não foi possível criar o acesso do casal." });
  }
});


module.exports = router;

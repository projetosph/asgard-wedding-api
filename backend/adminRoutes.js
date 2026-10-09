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

const TEMPLATES_VALIDOS = new Set([
  "template-01",
  "template-02",
  "template-03",
  "template-04"
]);

function slugSeguro(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function registrarHistorico(client, casamento, novoStatus, req, observacao = null) {
  await client.query(
    `INSERT INTO casamento_status_historico (
       casamento_id,
       casamento_id_original,
       slug,
       noivo,
       noiva,
       status_anterior,
       status_novo,
       observacao,
       alterado_por
     )
     VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      casamento.id,
      casamento.slug,
      casamento.noivo,
      casamento.noiva,
      casamento.status,
      novoStatus,
      observacao || null,
      Number(req.usuario?.id) || null
    ]
  );
}

router.get("/api/admin/dashboard", async (req, res) => {
  try {
    const [c,p,pr,mp] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int total,
           COUNT(*) FILTER (WHERE status='publicado')::int publicados,
           COUNT(*) FILTER (WHERE status='pausado')::int pausados,
           COUNT(*) FILTER (WHERE status='concluido')::int concluidos,
           COUNT(*) FILTER (WHERE status='cancelado')::int cancelados
         FROM casamentos`
      ),
      pool.query(
        `SELECT COALESCE(SUM(valor) FILTER (
           WHERE status='processed' AND status_detail='accredited'
         ),0)::numeric(12,2) arrecadado
         FROM casamento_pagamentos`
      ),
      pool.query(
        `SELECT COALESCE(SUM(quantidade),0)::int confirmados
         FROM casamento_presencas`
      ),
      pool.query(
        `SELECT COUNT(*)::int conectados
         FROM casamento_mercadopago`
      )
    ]);

    res.json({
      casamentosTotal: c.rows[0].total,
      casamentosPublicados: c.rows[0].publicados,
      casamentosPausados: c.rows[0].pausados,
      casamentosConcluidos: c.rows[0].concluidos,
      casamentosCancelados: c.rows[0].cancelados,
      arrecadadoTotal: p.rows[0].arrecadado,
      convidadosConfirmados: pr.rows[0].confirmados,
      mercadoPagoConectados: mp.rows[0].conectados
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
         c.local_nome,c.local_endereco,c.mapa_url,c.template,c.status,
         c.cor_primaria,c.cor_secundaria,c.foto_capa,
         c.status_atualizado_em,c.arquivado_em,
         (mp.casamento_id IS NOT NULL) mercadopago_conectado,
         COALESCE(p.total_presentes,0)::int total_presentes,
         COALESCE(pr.total_confirmados,0)::int total_confirmados,
         COALESCE(pg.total_pagamentos,0)::int total_pagamentos
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
       LEFT JOIN (
         SELECT casamento_id, COUNT(*) total_pagamentos
         FROM casamento_pagamentos
         GROUP BY casamento_id
       ) pg ON pg.casamento_id=c.id
       ORDER BY
         CASE c.status
           WHEN 'publicado' THEN 1
           WHEN 'rascunho' THEN 2
           WHEN 'pausado' THEN 3
           WHEN 'concluido' THEN 4
           WHEN 'cancelado' THEN 5
           WHEN 'arquivado' THEN 6
           ELSE 7
         END,
         c.data_casamento DESC NULLS LAST,
         c.id DESC`
    );

    res.json(rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro:"Não foi possível carregar os casamentos." });
  }
});

router.get("/api/admin/casamentos/:id/historico", async (req,res) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT
         id,casamento_id_original,slug,noivo,noiva,
         status_anterior,status_novo,observacao,criado_em
       FROM casamento_status_historico
       WHERE casamento_id_original = $1
       ORDER BY criado_em DESC, id DESC`,
      [id]
    );
    res.json(rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro:"Não foi possível carregar o histórico." });
  }
});

router.post("/api/admin/casamentos", async (req,res) => {
  try {
    const slug = slugSeguro(req.body.slug);
    const template = TEMPLATES_VALIDOS.has(req.body.template)
      ? req.body.template
      : "template-01";
    const status = STATUS_VALIDOS.has(req.body.status)
      ? req.body.status
      : "rascunho";

    if (!slug || !req.body.noivo || !req.body.noiva || !req.body.dataCasamento) {
      return res.status(400).json({
        erro:"Slug, noivo, noiva e data são obrigatórios."
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO casamentos (
         slug,noivo,noiva,data_casamento,horario,local_nome,local_endereco,
         mapa_url,template,status,cor_primaria,cor_secundaria,foto_capa,
         status_atualizado_em
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
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
        template,
        status,
        req.body.corPrimaria || null,
        req.body.corSecundaria || null,
        req.body.fotoCapa || null
      ]
    );

    const c = rows[0];
    await pool.query(
      `INSERT INTO casamento_status_historico (
         casamento_id,casamento_id_original,slug,noivo,noiva,
         status_anterior,status_novo,observacao,alterado_por
       )
       VALUES ($1,$1,$2,$3,$4,NULL,$5,'Site criado no ADM',$6)`,
      [c.id,c.slug,c.noivo,c.noiva,c.status,Number(req.usuario?.id)||null]
    );

    res.status(201).json(c);
  } catch (erro) {
    console.error(erro);
    if (erro.code === "23505") {
      return res.status(409).json({ erro:"Já existe um casamento com esse slug." });
    }
    res.status(500).json({ erro:"Não foi possível criar o casamento." });
  }
});

router.put("/api/admin/casamentos/:id", async (req,res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = Number(req.params.id);

    const { rows: atuais } = await client.query(
      `SELECT * FROM casamentos WHERE id=$1 FOR UPDATE`,
      [id]
    );
    const atual = atuais[0];
    if (!atual) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro:"Casamento não encontrado." });
    }

    if (
      req.body.template !== undefined &&
      !TEMPLATES_VALIDOS.has(req.body.template)
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({ erro:"Template inválido." });
    }

    if (
      req.body.status !== undefined &&
      !STATUS_VALIDOS.has(req.body.status)
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({ erro:"Status inválido." });
    }

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
      await client.query("ROLLBACK");
      return res.status(400).json({ erro:"Nenhuma alteração informada." });
    }

    const statusMudou =
      req.body.status !== undefined &&
      req.body.status !== atual.status;

    if (statusMudou) {
      await registrarHistorico(
        client,
        atual,
        req.body.status,
        req,
        req.body.observacaoStatus || null
      );
      mapa.status_atualizado_em = new Date();
      if (req.body.status === "arquivado") mapa.arquivado_em = new Date();
      if (atual.status === "arquivado" && req.body.status !== "arquivado") mapa.arquivado_em = null;
    }

    const chavesFinais = Object.keys(mapa).filter(k => mapa[k] !== undefined);
    const valores = chavesFinais.map(k => mapa[k]);
    valores.push(id);
    const sets = chavesFinais.map((k,i) => `${k}=$${i+1}`);

    const { rows } = await client.query(
      `UPDATE casamentos
       SET ${sets.join(", ")}
       WHERE id=$${valores.length}
       RETURNING *`,
      valores
    );

    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (erro) {
    await client.query("ROLLBACK");
    console.error(erro);
    res.status(500).json({ erro:"Não foi possível editar o casamento." });
  } finally {
    client.release();
  }
});


// =====================================================
// STATUS / CICLO DE VIDA
// Compatível com bancos que ainda não possuem todos os
// campos de histórico. A mudança de status NÃO é bloqueada
// se o histórico falhar.
// =====================================================

async function alterarStatusCasamento(req,res) {
  const id = Number(req.params.id);
  const novoStatus = String(
    req.body?.status ??
    req.body?.novoStatus ??
    req.body?.novo_status ??
    ""
  ).trim();

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro:"ID do casamento inválido." });
  }

  if (!STATUS_VALIDOS.has(novoStatus)) {
    return res.status(400).json({ erro:"Status inválido." });
  }

  try {
    const atual = await pool.query(
      `SELECT id,slug,noivo,noiva,status
       FROM casamentos
       WHERE id=$1`,
      [id]
    );

    const casamento = atual.rows[0];

    if (!casamento) {
      return res.status(404).json({ erro:"Casamento não encontrado." });
    }

    // Primeiramente altera o status. Somente a coluna STATUS é obrigatória.
    const atualizado = await pool.query(
      `UPDATE casamentos
       SET status=$1
       WHERE id=$2
       RETURNING *`,
      [novoStatus,id]
    );

    // Campos adicionais são opcionais e não podem bloquear o botão.
    try {
      await pool.query(
        `UPDATE casamentos
         SET
           status_atualizado_em=NOW(),
           arquivado_em=CASE
             WHEN $1='arquivado' THEN NOW()
             ELSE NULL
           END
         WHERE id=$2`,
        [novoStatus,id]
      );
    } catch (erroExtra) {
      if (erroExtra.code !== "42703") {
        console.warn("Aviso ao atualizar metadados do status:", erroExtra.message);
      }
    }

    // Histórico também é opcional. Tentamos formatos novos e antigos.
    if (casamento.status !== novoStatus) {
      const observacao =
        req.body?.observacao ||
        req.body?.motivo ||
        `Alterado pelo ADM para ${novoStatus}`;

      try {
        await pool.query(
          `INSERT INTO casamento_status_historico (
             casamento_id,
             casamento_id_original,
             slug,
             noivo,
             noiva,
             status_anterior,
             status_novo,
             observacao,
             alterado_por,
             criado_em
           )
           VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
          [
            casamento.id,
            casamento.slug,
            casamento.noivo,
            casamento.noiva,
            casamento.status,
            novoStatus,
            observacao,
            Number(req.usuario?.id) || null
          ]
        );
      } catch (historicoNovoErro) {
        try {
          await pool.query(
            `INSERT INTO casamento_status_historico (
               casamento_id,
               status_anterior,
               status_novo,
               motivo,
               criado_em
             )
             VALUES ($1,$2,$3,$4,NOW())`,
            [
              casamento.id,
              casamento.status,
              novoStatus,
              observacao
            ]
          );
        } catch (historicoAntigoErro) {
          console.warn(
            "Status alterado, mas histórico não pôde ser gravado:",
            historicoAntigoErro.message
          );
        }
      }
    }

    return res.json({
      ok:true,
      casamento:atualizado.rows[0],
      statusAnterior:casamento.status,
      statusNovo:novoStatus
    });

  } catch (erro) {
    console.error("Erro ao alterar status:", erro);

    if (erro.code === "23514") {
      return res.status(400).json({
        erro:
          "A coluna status ainda possui uma restrição antiga no banco. " +
          "Execute a migration 011_admin_acoes_compat.sql.",
        codigo:erro.code
      });
    }

    return res.status(500).json({
      erro:`Não foi possível alterar o status. ${erro.message || ""}`.trim(),
      codigo:erro.code || null
    });
  }
}

router.post("/api/admin/casamentos/:id/status", alterarStatusCasamento);
router.put("/api/admin/casamentos/:id/status", alterarStatusCasamento);
router.patch("/api/admin/casamentos/:id/status", alterarStatusCasamento);


// =====================================================
// EXCLUSÃO DEFINITIVA
// Descobre automaticamente TODAS as tabelas que possuem
// chave estrangeira direta para casamentos(id).
// Isso evita quebra quando novas tabelas forem adicionadas.
// =====================================================

function quoteIdent(nome) {
  return `"${String(nome).replaceAll('"','""')}"`;
}

router.delete("/api/admin/casamentos/:id", async (req,res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro:"ID do casamento inválido." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const atual = await client.query(
      `SELECT id,slug,noivo,noiva,status
       FROM casamentos
       WHERE id=$1
       FOR UPDATE`,
      [id]
    );

    const casamento = atual.rows[0];

    if (!casamento) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro:"Casamento não encontrado." });
    }

    // Grava histórico técnico sem impedir a exclusão caso a estrutura seja antiga.
    await client.query("SAVEPOINT antes_historico_exclusao");

    try {
      await client.query(
        `INSERT INTO casamento_status_historico (
           casamento_id_original,
           slug,
           noivo,
           noiva,
           status_anterior,
           status_novo,
           observacao,
           alterado_por,
           criado_em
         )
         VALUES ($1,$2,$3,$4,$5,'excluido',$6,$7,NOW())`,
        [
          casamento.id,
          casamento.slug,
          casamento.noivo,
          casamento.noiva,
          casamento.status,
          "Exclusão definitiva solicitada no ADM",
          Number(req.usuario?.id) || null
        ]
      );

      await client.query("RELEASE SAVEPOINT antes_historico_exclusao");
    } catch (histErro) {
      await client.query("ROLLBACK TO SAVEPOINT antes_historico_exclusao");
      await client.query("RELEASE SAVEPOINT antes_historico_exclusao");
      console.warn("Exclusão continuará sem gravar histórico:", histErro.message);
    }

    // Localiza FKs simples que apontam para casamentos(id).
    const dependencias = await client.query(`
      SELECT DISTINCT
        ns.nspname AS schema_name,
        rel.relname AS table_name,
        att.attname AS column_name
      FROM pg_constraint con
      JOIN pg_class rel
        ON rel.oid = con.conrelid
      JOIN pg_namespace ns
        ON ns.oid = rel.relnamespace
      JOIN unnest(con.conkey) WITH ORDINALITY AS ck(attnum, ord)
        ON TRUE
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = ck.attnum
      WHERE con.contype='f'
        AND con.confrelid='casamentos'::regclass
        AND array_length(con.conkey,1)=1
        AND array_length(con.confkey,1)=1
    `);

    for (const dep of dependencias.rows) {
      // O histórico técnico é preservado quando usa casamento_id_original
      // e não precisa ser apagado.
      if (dep.table_name === "casamento_status_historico") {
        continue;
      }

      const sql =
        `DELETE FROM ${quoteIdent(dep.schema_name)}.${quoteIdent(dep.table_name)}
         WHERE ${quoteIdent(dep.column_name)}=$1`;

      await client.query(sql,[id]);
    }

    // Compatibilidade com tabelas que guardam casamento_id sem FK.
    const tabelasExtras = [
      "casamento_pagamentos",
      "casamento_presentes",
      "casamento_presencas",
      "casamento_recados",
      "casamento_galeria",
      "casamento_musica",
      "casamento_mercadopago",
      "mercadopago_oauth_tentativas",
      "mercadopago_connect_tickets",
      "mercadopago_webhook_eventos",
      "usuarios"
    ];

    for (const tabela of tabelasExtras) {
      const existe = await client.query(
        `SELECT to_regclass($1) AS tabela`,
        [`public.${tabela}`]
      );

      if (!existe.rows[0]?.tabela) continue;

      const colunaExiste = await client.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema='public'
           AND table_name=$1
           AND column_name='casamento_id'
         LIMIT 1`,
        [tabela]
      );

      if (!colunaExiste.rows[0]) continue;

      await client.query(
        `DELETE FROM ${quoteIdent(tabela)}
         WHERE casamento_id=$1`,
        [id]
      );
    }

    await client.query(
      `DELETE FROM casamentos WHERE id=$1`,
      [id]
    );

    await client.query("COMMIT");

    return res.json({
      ok:true,
      excluido:true,
      id
    });

  } catch (erro) {
    try { await client.query("ROLLBACK"); } catch {}

    console.error("Erro ao excluir casamento:", erro);

    return res.status(500).json({
      erro:
        "Não foi possível excluir definitivamente. " +
        (erro.detail || erro.message || "Existe uma dependência no banco."),
      codigo:erro.code || null
    });

  } finally {
    client.release();
  }
});

router.post("/api/admin/casamentos/:id/reutilizar", async (req,res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const id = Number(req.params.id);

    const { rows } = await client.query(
      `SELECT * FROM casamentos WHERE id=$1 FOR UPDATE`,
      [id]
    );
    const atual = rows[0];
    if (!atual) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro:"Casamento não encontrado." });
    }

    const novoSlug = slugSeguro(req.body.slug);
    const noivo = String(req.body.noivo || "").trim();
    const noiva = String(req.body.noiva || "").trim();
    const dataCasamento = req.body.dataCasamento;

    if (!novoSlug || !noivo || !noiva || !dataCasamento) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        erro:"Informe novo slug, noivo, noiva e data."
      });
    }

    await registrarHistorico(
      client,
      atual,
      "reutilizado",
      req,
      `Estrutura reutilizada para ${noivo} & ${noiva}`
    );

    const comandos = [
      `DELETE FROM casamento_pagamentos WHERE casamento_id=$1`,
      `DELETE FROM casamento_presentes WHERE casamento_id=$1`,
      `DELETE FROM casamento_presencas WHERE casamento_id=$1`,
      `DELETE FROM casamento_recados WHERE casamento_id=$1`,
      `DELETE FROM casamento_galeria WHERE casamento_id=$1`,
      `DELETE FROM casamento_musica WHERE casamento_id=$1`,
      `DELETE FROM casamento_mercadopago WHERE casamento_id=$1`,
      `DELETE FROM mercadopago_oauth_tentativas WHERE casamento_id=$1`,
      `DELETE FROM mercadopago_connect_tickets WHERE casamento_id=$1`,
      `DELETE FROM usuarios WHERE casamento_id=$1 AND perfil='casal'`
    ];

    for (const sql of comandos) {
      try {
        await client.query(sql, [id]);
      } catch (e) {
        if (e.code !== "42P01") throw e;
      }
    }

    const template = TEMPLATES_VALIDOS.has(req.body.template)
      ? req.body.template
      : "template-01";

    const { rows: atualizados } = await client.query(
      `UPDATE casamentos
       SET
         slug=$1,
         noivo=$2,
         noiva=$3,
         data_casamento=$4,
         horario=$5,
         local_nome=$6,
         local_endereco=$7,
         mapa_url=$8,
         template=$9,
         status='rascunho',
         status_atualizado_em=NOW(),
         arquivado_em=NULL,
         contribuicao_livre_ativa=FALSE,
         contribuicao_livre_titulo=NULL,
         contribuicao_livre_descricao=NULL,
         contribuicao_livre_imagem=NULL
       WHERE id=$10
       RETURNING *`,
      [
        novoSlug,
        noivo,
        noiva,
        dataCasamento,
        req.body.horario || null,
        req.body.localNome || null,
        req.body.localEndereco || null,
        req.body.mapaUrl || null,
        template,
        id
      ]
    );

    await client.query("COMMIT");
    res.json(atualizados[0]);
  } catch (erro) {
    await client.query("ROLLBACK");
    console.error(erro);
    if (erro.code === "23505") {
      return res.status(409).json({ erro:"Esse slug já está em uso." });
    }
    res.status(500).json({ erro:"Não foi possível reutilizar esta estrutura." });
  } finally {
    client.release();
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

    const { rows: usuarioExistente } = await pool.query(
      `SELECT id,perfil FROM usuarios WHERE email=$1 LIMIT 1`,
      [email]
    );

    if (usuarioExistente[0]?.perfil === "admin") {
      return res.status(409).json({
        erro:"Este e-mail pertence ao administrador e não pode ser usado como acesso de casal."
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
        erro:"Este e-mail não pode ser usado para o casal."
      });
    }

    res.status(201).json({ criado:true, usuario:rows[0] });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro:"Não foi possível criar o acesso do casal." });
  }
});

module.exports = router;

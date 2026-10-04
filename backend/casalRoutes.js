const express = require("express");
const { pool } = require("./db");
const {
  autenticar,
  somenteCasal
} = require("./middleware/auth");

const router = express.Router();

router.use("/api/casal", autenticar, somenteCasal);

function casamentoIdDoUsuario(req) {
  const id = Number(req.usuario?.casamentoId);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

router.get("/api/casal/painel", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);

    if (!casamentoId) {
      return res.status(403).json({
        erro: "Este usuário não está vinculado a um casamento."
      });
    }

    const [
      casamentoResult,
      presentesResult,
      pagamentosResult,
      presencasResult,
      recadosResult,
      galeriaResult,
      musicaResult
    ] = await Promise.all([
      pool.query(
        `SELECT
           id,
           slug,
           noivo,
           noiva,
           data_casamento,
           horario,
           local_nome,
           local_endereco,
           template,
           status
         FROM casamentos
         WHERE id = $1
         LIMIT 1`,
        [casamentoId]
      ),

      pool.query(
        `SELECT
           id,
           nome,
           descricao,
           valor,
           arrecadado,
           imagem,
           link,
           comprado,
           ativo,
           ordem
         FROM casamento_presentes
         WHERE casamento_id = $1
           AND ativo = TRUE
         ORDER BY
           CASE
             WHEN comprado = TRUE OR COALESCE(arrecadado,0) >= valor THEN 1
             ELSE 0
           END ASC,
           COALESCE(ordem, 2147483647) ASC,
           id ASC`,
        [casamentoId]
      ),

      pool.query(
        `SELECT
           pg.id,
           pg.valor,
           pg.status,
           pg.status_detail,
           pg.order_id,
           pg.aplicado_em,
           pg.criado_em,
           pg.nome AS pagador_nome,
           pg.email AS pagador_email,
           pg.metodo_pagamento,
           cp.nome AS presente_nome
         FROM casamento_pagamentos pg
         LEFT JOIN casamento_presentes cp
           ON cp.id = pg.presente_id
          AND cp.casamento_id = pg.casamento_id
         WHERE pg.casamento_id = $1
         ORDER BY pg.id DESC
         LIMIT 200`,
        [casamentoId]
      ),

      pool.query(
        `SELECT
          id,
          nomes,
          quantidade,
          mensagem
        FROM casamento_presencas
         WHERE casamento_id = $1
         ORDER BY id DESC
         LIMIT 500`,
        [casamentoId]
      ),

      pool.query(
        `SELECT
           id,
           nome,
           mensagem
         FROM casamento_recados
         WHERE casamento_id = $1
         ORDER BY id DESC
         LIMIT 500`,
        [casamentoId]
      ),

      pool.query(
        `SELECT
           id,
           imagem_url,
           legenda,
           ordem,
           criado_em
         FROM casamento_galeria
         WHERE casamento_id = $1
           AND ativo = TRUE
         ORDER BY COALESCE(ordem, 2147483647), id`,
        [casamentoId]
      ),

      pool.query(
        `SELECT
           titulo,
           url,
           atualizado_em
         FROM casamento_musica
         WHERE casamento_id = $1
         LIMIT 1`,
        [casamentoId]
      )
    ]);

    const casamento = casamentoResult.rows[0];

    if (!casamento) {
      return res.status(404).json({
        erro: "Casamento não encontrado."
      });
    }

    const presentes = presentesResult.rows;
    const pagamentos = pagamentosResult.rows;
    const presencas = presencasResult.rows;
    const recados = recadosResult.rows;
    const galeria = galeriaResult.rows;
    const musica = musicaResult.rows[0] || null;

    const valorTotalPresentes = presentes.reduce(
      (soma, p) => soma + Number(p.valor || 0),
      0
    );

    const arrecadado = pagamentos
      .filter(
        (p) =>
          p.status === "processed" &&
          p.status_detail === "accredited"
      )
      .reduce(
        (soma, p) => soma + Number(p.valor || 0),
        0
      );

    const totalConfirmados = presencas.reduce(
      (soma, p) => soma + Number(p.quantidade || 0),
      0
    );

    return res.json({
      casamento,
      resumo: {
        totalPresentes: presentes.length,
        valorTotalPresentes,
        arrecadado,
        totalConfirmados,
        totalRecados: recados.length
      },
      presentes,
      pagamentos,
      presencas,
      recados,
      galeria,
      musica
    });

  } catch (erro) {
    console.error("Erro painel do casal:", erro);

    return res.status(500).json({
      erro: "Não foi possível carregar o painel do casal."
    });
  }
});


// =====================================================
// PRESENÇAS - EXCLUSÃO PELO CASAL
// =====================================================

router.delete("/api/casal/presencas/:id", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);
    const presencaId = Number(req.params.id);

    if (!Number.isInteger(presencaId) || presencaId <= 0) {
      return res.status(400).json({ erro: "Confirmação inválida." });
    }

    const { rows } = await pool.query(
      `DELETE FROM casamento_presencas
       WHERE id = $1
         AND casamento_id = $2
       RETURNING id`,
      [presencaId, casamentoId]
    );

    if (!rows[0]) {
      return res.status(404).json({ erro: "Confirmação não encontrada." });
    }

    return res.json({ removido: true, id: rows[0].id });
  } catch (erro) {
    console.error("Erro remover presença casal:", erro);
    return res.status(500).json({ erro: "Não foi possível excluir a confirmação." });
  }
});

router.get("/api/casal/mercadopago/status", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);

    const { rows } = await pool.query(
      `SELECT
         mp_user_id,
         conectado_em,
         expires_at
       FROM casamento_mercadopago
       WHERE casamento_id = $1
       LIMIT 1`,
      [casamentoId]
    );

    const conexao = rows[0];

    return res.json({
      conectado: Boolean(conexao),
      conectadoEm: conexao?.conectado_em || null
    });

  } catch (erro) {
    console.error("Erro status MP casal:", erro);

    return res.status(500).json({
      erro: "Não foi possível consultar o Mercado Pago."
    });
  }
});

router.post("/api/casal/presentes", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);
    const nome = String(req.body.nome || "").trim();
    const descricao = String(req.body.descricao || "").trim();
    const valor = Number(req.body.valor);
    const imagem = req.body.imagem ? String(req.body.imagem).trim() : null;
    const link = req.body.link ? String(req.body.link).trim() : null;

    if (!nome || !Number.isFinite(valor) || valor <= 0) {
      return res.status(400).json({
        erro: "Informe nome e um valor válido para o presente."
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO casamento_presentes (
         casamento_id,
         nome,
         descricao,
         valor,
         arrecadado,
         imagem,
         link,
         comprado,
         ativo,
         ordem
       )
       VALUES (
         $1,$2,$3,$4,0,$5,$6,FALSE,TRUE,
         COALESCE(
           (
             SELECT MAX(ordem) + 1
             FROM casamento_presentes
             WHERE casamento_id = $1
               AND ativo = TRUE
           ),
           1
         )
       )
       RETURNING *`,
      [
        casamentoId,
        nome,
        descricao || null,
        valor,
        imagem,
        link
      ]
    );

    return res.status(201).json(rows[0]);

  } catch (erro) {
    console.error("Erro criar presente casal:", erro);

    return res.status(500).json({
      erro: "Não foi possível criar o presente."
    });
  }
});


router.put("/api/casal/presentes/ordem", async (req, res) => {
  const client = await pool.connect();

  try {
    const casamentoId = casamentoIdDoUsuario(req);
    const ids = Array.isArray(req.body.ids)
      ? req.body.ids.map(Number)
      : [];

    if (
      !casamentoId ||
      !ids.length ||
      ids.some((id) => !Number.isInteger(id) || id <= 0) ||
      new Set(ids).size !== ids.length
    ) {
      return res.status(400).json({
        erro: "Ordem dos presentes inválida."
      });
    }

    await client.query("BEGIN");

    const { rows: presentesAtivos } = await client.query(
      `SELECT id
       FROM casamento_presentes
       WHERE casamento_id = $1
         AND ativo = TRUE
         AND comprado = FALSE
         AND COALESCE(arrecadado,0) < valor
       ORDER BY COALESCE(ordem, 2147483647), id`,
      [casamentoId]
    );

    const idsAtivos = presentesAtivos.map((p) => Number(p.id));

    if (
      idsAtivos.length !== ids.length ||
      idsAtivos.some((id) => !ids.includes(id))
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        erro: "A lista de presentes mudou. Atualize a página e tente novamente."
      });
    }

    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `UPDATE casamento_presentes
         SET ordem = $1
         WHERE id = $2
           AND casamento_id = $3
           AND ativo = TRUE`,
        [i + 1, ids[i], casamentoId]
      );
    }

    await client.query("COMMIT");

    return res.json({
      atualizado: true,
      ids
    });
  } catch (erro) {
    await client.query("ROLLBACK");
    console.error("Erro ordenar presentes casal:", erro);

    return res.status(500).json({
      erro: "Não foi possível alterar a ordem dos presentes."
    });
  } finally {
    client.release();
  }
});

router.put("/api/casal/presentes/:id", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);
    const presenteId = Number(req.params.id);

    const nome = String(req.body.nome || "").trim();
    const descricao = String(req.body.descricao || "").trim();
    const valor = Number(req.body.valor);
    const imagem = req.body.imagem ? String(req.body.imagem).trim() : null;
    const link = req.body.link ? String(req.body.link).trim() : null;

    if (
      !Number.isInteger(presenteId) ||
      !nome ||
      !Number.isFinite(valor) ||
      valor <= 0
    ) {
      return res.status(400).json({
        erro: "Dados do presente inválidos."
      });
    }

    const { rows: atuais } = await pool.query(
      `SELECT arrecadado
       FROM casamento_presentes
       WHERE id = $1
         AND casamento_id = $2
         AND ativo = TRUE
       LIMIT 1`,
      [presenteId, casamentoId]
    );

    if (!atuais[0]) {
      return res.status(404).json({
        erro: "Presente não encontrado."
      });
    }

    if (valor < Number(atuais[0].arrecadado || 0)) {
      return res.status(400).json({
        erro: "O valor não pode ser menor que o total já arrecadado."
      });
    }

    const { rows } = await pool.query(
      `UPDATE casamento_presentes
       SET
         nome = $1,
         descricao = $2,
         valor = $3,
         imagem = $4,
         link = $5,
         comprado = CASE
           WHEN COALESCE(arrecadado,0) >= $3 THEN TRUE
           ELSE FALSE
         END
       WHERE id = $6
         AND casamento_id = $7
       RETURNING *`,
      [
        nome,
        descricao || null,
        valor,
        imagem,
        link,
        presenteId,
        casamentoId
      ]
    );

    return res.json(rows[0]);

  } catch (erro) {
    console.error("Erro editar presente casal:", erro);

    return res.status(500).json({
      erro: "Não foi possível editar o presente."
    });
  }
});

router.delete("/api/casal/presentes/:id", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);
    const presenteId = Number(req.params.id);

    if (!Number.isInteger(presenteId)) {
      return res.status(400).json({
        erro: "Presente inválido."
      });
    }

    const { rows } = await pool.query(
      `UPDATE casamento_presentes
       SET ativo = FALSE
       WHERE id = $1
         AND casamento_id = $2
       RETURNING id`,
      [presenteId, casamentoId]
    );

    if (!rows[0]) {
      return res.status(404).json({
        erro: "Presente não encontrado."
      });
    }

    return res.json({
      removido: true,
      id: rows[0].id
    });

  } catch (erro) {
    console.error("Erro remover presente casal:", erro);

    return res.status(500).json({
      erro: "Não foi possível remover o presente."
    });
  }
});


// =====================================================
// GALERIA
// =====================================================

router.post("/api/casal/galeria", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);
    const imagemUrl = String(req.body.imagemUrl || "").trim();
    const legenda = String(req.body.legenda || "").trim();

    if (!imagemUrl) {
      return res.status(400).json({ erro: "Informe a URL da foto." });
    }

    const { rows } = await pool.query(
      `INSERT INTO casamento_galeria (
         casamento_id,
         imagem_url,
         legenda,
         ordem,
         ativo
       )
       VALUES (
         $1,$2,$3,
         COALESCE((SELECT MAX(ordem) + 1 FROM casamento_galeria WHERE casamento_id = $1 AND ativo = TRUE),1),
         TRUE
       )
       RETURNING *`,
      [casamentoId, imagemUrl, legenda || null]
    );

    return res.status(201).json(rows[0]);
  } catch (erro) {
    console.error("Erro criar foto galeria:", erro);
    return res.status(500).json({ erro: "Não foi possível adicionar a foto." });
  }
});

router.put("/api/casal/galeria/ordem", async (req, res) => {
  const client = await pool.connect();

  try {
    const casamentoId = casamentoIdDoUsuario(req);
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : [];

    if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
      return res.status(400).json({ erro: "Ordem da galeria inválida." });
    }

    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id
       FROM casamento_galeria
       WHERE casamento_id = $1
         AND ativo = TRUE
       ORDER BY COALESCE(ordem, 2147483647), id`,
      [casamentoId]
    );

    const atuais = rows.map((r) => Number(r.id));
    if (atuais.length !== ids.length || atuais.some((id) => !ids.includes(id))) {
      await client.query("ROLLBACK");
      return res.status(409).json({ erro: "A galeria mudou. Atualize a página e tente novamente." });
    }

    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `UPDATE casamento_galeria
         SET ordem = $1
         WHERE id = $2
           AND casamento_id = $3`,
        [i + 1, ids[i], casamentoId]
      );
    }

    await client.query("COMMIT");
    return res.json({ atualizado: true });
  } catch (erro) {
    await client.query("ROLLBACK");
    console.error("Erro ordenar galeria:", erro);
    return res.status(500).json({ erro: "Não foi possível alterar a ordem da galeria." });
  } finally {
    client.release();
  }
});

router.delete("/api/casal/galeria/:id", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);
    const fotoId = Number(req.params.id);

    if (!Number.isInteger(fotoId) || fotoId <= 0) {
      return res.status(400).json({ erro: "Foto inválida." });
    }

    const { rows } = await pool.query(
      `UPDATE casamento_galeria
       SET ativo = FALSE
       WHERE id = $1
         AND casamento_id = $2
       RETURNING id`,
      [fotoId, casamentoId]
    );

    if (!rows[0]) {
      return res.status(404).json({ erro: "Foto não encontrada." });
    }

    return res.json({ removido: true, id: rows[0].id });
  } catch (erro) {
    console.error("Erro remover foto galeria:", erro);
    return res.status(500).json({ erro: "Não foi possível remover a foto." });
  }
});

// =====================================================
// MÚSICA
// =====================================================

router.put("/api/casal/musica", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);
    const titulo = String(req.body.titulo || "").trim();
    const url = String(req.body.url || "").trim();

    if (!url) {
      await pool.query(
        `DELETE FROM casamento_musica WHERE casamento_id = $1`,
        [casamentoId]
      );
      return res.json({ removido: true });
    }

    const { rows } = await pool.query(
      `INSERT INTO casamento_musica (casamento_id, titulo, url, atualizado_em)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (casamento_id)
       DO UPDATE SET
         titulo = EXCLUDED.titulo,
         url = EXCLUDED.url,
         atualizado_em = NOW()
       RETURNING titulo, url, atualizado_em`,
      [casamentoId, titulo || null, url]
    );

    return res.json(rows[0]);
  } catch (erro) {
    console.error("Erro salvar música casal:", erro);
    return res.status(500).json({ erro: "Não foi possível salvar a música." });
  }
});

module.exports = router;

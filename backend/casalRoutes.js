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
  return Number.isInteger(id) && id > 0 ? id : null;
}

function textoOuNull(valor, max = 2000) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  return texto.slice(0, max);
}

function dataValida(valor) {
  if (!valor) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor));
}

function horarioValido(valor) {
  if (!valor) return false;
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(valor));
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
           mapa_url,
           template,
           status,
           contribuicao_livre_ativa,
           contribuicao_livre_titulo,
           contribuicao_livre_descricao,
           contribuicao_livre_imagem
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
             WHEN comprado = TRUE
               OR COALESCE(arrecadado, 0) >= valor
             THEN 1
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
           pg.tipo_contribuicao,
           COALESCE(
             cp.nome,
             pg.produto_nome,
             CASE
               WHEN pg.tipo_contribuicao = 'livre'
               THEN 'Contribuição livre'
               ELSE 'Presente'
             END
           ) AS presente_nome
         FROM casamento_pagamentos pg
         LEFT JOIN casamento_presentes cp
           ON cp.id = pg.presente_id
          AND cp.casamento_id = pg.casamento_id
         WHERE pg.casamento_id = $1
         ORDER BY pg.id DESC
         LIMIT 300`,
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
           ordem
         FROM casamento_galeria
         WHERE casamento_id = $1
           AND ativo = TRUE
         ORDER BY COALESCE(ordem, 2147483647), id`,
        [casamentoId]
      ),

      pool.query(
        `SELECT titulo, url
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
      galeria: galeriaResult.rows,
      musica: musicaResult.rows[0] || null
    });
  } catch (erro) {
    console.error("Erro painel do casal:", erro);
    return res.status(500).json({
      erro: "Não foi possível carregar o painel do casal."
    });
  }
});

router.put("/api/casal/configuracoes", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);

    const dataCasamento = String(req.body.dataCasamento || "").trim();
    const horario = String(req.body.horario || "").trim();
    const localNome = textoOuNull(req.body.localNome, 180);
    const localEndereco = textoOuNull(req.body.localEndereco, 500);
    const mapaUrl = textoOuNull(req.body.mapaUrl, 2000);

    const contribuicaoLivreAtiva =
      req.body.contribuicaoLivreAtiva === true ||
      req.body.contribuicaoLivreAtiva === "true";

    const contribuicaoLivreTitulo =
      textoOuNull(req.body.contribuicaoLivreTitulo, 180) ||
      "Ajude-nos a realizar nossos sonhos";

    const contribuicaoLivreDescricao =
      textoOuNull(req.body.contribuicaoLivreDescricao, 1200) ||
      "Contribua com o valor que desejar.";

    const contribuicaoLivreImagem =
      textoOuNull(req.body.contribuicaoLivreImagem, 2000);

    if (!dataValida(dataCasamento)) {
      return res.status(400).json({
        erro: "Informe uma data válida."
      });
    }

    if (!horarioValido(horario)) {
      return res.status(400).json({
        erro: "Informe um horário válido."
      });
    }

    const { rows } = await pool.query(
      `UPDATE casamentos
       SET
         data_casamento = $1,
         horario = $2,
         local_nome = $3,
         local_endereco = $4,
         mapa_url = $5,
         contribuicao_livre_ativa = $6,
         contribuicao_livre_titulo = $7,
         contribuicao_livre_descricao = $8,
         contribuicao_livre_imagem = $9
       WHERE id = $10
       RETURNING
         id,
         slug,
         noivo,
         noiva,
         data_casamento,
         horario,
         local_nome,
         local_endereco,
         mapa_url,
         template,
         status,
         contribuicao_livre_ativa,
         contribuicao_livre_titulo,
         contribuicao_livre_descricao,
         contribuicao_livre_imagem`,
      [
        dataCasamento,
        horario,
        localNome,
        localEndereco,
        mapaUrl,
        contribuicaoLivreAtiva,
        contribuicaoLivreTitulo,
        contribuicaoLivreDescricao,
        contribuicaoLivreImagem,
        casamentoId
      ]
    );

    return res.json(rows[0]);
  } catch (erro) {
    console.error("Erro ao salvar configurações do casamento:", erro);
    return res.status(500).json({
      erro: "Não foi possível salvar as configurações."
    });
  }
});

router.get("/api/casal/mercadopago/status", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);

    const { rows } = await pool.query(
      `SELECT mp_user_id, conectado_em, expires_at
       FROM casamento_mercadopago
       WHERE casamento_id = $1
       LIMIT 1`,
      [casamentoId]
    );

    return res.json({
      conectado: Boolean(rows[0]),
      conectadoEm: rows[0]?.conectado_em || null
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
    const descricao = textoOuNull(req.body.descricao, 2000);
    const valor = Number(req.body.valor);
    const imagem = textoOuNull(req.body.imagem, 2000);
    const link = textoOuNull(req.body.link, 2000);

    if (!nome || !Number.isFinite(valor) || valor <= 0) {
      return res.status(400).json({
        erro: "Informe nome e um valor válido para o presente."
      });
    }

    const { rows: ordemRows } = await pool.query(
      `SELECT COALESCE(MAX(ordem), -1) + 1 AS proxima
       FROM casamento_presentes
       WHERE casamento_id = $1`,
      [casamentoId]
    );

    const ordem = Number(ordemRows[0]?.proxima || 0);

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
       VALUES ($1,$2,$3,$4,0,$5,$6,FALSE,TRUE,$7)
       RETURNING *`,
      [
        casamentoId,
        nome,
        descricao,
        valor,
        imagem,
        link,
        ordem
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
  const casamentoId = casamentoIdDoUsuario(req);
  const ids = Array.isArray(req.body.ids)
    ? req.body.ids.map(Number).filter(Number.isInteger)
    : [];

  if (!ids.length) {
    return res.status(400).json({
      erro: "Informe a nova ordem dos presentes."
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id
       FROM casamento_presentes
       WHERE casamento_id = $1
         AND ativo = TRUE
         AND id = ANY($2::int[])`,
      [casamentoId, ids]
    );

    if (rows.length !== ids.length) {
      throw new Error("Há presentes inválidos na ordem enviada.");
    }

    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `UPDATE casamento_presentes
         SET ordem = $1
         WHERE id = $2
           AND casamento_id = $3`,
        [i, ids[i], casamentoId]
      );
    }

    await client.query("COMMIT");
    return res.json({ salvo: true });
  } catch (erro) {
    await client.query("ROLLBACK");
    console.error("Erro ordenar presentes:", erro);
    return res.status(400).json({
      erro: erro.message || "Não foi possível salvar a ordem."
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
    const descricao = textoOuNull(req.body.descricao, 2000);
    const valor = Number(req.body.valor);
    const imagem = textoOuNull(req.body.imagem, 2000);
    const link = textoOuNull(req.body.link, 2000);

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
        descricao,
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

router.delete("/api/casal/presencas/:id", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);
    const id = Number(req.params.id);

    const { rows } = await pool.query(
      `DELETE FROM casamento_presencas
       WHERE id = $1
         AND casamento_id = $2
       RETURNING id`,
      [id, casamentoId]
    );

    if (!rows[0]) {
      return res.status(404).json({
        erro: "Confirmação de presença não encontrada."
      });
    }

    return res.json({ removido: true });
  } catch (erro) {
    console.error("Erro excluir presença:", erro);
    return res.status(500).json({
      erro: "Não foi possível excluir a confirmação."
    });
  }
});

router.post("/api/casal/galeria", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);
    const imagemUrl = textoOuNull(req.body.imagemUrl, 3000);
    const legenda = textoOuNull(req.body.legenda, 240);

    if (!imagemUrl) {
      return res.status(400).json({
        erro: "Informe a URL da foto."
      });
    }

    const { rows: ordemRows } = await pool.query(
      `SELECT COALESCE(MAX(ordem), -1) + 1 AS proxima
       FROM casamento_galeria
       WHERE casamento_id = $1
         AND ativo = TRUE`,
      [casamentoId]
    );

    const ordem = Number(ordemRows[0]?.proxima || 0);

    const { rows } = await pool.query(
      `INSERT INTO casamento_galeria (
         casamento_id,
         imagem_url,
         legenda,
         ordem,
         ativo
       )
       VALUES ($1,$2,$3,$4,TRUE)
       RETURNING id, imagem_url, legenda, ordem`,
      [casamentoId, imagemUrl, legenda, ordem]
    );

    return res.status(201).json(rows[0]);
  } catch (erro) {
    console.error("Erro adicionar foto:", erro);
    return res.status(500).json({
      erro: "Não foi possível adicionar a foto."
    });
  }
});

router.put("/api/casal/galeria/ordem", async (req, res) => {
  const casamentoId = casamentoIdDoUsuario(req);
  const ids = Array.isArray(req.body.ids)
    ? req.body.ids.map(Number).filter(Number.isInteger)
    : [];

  if (!ids.length) {
    return res.status(400).json({
      erro: "Informe a nova ordem das fotos."
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id
       FROM casamento_galeria
       WHERE casamento_id = $1
         AND ativo = TRUE
         AND id = ANY($2::int[])`,
      [casamentoId, ids]
    );

    if (rows.length !== ids.length) {
      throw new Error("Há fotos inválidas na ordem enviada.");
    }

    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `UPDATE casamento_galeria
         SET ordem = $1
         WHERE id = $2
           AND casamento_id = $3`,
        [i, ids[i], casamentoId]
      );
    }

    await client.query("COMMIT");
    return res.json({ salvo: true });
  } catch (erro) {
    await client.query("ROLLBACK");
    console.error("Erro ordenar galeria:", erro);
    return res.status(400).json({
      erro: erro.message || "Não foi possível salvar a ordem das fotos."
    });
  } finally {
    client.release();
  }
});

router.delete("/api/casal/galeria/:id", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);
    const id = Number(req.params.id);

    const { rows } = await pool.query(
      `UPDATE casamento_galeria
       SET ativo = FALSE
       WHERE id = $1
         AND casamento_id = $2
       RETURNING id`,
      [id, casamentoId]
    );

    if (!rows[0]) {
      return res.status(404).json({
        erro: "Foto não encontrada."
      });
    }

    return res.json({ removido: true });
  } catch (erro) {
    console.error("Erro remover foto:", erro);
    return res.status(500).json({
      erro: "Não foi possível remover a foto."
    });
  }
});

router.put("/api/casal/musica", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);
    const titulo = textoOuNull(req.body.titulo, 180);
    const url = textoOuNull(req.body.url, 3000);

    if (!url) {
      await pool.query(
        `DELETE FROM casamento_musica
         WHERE casamento_id = $1`,
        [casamentoId]
      );

      return res.json(null);
    }

    const { rows } = await pool.query(
      `INSERT INTO casamento_musica (
         casamento_id,
         titulo,
         url
       )
       VALUES ($1,$2,$3)
       ON CONFLICT (casamento_id)
       DO UPDATE SET
         titulo = EXCLUDED.titulo,
         url = EXCLUDED.url
       RETURNING titulo, url`,
      [casamentoId, titulo, url]
    );

    return res.json(rows[0]);
  } catch (erro) {
    console.error("Erro música casal:", erro);
    return res.status(500).json({
      erro: "Não foi possível salvar a música."
    });
  }
});

module.exports = router;

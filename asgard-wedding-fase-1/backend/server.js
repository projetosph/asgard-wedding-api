const express = require("express");
const cors = require("cors");
const { pool, buscarCasamentoPorSlug } = require("./db");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    ok: true,
    servico: "asgard-wedding-api",
    versao: "fase-1"
  });
});

// PERFIL DO CASAL
app.get("/api/casamentos/:slug", async (req, res) => {
  try {
    const casamento = await buscarCasamentoPorSlug(req.params.slug);

    if (!casamento || casamento.status === "inativo") {
      return res.status(404).json({ erro: "Casamento não encontrado." });
    }

    res.json(casamento);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao carregar o casamento." });
  }
});

// PRESENTES DO CASAL
app.get("/api/casamentos/:slug/presentes", async (req, res) => {
  try {
    const casamento = await buscarCasamentoPorSlug(req.params.slug);
    if (!casamento) {
      return res.status(404).json({ erro: "Casamento não encontrado." });
    }

    const { rows } = await pool.query(
      `SELECT
         id, nome, descricao, valor, arrecadado, imagem, link, comprado
       FROM casamento_presentes
       WHERE casamento_id = $1 AND ativo = TRUE
       ORDER BY id`,
      [casamento.id]
    );

    res.json(rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao carregar presentes." });
  }
});

// RSVP DO CASAL
app.post("/api/casamentos/:slug/presencas", async (req, res) => {
  try {
    const casamento = await buscarCasamentoPorSlug(req.params.slug);
    if (!casamento) {
      return res.status(404).json({ erro: "Casamento não encontrado." });
    }

    const { nome, nomes, quantidade, mensagem } = req.body;
    const listaNomes = Array.isArray(nomes) ? nomes : [];
    const qtd = Number(quantidade);

    if (!nome || !Number.isInteger(qtd) || qtd < 1) {
      return res.status(400).json({ erro: "Nome e quantidade são obrigatórios." });
    }

    if (listaNomes.length !== qtd) {
      return res.status(400).json({
        erro: "A quantidade de nomes deve ser igual à quantidade de pessoas."
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO casamento_presencas
         (casamento_id, nome_titular, nomes, quantidade, mensagem)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING id, nome_titular, nomes, quantidade, mensagem, criado_em`,
      [
        casamento.id,
        nome.trim(),
        JSON.stringify(listaNomes),
        qtd,
        mensagem?.trim() || null
      ]
    );

    res.status(201).json(rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao confirmar presença." });
  }
});

// RECADOS DO CASAL
app.get("/api/casamentos/:slug/recados", async (req, res) => {
  try {
    const casamento = await buscarCasamentoPorSlug(req.params.slug);
    if (!casamento) return res.status(404).json({ erro: "Casamento não encontrado." });

    const { rows } = await pool.query(
      `SELECT id, nome, mensagem, criado_em
       FROM casamento_recados
       WHERE casamento_id = $1
       ORDER BY criado_em DESC`,
      [casamento.id]
    );

    res.json(rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao carregar recados." });
  }
});

app.post("/api/casamentos/:slug/recados", async (req, res) => {
  try {
    const casamento = await buscarCasamentoPorSlug(req.params.slug);
    if (!casamento) return res.status(404).json({ erro: "Casamento não encontrado." });

    const nome = String(req.body.nome || "").trim();
    const mensagem = String(req.body.mensagem || "").trim();

    if (!nome || !mensagem) {
      return res.status(400).json({ erro: "Nome e mensagem são obrigatórios." });
    }

    const { rows } = await pool.query(
      `INSERT INTO casamento_recados (casamento_id, nome, mensagem)
       VALUES ($1, $2, $3)
       RETURNING id, nome, mensagem, criado_em`,
      [casamento.id, nome, mensagem]
    );

    res.status(201).json(rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao enviar recado." });
  }
});

app.listen(PORT, () => {
  console.log(`Asgard Wedding API rodando na porta ${PORT}`);
});
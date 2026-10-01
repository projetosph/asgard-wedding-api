const { Pool } = require("pg");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized:false } : false
});

async function buscarCasamentoPorSlug(slug) {
  const { rows } = await pool.query(
    `SELECT id, slug, noivo, noiva, data_casamento, horario,
            local_nome, local_endereco, mapa_url, template,
            cor_primaria, cor_secundaria, foto_capa, status
     FROM casamentos WHERE slug=$1 LIMIT 1`, [slug]
  );
  return rows[0] || null;
}

async function buscarPresenteDoCasamento(casamentoId, presenteId) {
  const { rows } = await pool.query(
    `SELECT id, casamento_id, nome, descricao, valor, arrecadado,
            imagem, link, comprado, ativo
     FROM casamento_presentes
     WHERE id=$1 AND casamento_id=$2 AND ativo=TRUE LIMIT 1`,
    [presenteId, casamentoId]
  );
  return rows[0] || null;
}

module.exports = { pool, buscarCasamentoPorSlug, buscarPresenteDoCasamento };

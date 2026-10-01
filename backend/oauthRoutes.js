const express = require("express");

const {
  pool,
  buscarCasamentoPorSlug
} = require("./db");

const {
  gerarPkce,
  gerarState,
  construirUrlAutorizacao,
  trocarCodigoPorToken,
  criptografar
} = require("./services/mercadoPagoOAuth");

const router = express.Router();

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

router.get(
  "/api/casamentos/:slug/mercadopago/conectar",
  async (req, res) => {
    try {
      const casamento = await buscarCasamentoPorSlug(req.params.slug);

      if (!casamento) {
        return res.status(404).json({
          erro: "Casamento não encontrado."
        });
      }

      await pool.query(
        `DELETE FROM mercadopago_oauth_tentativas
         WHERE expires_at <= NOW()`
      );

      const state = gerarState();
      const { codeVerifier, codeChallenge } = gerarPkce();

      await pool.query(
        `INSERT INTO mercadopago_oauth_tentativas (
           state,
           casamento_id,
           code_verifier,
           criado_em,
           expires_at
         )
         VALUES (
           $1,
           $2,
           $3,
           NOW(),
           NOW() + INTERVAL '10 minutes'
         )`,
        [state, casamento.id, codeVerifier]
      );

      const authorizationUrl =
        construirUrlAutorizacao({
          state,
          codeChallenge
        });

      return res.redirect(302, authorizationUrl);

    } catch (erro) {
      console.error(
        "Erro ao iniciar OAuth Mercado Pago:",
        erro
      );

      return res.status(500).json({
        erro:
          "Não foi possível iniciar a conexão com o Mercado Pago.",
        detalhe:
          erro.message || "Erro interno."
      });
    }
  }
);

router.get(
  "/api/mercadopago/oauth/callback",
  async (req, res) => {
    const code = String(req.query.code || "").trim();
    const state = String(req.query.state || "").trim();

    if (!code || !state) {
      return res.status(400).send(
        "OAuth inválido: code ou state ausente."
      );
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `SELECT
           t.state,
           t.casamento_id,
           t.code_verifier,
           t.expires_at,
           c.slug,
           c.noivo,
           c.noiva
         FROM mercadopago_oauth_tentativas t
         INNER JOIN casamentos c
           ON c.id = t.casamento_id
         WHERE t.state = $1
         FOR UPDATE`,
        [state]
      );

      const tentativa = rows[0];

      if (!tentativa) {
        await client.query("ROLLBACK");
        return res.status(400).send(
          "Tentativa OAuth não encontrada ou já utilizada."
        );
      }

      if (new Date(tentativa.expires_at).getTime() <= Date.now()) {
        await client.query(
          `DELETE FROM mercadopago_oauth_tentativas
           WHERE state = $1`,
          [state]
        );

        await client.query("COMMIT");

        return res.status(400).send(
          "Esta autorização expirou. Inicie a conexão novamente."
        );
      }

      const tokens = await trocarCodigoPorToken({
        code,
        codeVerifier: tentativa.code_verifier
      });

      const accessTokenCriptografado =
        criptografar(tokens.access_token);

      const refreshTokenCriptografado =
        criptografar(tokens.refresh_token);

      const expiresIn = Number(tokens.expires_in) || 0;

      const expiresAt =
        expiresIn > 0
          ? new Date(Date.now() + expiresIn * 1000)
          : null;

      await client.query(
        `INSERT INTO casamento_mercadopago (
           casamento_id,
           mp_user_id,
           access_token_encrypted,
           refresh_token_encrypted,
           public_key,
           scope,
           live_mode,
           expires_at,
           conectado_em,
           atualizado_em
         )
         VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()
         )
         ON CONFLICT (casamento_id)
         DO UPDATE SET
           mp_user_id = EXCLUDED.mp_user_id,
           access_token_encrypted =
             EXCLUDED.access_token_encrypted,
           refresh_token_encrypted =
             EXCLUDED.refresh_token_encrypted,
           public_key = EXCLUDED.public_key,
           scope = EXCLUDED.scope,
           live_mode = EXCLUDED.live_mode,
           expires_at = EXCLUDED.expires_at,
           conectado_em = NOW(),
           atualizado_em = NOW()`,
        [
          tentativa.casamento_id,
          String(tokens.user_id),
          accessTokenCriptografado,
          refreshTokenCriptografado,
          tokens.public_key || null,
          tokens.scope || null,
          Boolean(tokens.live_mode),
          expiresAt
        ]
      );

      await client.query(
        `DELETE FROM mercadopago_oauth_tentativas
         WHERE state = $1`,
        [state]
      );

      await client.query("COMMIT");

      const casal =
        `${tentativa.noivo} & ${tentativa.noiva}`;

      return res
        .status(200)
        .type("html")
        .send(`
          <!doctype html>
          <html lang="pt-BR">
          <head>
            <meta charset="utf-8">
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1">
            <title>Mercado Pago conectado</title>
          </head>
          <body style="
            font-family:Arial,sans-serif;
            max-width:620px;
            margin:70px auto;
            padding:24px;
            text-align:center;
          ">
            <h1>Mercado Pago conectado ✅</h1>

            <p>
              A conta foi vinculada com sucesso ao casamento
              <strong>${escaparHtml(casal)}</strong>.
            </p>

            <p>
              Você já pode fechar esta página.
            </p>
          </body>
          </html>
        `);

    } catch (erro) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error(
        "Erro no callback OAuth Mercado Pago:",
        erro
      );

      return res.status(500).json({
        erro:
          "Não foi possível concluir a conexão com o Mercado Pago.",
        detalhe:
          erro?.detalhes?.message ||
          erro?.detalhes?.error_description ||
          erro.message ||
          "Erro interno."
      });

    } finally {
      client.release();
    }
  }
);

router.get(
  "/api/casamentos/:slug/mercadopago/status",
  async (req, res) => {
    try {
      const casamento =
        await buscarCasamentoPorSlug(req.params.slug);

      if (!casamento) {
        return res.status(404).json({
          erro: "Casamento não encontrado."
        });
      }

      const { rows } = await pool.query(
        `SELECT
           mp_user_id,
           live_mode,
           expires_at,
           conectado_em,
           atualizado_em
         FROM casamento_mercadopago
         WHERE casamento_id = $1
         LIMIT 1`,
        [casamento.id]
      );

      const conexao = rows[0];

      if (!conexao) {
        return res.json({
          conectado: false,
          casamento: casamento.slug
        });
      }

      return res.json({
        conectado: true,
        casamento: casamento.slug,
        mpUserId: conexao.mp_user_id,
        liveMode: conexao.live_mode,
        expiresAt: conexao.expires_at,
        conectadoEm: conexao.conectado_em,
        atualizadoEm: conexao.atualizado_em
      });

    } catch (erro) {
      console.error(
        "Erro ao consultar conexão Mercado Pago:",
        erro
      );

      return res.status(500).json({
        erro:
          "Não foi possível consultar a conexão Mercado Pago."
      });
    }
  }
);

module.exports = router;

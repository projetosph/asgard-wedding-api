const express = require("express");
const dns = require("node:dns").promises;
const net = require("node:net");
const { pool } = require("./db");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});
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


function ipPrivado(ip) {
  const versao = net.isIP(ip);
  if (!versao) return true;

  if (versao === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }

  const normal = ip.toLowerCase();
  return (
    normal === "::1" ||
    normal === "::" ||
    normal.startsWith("fe80:") ||
    normal.startsWith("fc") ||
    normal.startsWith("fd") ||
    normal.startsWith("::ffff:127.") ||
    normal.startsWith("::ffff:10.") ||
    normal.startsWith("::ffff:192.168.")
  );
}

async function validarUrlPublica(valor) {
  let url;
  try {
    url = new URL(String(valor || "").trim());
  } catch {
    throw new Error("Link do produto inválido.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Use um link HTTP ou HTTPS.");
  }

  if (!url.hostname || url.username || url.password) {
    throw new Error("Link do produto inválido.");
  }

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("Este endereço não pode ser consultado.");
  }

  const enderecos = await dns.lookup(host, { all: true, verbatim: true });
  if (!enderecos.length || enderecos.some((item) => ipPrivado(item.address))) {
    throw new Error("Este endereço não pode ser consultado.");
  }

  return url;
}

function decodeHtml(texto) {
  return String(texto || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function atributosHtml(tag) {
  const attrs = {};
  String(tag || "").replace(
    /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
    (_, nome, a, b, d) => {
      attrs[String(nome).toLowerCase()] = decodeHtml(a ?? b ?? d ?? "");
      return "";
    }
  );
  return attrs;
}

function metaDoHtml(html, nomes) {
  const procurados = new Set(nomes.map((x) => x.toLowerCase()));
  const tags = String(html || "").match(/<meta\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const attrs = atributosHtml(tag);
    const chave = String(attrs.property || attrs.name || attrs.itemprop || "").toLowerCase();
    if (procurados.has(chave) && attrs.content) {
      return attrs.content.trim();
    }
  }
  return null;
}

function normalizarImagemProduto(valor) {
  if (!valor) return null;
  if (typeof valor === "string") return valor;
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const encontrada = normalizarImagemProduto(item);
      if (encontrada) return encontrada;
    }
    return null;
  }
  if (typeof valor === "object") {
    return valor.url || valor.contentUrl || valor.secure_url || null;
  }
  return null;
}

function procurarProdutoJsonLd(no) {
  if (!no) return null;
  if (Array.isArray(no)) {
    for (const item of no) {
      const achado = procurarProdutoJsonLd(item);
      if (achado) return achado;
    }
    return null;
  }
  if (typeof no !== "object") return null;

  const tipo = no["@type"];
  const tipos = Array.isArray(tipo) ? tipo : [tipo];
  if (tipos.some((x) => String(x || "").toLowerCase() === "product")) {
    return no;
  }

  if (no["@graph"]) {
    const achado = procurarProdutoJsonLd(no["@graph"]);
    if (achado) return achado;
  }

  for (const valor of Object.values(no)) {
    const achado = procurarProdutoJsonLd(valor);
    if (achado) return achado;
  }
  return null;
}

function produtoDoJsonLd(html) {
  const scripts = String(html || "").match(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
  ) || [];

  for (const bloco of scripts) {
    const conteudo = bloco
      .replace(/^<script\b[^>]*>/i, "")
      .replace(/<\/script>$/i, "")
      .trim();

    try {
      const json = JSON.parse(conteudo);
      const produto = procurarProdutoJsonLd(json);
      if (produto) return produto;
    } catch {
      // Alguns sites publicam JSON-LD inválido; nesse caso seguimos para meta tags.
    }
  }

  return null;
}

function precoDoProduto(produto, html) {
  const ofertas = produto?.offers;
  const lista = Array.isArray(ofertas) ? ofertas : (ofertas ? [ofertas] : []);

  for (const oferta of lista) {
    const bruto =
      oferta?.price ??
      oferta?.lowPrice ??
      oferta?.highPrice ??
      oferta?.priceSpecification?.price;

    const numero = Number(String(bruto ?? "").replace(",", "."));
    if (Number.isFinite(numero) && numero > 0) return numero;
  }

  const meta = metaDoHtml(html, [
    "product:price:amount",
    "og:price:amount",
    "price"
  ]);
  const numero = Number(String(meta ?? "").replace(/[^0-9,.-]/g, "").replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

async function baixarHtmlProduto(urlInicial) {
  let atual = await validarUrlPublica(urlInicial);

  for (let redirecionamentos = 0; redirecionamentos <= 4; redirecionamentos++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    let resposta;
    try {
      resposta = await fetch(atual, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NoivariaProductPreview/1.0)",
          "Accept": "text/html,application/xhtml+xml"
        }
      });
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(resposta.status)) {
      const local = resposta.headers.get("location");
      if (!local) throw new Error("O site retornou um redirecionamento inválido.");
      atual = await validarUrlPublica(new URL(local, atual).href);
      continue;
    }

    if (!resposta.ok) {
      throw new Error("A loja não permitiu consultar esse produto.");
    }

    const tipo = String(resposta.headers.get("content-type") || "").toLowerCase();
    if (!tipo.includes("text/html") && !tipo.includes("application/xhtml+xml")) {
      throw new Error("O link informado não parece ser uma página de produto.");
    }

    const limite = 2 * 1024 * 1024;
    const reader = resposta.body?.getReader();
    if (!reader) {
      const texto = await resposta.text();
      if (Buffer.byteLength(texto) > limite) {
        throw new Error("A página do produto é grande demais para leitura automática.");
      }
      return { html: texto, urlFinal: atual };
    }

    const partes = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limite) {
        await reader.cancel();
        throw new Error("A página do produto é grande demais para leitura automática.");
      }
      partes.push(Buffer.from(value));
    }

    return {
      html: Buffer.concat(partes).toString("utf8"),
      urlFinal: atual
    };
  }

  throw new Error("A loja redirecionou o link muitas vezes.");
}

function resolverUrl(valor, base) {
  if (!valor) return null;
  try {
    return new URL(valor, base).href;
  } catch {
    return null;
  }
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
           ordem,
           cloudinary_public_id
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

router.post("/api/casal/presentes/preview-link", async (req, res) => {
  try {
    const linkOriginal = textoOuNull(req.body.link, 3000);
    if (!linkOriginal) {
      return res.status(400).json({ erro: "Informe o link do produto." });
    }

    const { html, urlFinal } = await baixarHtmlProduto(linkOriginal);
    const produto = produtoDoJsonLd(html);

    const tituloHtml = (String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
    const nome =
      textoOuNull(produto?.name, 160) ||
      textoOuNull(metaDoHtml(html, ["og:title", "twitter:title"]), 160) ||
      textoOuNull(decodeHtml(tituloHtml), 160);

    const descricao =
      textoOuNull(produto?.description, 1000) ||
      textoOuNull(metaDoHtml(html, ["og:description", "twitter:description", "description"]), 1000);

    const imagemBruta =
      normalizarImagemProduto(produto?.image) ||
      metaDoHtml(html, ["og:image:secure_url", "og:image", "twitter:image"]);

    const imagem = resolverUrl(imagemBruta, urlFinal.href);
    const valor = precoDoProduto(produto, html);

    return res.json({
      nome: nome || null,
      descricao: descricao || null,
      valor,
      imagem: imagem || null,
      link: linkOriginal,
      dominio: new URL(linkOriginal).hostname.replace(/^www\./, ""),
      encontrado: Boolean(nome || descricao || valor || imagem)
    });
  } catch (erro) {
    console.error("Erro preview de produto:", erro);
    return res.status(422).json({
      erro: erro.message || "Não foi possível ler esse produto automaticamente."
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

function cloudinaryConfigurado() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

async function slugDoCasamento(casamentoId) {
  const { rows } = await pool.query(
    `SELECT slug
     FROM casamentos
     WHERE id = $1
     LIMIT 1`,
    [casamentoId]
  );

  return rows[0]?.slug || null;
}

function pastaCloudinary(slug) {
  return `noivaria/${String(slug || "").replace(/[^a-z0-9-]/gi, "-").toLowerCase()}/galeria`;
}

router.post("/api/casal/galeria/cloudinary-assinatura", async (req, res) => {
  try {
    if (!cloudinaryConfigurado()) {
      return res.status(503).json({
        erro: "O upload de fotos ainda não está configurado."
      });
    }

    const casamentoId = casamentoIdDoUsuario(req);
    const slug = await slugDoCasamento(casamentoId);

    if (!slug) {
      return res.status(404).json({
        erro: "Casamento não encontrado."
      });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = pastaCloudinary(slug);

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      process.env.CLOUDINARY_API_SECRET
    );

    return res.json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp,
      folder,
      signature
    });
  } catch (erro) {
    console.error("Erro assinatura Cloudinary:", erro);
    return res.status(500).json({
      erro: "Não foi possível preparar o envio das fotos."
    });
  }
});

router.post("/api/casal/galeria", async (req, res) => {
  try {
    const casamentoId = casamentoIdDoUsuario(req);
    const imagemUrl = textoOuNull(req.body.imagemUrl, 3000);
    const legenda = textoOuNull(req.body.legenda, 240);
    const cloudinaryPublicId = textoOuNull(req.body.cloudinaryPublicId, 500);

    if (!imagemUrl) {
      return res.status(400).json({
        erro: "Informe a foto."
      });
    }

    if (cloudinaryPublicId) {
      const slug = await slugDoCasamento(casamentoId);
      const prefixoEsperado = `${pastaCloudinary(slug)}/`;

      if (
        !imagemUrl.startsWith("https://res.cloudinary.com/") ||
        !cloudinaryPublicId.startsWith(prefixoEsperado)
      ) {
        return res.status(400).json({
          erro: "A foto enviada não pertence a este casamento."
        });
      }
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
         ativo,
         cloudinary_public_id
       )
       VALUES ($1,$2,$3,$4,TRUE,$5)
       RETURNING id, imagem_url, legenda, ordem, cloudinary_public_id`,
      [casamentoId, imagemUrl, legenda, ordem, cloudinaryPublicId]
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

    const { rows: fotos } = await pool.query(
      `SELECT id, cloudinary_public_id
       FROM casamento_galeria
       WHERE id = $1
         AND casamento_id = $2
         AND ativo = TRUE
       LIMIT 1`,
      [id, casamentoId]
    );

    const foto = fotos[0];

    if (!foto) {
      return res.status(404).json({
        erro: "Foto não encontrada."
      });
    }

    if (foto.cloudinary_public_id && cloudinaryConfigurado()) {
      const resultado = await cloudinary.uploader.destroy(
        foto.cloudinary_public_id,
        {
          resource_type: "image",
          invalidate: true
        }
      );

      if (!["ok", "not found"].includes(resultado?.result)) {
        throw new Error("O Cloudinary não confirmou a remoção da imagem.");
      }
    }

    await pool.query(
      `UPDATE casamento_galeria
       SET ativo = FALSE
       WHERE id = $1
         AND casamento_id = $2`,
      [id, casamentoId]
    );

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

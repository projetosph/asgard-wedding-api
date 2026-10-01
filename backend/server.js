const express = require("express");
const cors = require("cors");
const { pool, buscarCasamentoPorSlug, buscarPresenteDoCasamento } = require("./db");
const { criarPix, criarPagamentoCartao, consultarPagamento } = require("./services/mercadoPago");

const app = express();
app.use(cors());
app.use(express.json({ limit:"1mb" }));

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || "https://asgard-wedding-api.onrender.com";

app.get("/", (req,res) => res.json({ ok:true, servico:"asgard-wedding-api", versao:"fase-3" }));

app.get("/api/casamentos/:slug", async (req,res) => {
  try {
    const c = await buscarCasamentoPorSlug(req.params.slug);
    if (!c || c.status === "inativo") return res.status(404).json({ erro:"Casamento não encontrado." });
    res.json(c);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro:"Erro ao carregar o casamento." });
  }
});

app.get("/api/casamentos/:slug/presentes", async (req,res) => {
  try {
    const c = await buscarCasamentoPorSlug(req.params.slug);
    if (!c) return res.status(404).json({ erro:"Casamento não encontrado." });
    const { rows } = await pool.query(
      `SELECT id,nome,descricao,valor,arrecadado,imagem,link,comprado
       FROM casamento_presentes
       WHERE casamento_id=$1 AND ativo=TRUE ORDER BY id`, [c.id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro:"Erro ao carregar presentes." });
  }
});

app.post("/api/casamentos/:slug/presencas", async (req,res) => {
  try {
    const c = await buscarCasamentoPorSlug(req.params.slug);
    if (!c) return res.status(404).json({ erro:"Casamento não encontrado." });
    const nomes = Array.isArray(req.body.nomes) ? req.body.nomes : [];
    const qtd = Number(req.body.quantidade);
    const nome = String(req.body.nome || "").trim();
    if (!nome || !Number.isInteger(qtd) || qtd < 1) return res.status(400).json({ erro:"Nome e quantidade são obrigatórios." });
    if (nomes.length !== qtd) return res.status(400).json({ erro:"A quantidade de nomes deve ser igual à quantidade de pessoas." });

    const { rows } = await pool.query(
      `INSERT INTO casamento_presencas (casamento_id,nome_titular,nomes,quantidade,mensagem)
       VALUES ($1,$2,$3::jsonb,$4,$5)
       RETURNING id,nome_titular,nomes,quantidade,mensagem,criado_em`,
      [c.id,nome,JSON.stringify(nomes),qtd,String(req.body.mensagem || "").trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro:"Erro ao confirmar presença." });
  }
});

app.get("/api/casamentos/:slug/recados", async (req,res) => {
  try {
    const c = await buscarCasamentoPorSlug(req.params.slug);
    if (!c) return res.status(404).json({ erro:"Casamento não encontrado." });
    const { rows } = await pool.query(
      `SELECT id,nome,mensagem,criado_em FROM casamento_recados
       WHERE casamento_id=$1 ORDER BY criado_em DESC`, [c.id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro:"Erro ao carregar recados." });
  }
});

app.post("/api/casamentos/:slug/recados", async (req,res) => {
  try {
    const c = await buscarCasamentoPorSlug(req.params.slug);
    if (!c) return res.status(404).json({ erro:"Casamento não encontrado." });
    const nome = String(req.body.nome || "").trim();
    const mensagem = String(req.body.mensagem || "").trim();
    if (!nome || !mensagem) return res.status(400).json({ erro:"Nome e mensagem são obrigatórios." });
    const { rows } = await pool.query(
      `INSERT INTO casamento_recados (casamento_id,nome,mensagem)
       VALUES ($1,$2,$3) RETURNING id,nome,mensagem,criado_em`,
      [c.id,nome,mensagem]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro:"Erro ao enviar recado." });
  }
});

app.get("/api/config/mercadopago", (req,res) => {
  const publicKey = process.env.MERCADO_PAGO_PUBLIC_KEY;
  if (!publicKey) return res.status(500).json({ erro:"MERCADO_PAGO_PUBLIC_KEY não configurada." });
  res.json({ publicKey });
});

async function prepararCompra(slug, body) {
  const casamento = await buscarCasamentoPorSlug(slug);
  if (!casamento) {
    const e = new Error("Casamento não encontrado.");
    e.status = 404; throw e;
  }

  const presenteId = Number(body.produtoId);
  if (!Number.isInteger(presenteId) || presenteId <= 0) {
    const e = new Error("Presente inválido.");
    e.status = 400; throw e;
  }

  const presente = await buscarPresenteDoCasamento(casamento.id, presenteId);
  if (!presente) {
    const e = new Error("Este presente não pertence a este casamento.");
    e.status = 400; throw e;
  }

  const valor = Number(body.valor);
  const total = Number(presente.valor) || 0;
  const arrecadado = Number(presente.arrecadado) || 0;
  const restante = Math.max(total - arrecadado, 0);

  if (!Number.isFinite(valor) || valor <= 0) {
    const e = new Error("Valor inválido.");
    e.status = 400; throw e;
  }
  if (restante <= 0) {
    const e = new Error("Este presente já foi completado.");
    e.status = 409; throw e;
  }
  if (valor > restante) {
    const e = new Error(`O valor máximo disponível é ${restante.toFixed(2)}.`);
    e.status = 409; throw e;
  }

  const nome = String(body.nome || "").trim();
  const email = String(body.email || "").trim();
  if (!nome || !email) {
    const e = new Error("Nome e e-mail são obrigatórios.");
    e.status = 400; throw e;
  }

  return {
    casamento, presente, valor, nome, email,
    tipoContribuicao:String(body.tipoContribuicao || "")
  };
}

async function registrarPagamento({casamento,presente,pagamento,nome,email,valor,tipoContribuicao,metodoPagamento}) {
  await pool.query(
    `INSERT INTO casamento_pagamentos (
       casamento_id,presente_id,pagamento_id,nome,email,valor,status,status_detail,
       metodo_pagamento,external_reference,produto_nome,produto_imagem,tipo_contribuicao,
       parcelas,payment_method_id,atualizado_em
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
     ON CONFLICT (pagamento_id) DO UPDATE SET
       status=EXCLUDED.status,status_detail=EXCLUDED.status_detail,atualizado_em=NOW()`,
    [
      casamento.id,presente.id,String(pagamento.id),nome,email,
      Number(pagamento.transaction_amount) || valor,
      pagamento.status || null,pagamento.status_detail || null,metodoPagamento,
      pagamento.external_reference || null,presente.nome,presente.imagem || null,
      tipoContribuicao || null,pagamento.installments || null,
      pagamento.payment_method_id || null
    ]
  );
}

async function aplicarPagamentoAprovado(pagamentoId, mp=null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT * FROM casamento_pagamentos WHERE pagamento_id=$1 FOR UPDATE`,
      [String(pagamentoId)]
    );
    const reg = rows[0];
    if (!reg) { await client.query("ROLLBACK"); return null; }
    if (reg.aplicado_em) { await client.query("COMMIT"); return reg; }

    const status = mp?.status || reg.status;
    if (status !== "approved") { await client.query("COMMIT"); return reg; }

    const { rows: gifts } = await client.query(
      `SELECT id,valor,arrecadado FROM casamento_presentes
       WHERE id=$1 AND casamento_id=$2 FOR UPDATE`,
      [reg.presente_id,reg.casamento_id]
    );
    const p = gifts[0];
    if (!p) throw new Error("Presente vinculado ao pagamento não encontrado.");

    const total = Number(p.valor) || 0;
    const atual = Number(p.arrecadado) || 0;
    const pago = Number(mp?.transaction_amount ?? reg.valor) || 0;
    const novo = Math.min(atual + pago,total);

    await client.query(
      `UPDATE casamento_presentes
       SET arrecadado=$1, comprado=($1 >= valor) WHERE id=$2`,
      [novo,p.id]
    );
    await client.query(
      `UPDATE casamento_pagamentos
       SET status='approved',status_detail=$1,valor=$2,
           aplicado_em=NOW(),atualizado_em=NOW()
       WHERE pagamento_id=$3`,
      [mp?.status_detail || reg.status_detail || null,pago,String(pagamentoId)]
    );
    await client.query("COMMIT");
    return { ...reg, status:"approved", valor:pago, aplicado:true };
  } catch (e) {
    await client.query("ROLLBACK"); throw e;
  } finally {
    client.release();
  }
}

app.post("/api/casamentos/:slug/pagamentos/pix", async (req,res) => {
  try {
    const compra = await prepararCompra(req.params.slug,req.body);
    const referencia = `${compra.casamento.slug}:${compra.presente.id}:${Date.now()}`;
    const pagamento = await criarPix({
      nome:compra.nome,email:compra.email,valor:compra.valor,
      casamentoSlug:compra.casamento.slug,casamentoId:compra.casamento.id,
      produtoId:compra.presente.id,produtoNome:compra.presente.nome,
      tipoContribuicao:compra.tipoContribuicao,externalReference:referencia,
      notificationUrl:`${PUBLIC_URL}/api/mercadopago/webhook`
    });
    await registrarPagamento({ ...compra,pagamento,metodoPagamento:"pix" });
    const d = pagamento.point_of_interaction?.transaction_data || {};
    res.status(201).json({
      pagamentoId:String(pagamento.id),status:pagamento.status,
      statusDetail:pagamento.status_detail,
      valor:Number(pagamento.transaction_amount) || compra.valor,
      qrCode:d.qr_code || "",qrCodeBase64:d.qr_code_base64 || "",
      ticketUrl:d.ticket_url || ""
    });
  } catch (e) {
    console.error("Erro ao criar PIX:",e);
    res.status(e.status || 500).json({
      erro:e.message || "Não foi possível gerar o PIX.",
      detalhe:e?.detalhes?.message || e.message
    });
  }
});

app.post("/api/casamentos/:slug/pagamentos/cartao", async (req,res) => {
  try {
    const compra = await prepararCompra(req.params.slug,req.body);
    const parcelas = Number(req.body.installments);
    if (!req.body.token || !req.body.payment_method_id || !Number.isInteger(parcelas) || parcelas <= 0) {
      return res.status(400).json({ erro:"Dados do cartão incompletos." });
    }

    const referencia = `${compra.casamento.slug}:${compra.presente.id}:${Date.now()}`;
    const pagamento = await criarPagamentoCartao({
      nome:compra.nome,email:compra.email,valor:compra.valor,
      casamentoSlug:compra.casamento.slug,casamentoId:compra.casamento.id,
      produtoId:compra.presente.id,produtoNome:compra.presente.nome,
      tipoContribuicao:compra.tipoContribuicao,externalReference:referencia,
      notificationUrl:`${PUBLIC_URL}/api/mercadopago/webhook`,
      token:req.body.token,installments:parcelas,
      paymentMethodId:req.body.payment_method_id,
      issuerId:req.body.issuer_id,payer:req.body.payer
    });

    await registrarPagamento({ ...compra,pagamento,metodoPagamento:"cartao" });
    if (pagamento.status === "approved") await aplicarPagamentoAprovado(pagamento.id,pagamento);

    res.status(201).json({
      pagamentoId:String(pagamento.id),status:pagamento.status,
      statusDetail:pagamento.status_detail,
      valor:Number(pagamento.transaction_amount) || compra.valor
    });
  } catch (e) {
    console.error("Erro ao criar pagamento com cartão:",e);
    res.status(e.status || 500).json({
      erro:e.message || "Não foi possível processar o cartão.",
      detalhe:e?.detalhes?.message || e.message,
      causa:e?.detalhes?.cause || []
    });
  }
});

app.get("/api/casamentos/:slug/pagamentos/:id/status", async (req,res) => {
  try {
    const casamento = await buscarCasamentoPorSlug(req.params.slug);
    if (!casamento) return res.status(404).json({ erro:"Casamento não encontrado." });

    const { rows } = await pool.query(
      `SELECT casamento_id FROM casamento_pagamentos
       WHERE pagamento_id=$1 LIMIT 1`, [String(req.params.id)]
    );
    if (!rows[0] || Number(rows[0].casamento_id) !== Number(casamento.id)) {
      return res.status(404).json({ erro:"Pagamento não encontrado para este casamento." });
    }

    const pagamento = await consultarPagamento(req.params.id);
    await pool.query(
      `UPDATE casamento_pagamentos SET status=$1,status_detail=$2,valor=$3,atualizado_em=NOW()
       WHERE pagamento_id=$4`,
      [pagamento.status || null,pagamento.status_detail || null,
       Number(pagamento.transaction_amount) || 0,String(pagamento.id)]
    );

    if (pagamento.status === "approved") await aplicarPagamentoAprovado(pagamento.id,pagamento);

    res.json({
      pagamentoId:String(pagamento.id),status:pagamento.status,
      statusDetail:pagamento.status_detail,
      valor:Number(pagamento.transaction_amount) || 0,
      aprovado:pagamento.status === "approved"
    });
  } catch (e) {
    console.error("Erro ao consultar pagamento:",e);
    res.status(500).json({ erro:"Não foi possível consultar o pagamento." });
  }
});

app.post("/api/mercadopago/webhook", async (req,res) => {
  res.sendStatus(200);
  const pagamentoId = req.body?.data?.id || req.query?.["data.id"] || req.query?.id;
  if (!pagamentoId) return;

  try {
    const pagamento = await consultarPagamento(pagamentoId);
    const { rowCount } = await pool.query(
      `UPDATE casamento_pagamentos
       SET status=$1,status_detail=$2,valor=$3,atualizado_em=NOW()
       WHERE pagamento_id=$4`,
      [pagamento.status || null,pagamento.status_detail || null,
       Number(pagamento.transaction_amount) || 0,String(pagamento.id)]
    );
    if (!rowCount) return;
    if (pagamento.status === "approved") await aplicarPagamentoAprovado(pagamento.id,pagamento);
    console.log(`Webhook Mercado Pago: ${pagamento.id} = ${pagamento.status}`);
  } catch (e) {
    console.error("Erro no webhook Mercado Pago:",e);
  }
});

app.listen(PORT, () => console.log(`Asgard Wedding API Fase 3 rodando na porta ${PORT}`));

const API_CHECKOUT = "https://asgard-wedding-api.onrender.com";

let produtoCheckout = null;
let metodoSelecionado = "";
let intervaloStatus = null;
let cardPaymentBrickController = null;
let mercadoPago = null;
let bricksBuilder = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("nomeProdutoCheckout")) return;

  produtoCheckout = carregarProdutoCheckout();

  if (!produtoCheckout) {
    alert("Nenhum presente foi selecionado.");
    voltarParaLista();
    return;
  }

  preencherResumoCheckout();
  configurarModoContribuicaoLivre();
});

function slugCheckout() {
  return new URLSearchParams(window.location.search).get("casamento") || "";
}

function voltarParaLista() {
  const slug = slugCheckout();
  const atual = window.location.pathname;

  if (atual.includes("/templates/template-04/")) {
    window.location.href =
      `template-04-presentes.html${slug ? `?casamento=${encodeURIComponent(slug)}` : ""}`;
    return;
  }

  if (atual.includes("/templates/template-03/")) {
    window.location.href =
      `template-03-presentes.html${slug ? `?casamento=${encodeURIComponent(slug)}` : ""}`;
    return;
  }

  if (atual.includes("/templates/template-02/")) {
    window.location.href =
      `template-02-presentes.html${slug ? `?casamento=${encodeURIComponent(slug)}` : ""}`;
    return;
  }

  window.location.href =
    `presentes.html${slug ? `?casamento=${encodeURIComponent(slug)}` : ""}`;
}

function carregarProdutoCheckout() {
  try {
    return JSON.parse(localStorage.getItem("produtoCheckout"));
  } catch (erro) {
    console.error("Erro ao carregar checkout:", erro);
    return null;
  }
}

function contribuicaoLivre() {
  return (
    produtoCheckout?.tipo === "contribuicao_livre" ||
    produtoCheckout?.tipoContribuicao === "livre" ||
    String(produtoCheckout?.id || "") === "contribuicao-livre"
  );
}

function preencherResumoCheckout() {
  const livre = contribuicaoLivre();
  const valor = Number(produtoCheckout.valor) || 0;
  const arrecadado = Number(produtoCheckout.arrecadado) || 0;
  const restante = Math.max(valor - arrecadado, 0);

  const foto = document.getElementById("fotoProduto");
  const nome = document.getElementById("nomeProdutoCheckout");
  const valorOriginal = document.getElementById("valorOriginal");
  const valorRestante = document.getElementById("valorRestante");
  const valorCompleto = document.getElementById("valorCompletoTexto");

  if (foto) {
    const imagem = produtoCheckout.imagem || "";
    if (imagem) {
      foto.src =
        typeof converterUrlImagem === "function"
          ? converterUrlImagem(imagem)
          : imagem;
      foto.alt = produtoCheckout.nome || "Presente";
    } else {
      foto.style.display = "none";
    }
  }

  if (nome) {
    nome.textContent =
      produtoCheckout.nome ||
      (livre ? "Contribuição livre" : "Presente");
  }

  if (livre) {
    if (valorOriginal) valorOriginal.style.display = "none";
    if (valorRestante) valorRestante.textContent = "Escolha o valor";
    if (valorCompleto) valorCompleto.textContent = "—";
    return;
  }

  if (valorOriginal) {
    if (arrecadado > 0) {
      valorOriginal.style.display = "block";
      valorOriginal.textContent = formatarMoeda(valor);
    } else {
      valorOriginal.style.display = "none";
    }
  }

  if (valorRestante) {
    valorRestante.textContent = formatarMoeda(restante);
  }

  if (valorCompleto) {
    valorCompleto.textContent = formatarMoeda(restante);
  }
}

function configurarModoContribuicaoLivre() {
  if (!contribuicaoLivre()) return;

  const parcial = document.getElementById("parcial");
  const total = document.getElementById("total");

  if (total?.closest(".checkoutCard")) {
    total.closest(".checkoutCard").style.display = "none";
  } else if (total) {
    total.style.display = "none";
  }

  const parcialCard = parcial?.closest(".checkoutCard");
  const titulo = parcialCard?.querySelector(".checkoutTitulo strong");
  const subtitulo = parcialCard?.querySelector(".checkoutTitulo small");

  if (titulo) titulo.textContent = "ESCOLHA O VALOR";
  if (subtitulo) {
    subtitulo.textContent =
      "Digite livremente quanto deseja contribuir.";
  }

  const campo = document.getElementById("valorContribuicao");
  if (campo) {
    campo.placeholder = "Ex.: 150,00";
    campo.removeAttribute("max");
  }

  abrirOpcao("parcial");
}

function abrirOpcao(id) {
  document.querySelectorAll(".checkoutConteudo").forEach((conteudo) => {
    conteudo.classList.toggle("ativo", conteudo.id === id);
  });

  metodoSelecionado = "";

  document.querySelectorAll(".opcao").forEach((opcao) => {
    opcao.classList.remove("ativa", "selecionado");
  });

  desmontarBrickCartao();
  limparAreaPagamento();
}

function selecionar(elemento, metodo) {
  const conteudoAtual = elemento.closest(".checkoutConteudo");

  if (!conteudoAtual) return;

  document.querySelectorAll(".opcao").forEach((opcao) => {
    opcao.classList.remove("ativa", "selecionado");
  });

  elemento.classList.add("ativa", "selecionado");
  metodoSelecionado = metodo;
  localStorage.setItem("metodoPagamento", metodo);
}

function montarCompra(tipo) {
  const nome =
    document.getElementById("nome")?.value.trim();

  const email =
    document.getElementById("email")?.value.trim();

  if (!nome) {
    alert("Digite seu nome.");
    return null;
  }

  if (!email) {
    alert("Digite seu e-mail.");
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert("Digite um e-mail válido.");
    return null;
  }

  const livre = contribuicaoLivre();

  let valorPagamento = 0;
  let tipoContribuicao = tipo;

  if (livre) {
    valorPagamento =
      Number(document.getElementById("valorContribuicao")?.value);

    if (
      !Number.isFinite(valorPagamento) ||
      valorPagamento <= 0
    ) {
      alert("Informe o valor que deseja contribuir.");
      return null;
    }

    tipoContribuicao = "livre";
  } else {
    const valorTotal =
      Number(produtoCheckout.valor) || 0;

    const arrecadado =
      Number(produtoCheckout.arrecadado) || 0;

    const restante =
      Math.max(valorTotal - arrecadado, 0);

    if (tipo === "parcial") {
      valorPagamento =
        Number(document.getElementById("valorContribuicao")?.value);

      if (
        !Number.isFinite(valorPagamento) ||
        valorPagamento <= 0
      ) {
        alert("Informe um valor válido.");
        return null;
      }

      if (valorPagamento > restante) {
        alert(
          `O valor máximo para este presente é ${formatarMoeda(restante)}.`
        );
        return null;
      }
    } else if (tipo === "total") {
      valorPagamento = restante;
    } else {
      return null;
    }
  }

  return {
    produtoId:
      livre
        ? "contribuicao-livre"
        : produtoCheckout.id,

    produtoIndex: produtoCheckout.index,
    produtoNome:
      produtoCheckout.nome ||
      (livre ? "Contribuição livre" : "Presente"),

    produtoImagem:
      produtoCheckout.imagem || null,

    tipoContribuicao,
    valor: valorPagamento,
    nome,
    email
  };
}


function rolarParaAreaPagamento(atraso = 80) {
  const area = document.getElementById("areaPagamento");
  if (!area) return;

  window.setTimeout(() => {
    area.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, atraso);
}

async function continuarPagamento(tipo) {
  if (!produtoCheckout) return;

  if (!metodoSelecionado) {
    alert("Escolha PIX ou Cartão de Crédito.");
    return;
  }

  const compra = montarCompra(
    contribuicaoLivre() ? "livre" : tipo
  );

  if (!compra) return;

  localStorage.setItem(
    "compraAtual",
    JSON.stringify(compra)
  );

  if (metodoSelecionado === "pix") {
    desmontarBrickCartao();
    await gerarPix(compra);
    return;
  }

  await abrirFormularioCartao(compra);
}

async function gerarPix(compra) {
  const area = document.getElementById("areaPagamento");

  area.innerHTML =
    `<div class="resumoPagamentoPendente"><p>Gerando PIX...</p></div>`;

  try {
    const resposta = await fetch(
      `${API_CHECKOUT}/api/casamentos/${encodeURIComponent(slugCheckout())}/pagamentos/pix`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(compra)
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.detalhe ||
        dados.erro ||
        "Não foi possível gerar o PIX."
      );
    }

    const qrCodeImagem =
      dados.qrCodeBase64
        ? `data:image/png;base64,${dados.qrCodeBase64}`
        : "";

    area.innerHTML = `
      <div class="pixMercadoPago">
        <h3>Pagamento via PIX</h3>
        <p>Valor: <strong>${formatarMoeda(dados.valor)}</strong></p>

        ${
          qrCodeImagem
            ? `<img src="${qrCodeImagem}" alt="QR Code PIX">`
            : ""
        }

        <textarea id="codigoPixCopiaCola" readonly>${escaparHtml(dados.qrCode || "")}</textarea>

        <button
          type="button"
          class="btnPix"
          onclick="copiarCodigoPix()">
          COPIAR CÓDIGO PIX
        </button>

        <p id="statusPagamentoPix">
          Aguardando confirmação do pagamento...
        </p>
      </div>
    `;

    rolarParaAreaPagamento(100);

    iniciarConsultaStatus(
      dados.orderId || dados.pagamentoId,
      compra
    );
  } catch (erro) {
    console.error(erro);

    area.innerHTML =
      `<div class="resumoPagamentoPendente"><p>${escaparHtml(erro.message)}</p></div>`;
  }
}

async function copiarCodigoPix() {
  const codigo =
    document.getElementById("codigoPixCopiaCola")?.value || "";

  if (!codigo) {
    alert("Código PIX indisponível.");
    return;
  }

  if (navigator.clipboard) {
    await navigator.clipboard.writeText(codigo);
  } else {
    const textarea =
      document.getElementById("codigoPixCopiaCola");
    textarea.select();
    document.execCommand("copy");
  }
}

async function obterMercadoPago() {
  if (mercadoPago && bricksBuilder) {
    return { mercadoPago, bricksBuilder };
  }

  const resposta = await fetch(
    `${API_CHECKOUT}/api/config/mercadopago`
  );

  const dados = await resposta.json();

  if (!resposta.ok || !dados.publicKey) {
    throw new Error(
      dados.erro ||
      "Public Key do Mercado Pago indisponível."
    );
  }

  if (typeof MercadoPago === "undefined") {
    throw new Error(
      "SDK do Mercado Pago não carregou."
    );
  }

  mercadoPago =
    new MercadoPago(
      dados.publicKey,
      { locale: "pt-BR" }
    );

  bricksBuilder =
    mercadoPago.bricks();

  return {
    mercadoPago,
    bricksBuilder
  };
}

async function abrirFormularioCartao(compra) {
  const area =
    document.getElementById("areaPagamento");

  desmontarBrickCartao();

  area.innerHTML = `
    <div class="cartaoMercadoPago">
      <h3>Pagamento com Cartão</h3>

      <p class="valorCartaoCheckout">
        Valor:
        <strong>${formatarMoeda(compra.valor)}</strong>
      </p>

      <div id="cardPaymentBrick_container"></div>
      <p id="statusPagamentoCartao"></p>
    </div>
  `;

  rolarParaAreaPagamento(90);

  try {
    const { bricksBuilder } =
      await obterMercadoPago();

    const settings = {
      initialization: {
        amount: Number(compra.valor),
        payer: {
          email: compra.email
        }
      },

      customization: {
        paymentMethods: {
          minInstallments: 1,
          maxInstallments: 3
        }
      },

      style: {
        theme: "default"
      },

      callbacks: {
        onReady: () => {
          rolarParaAreaPagamento(60);
        },

        onSubmit: (formData) =>
          processarCartao(
            formData,
            compra
          ),

        onError: (erro) => {
          console.error(
            "Erro Card Payment Brick:",
            erro
          );

          const status =
            document.getElementById(
              "statusPagamentoCartao"
            );

          if (status) {
            status.textContent =
              "Não foi possível carregar os dados do cartão.";
          }
        }
      }
    };

    cardPaymentBrickController =
      await bricksBuilder.create(
        "cardPayment",
        "cardPaymentBrick_container",
        settings
      );
  } catch (erro) {
    console.error(erro);

    area.innerHTML =
      `<div class="resumoPagamentoPendente"><p>${escaparHtml(erro.message)}</p></div>`;
  }
}

async function processarCartao(
  formData,
  compra
) {
  const status =
    document.getElementById(
      "statusPagamentoCartao"
    );

  if (status) {
    status.textContent =
      "Processando pagamento...";
  }

  try {
    const payload = {
      ...compra,
      token: formData.token,
      installments:
        Number(formData.installments) || 1,
      payment_method_id:
        formData.payment_method_id,
      payment_type_id:
        formData.payment_type_id,
      issuer_id:
        formData.issuer_id,
      payer:
        formData.payer
    };

    const resposta = await fetch(
      `${API_CHECKOUT}/api/casamentos/${encodeURIComponent(slugCheckout())}/pagamentos/cartao`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.detalhe ||
        dados.erro ||
        "Não foi possível processar o cartão."
      );
    }

    if (
      dados.status === "processed" &&
      dados.statusDetail === "accredited"
    ) {
      mostrarPagamentoAprovado(compra);
      return;
    }

    if (status) {
      status.textContent =
        `Status: ${dados.statusDetail || dados.status || "em análise"}`;
    }

    iniciarConsultaStatus(
      dados.orderId || dados.pagamentoId,
      compra
    );
  } catch (erro) {
    console.error(erro);

    if (status) {
      status.textContent =
        erro.message;
    }

    throw erro;
  }
}

function desmontarBrickCartao() {
  if (
    cardPaymentBrickController &&
    typeof cardPaymentBrickController.unmount === "function"
  ) {
    try {
      cardPaymentBrickController.unmount();
    } catch {}
  }

  cardPaymentBrickController = null;
}

function limparAreaPagamento() {
  const area =
    document.getElementById("areaPagamento");

  if (area) {
    area.innerHTML = "";
  }
}

function iniciarConsultaStatus(
  pagamentoId,
  compra
) {
  if (!pagamentoId) return;

  if (intervaloStatus) {
    clearInterval(intervaloStatus);
  }

  consultarStatusPagamento(
    pagamentoId,
    compra
  );

  intervaloStatus =
    setInterval(
      () =>
        consultarStatusPagamento(
          pagamentoId,
          compra
        ),
      5000
    );
}

async function consultarStatusPagamento(
  pagamentoId,
  compra
) {
  try {
    const resposta = await fetch(
      `${API_CHECKOUT}/api/casamentos/${encodeURIComponent(slugCheckout())}/pagamentos/${encodeURIComponent(pagamentoId)}/status`
    );

    const dados =
      await resposta.json();

    if (!resposta.ok) return;

    if (
      dados.status === "processed" &&
      dados.statusDetail === "accredited"
    ) {
      if (intervaloStatus) {
        clearInterval(intervaloStatus);
        intervaloStatus = null;
      }

      mostrarPagamentoAprovado(compra);
      return;
    }

    const statusPix =
      document.getElementById(
        "statusPagamentoPix"
      );

    const statusCartao =
      document.getElementById(
        "statusPagamentoCartao"
      );

    if (statusPix) {
      statusPix.textContent =
        "Aguardando confirmação do pagamento...";
    }

    if (statusCartao) {
      statusCartao.textContent =
        `Status: ${dados.statusDetail || dados.status || "em análise"}`;
    }
  } catch (erro) {
    console.error(
      "Erro ao consultar pagamento:",
      erro
    );
  }
}

function mostrarPagamentoAprovado(compra) {
  const area =
    document.getElementById("areaPagamento");

  if (!area) return;

  area.innerHTML = `
    <div class="resumoPagamentoPendente">
      <h3>Pagamento confirmado ♡</h3>
      <p>
        Obrigado por presentear os noivos com
        <strong>${formatarMoeda(compra.valor)}</strong>.
      </p>
    </div>
  `;

  rolarParaAreaPagamento(60);
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  );
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

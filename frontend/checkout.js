let produtoCheckout = null;
let metodoSelecionado = "";
let intervaloStatus = null;
let cardPaymentBrickController = null;
let mercadoPago = null;
let bricksBuilder = null;

document.addEventListener("DOMContentLoaded", () => {
  produtoCheckout = carregarProdutoCheckout();

  if (!produtoCheckout) {
    alert("Nenhum presente foi selecionado.");
    voltarParaPresentes();
    return;
  }

  preencherResumoCheckout();
});

function carregarProdutoCheckout() {
  try {
    const produto =
      JSON.parse(
        localStorage.getItem(
          "produtoCheckout"
        )
      );

    if (!produto) return null;

    if (
      produto.casamentoSlug &&
      produto.casamentoSlug !==
        CASAMENTO_SLUG
    ) {
      return null;
    }

    return produto;

  } catch (erro) {
    console.error(
      "Erro ao carregar checkout:",
      erro
    );

    return null;
  }
}

function voltarParaPresentes() {
  window.location.href =
    `presentes.html?casamento=${encodeURIComponent(CASAMENTO_SLUG)}`;
}

function voltarParaInicio() {
  window.location.href =
    `index.html?casamento=${encodeURIComponent(CASAMENTO_SLUG)}`;
}

function preencherResumoCheckout() {
  const valor =
    Number(produtoCheckout.valor) || 0;

  const arrecadado =
    Number(produtoCheckout.arrecadado) || 0;

  const restante =
    Math.max(
      valor - arrecadado,
      0
    );

  const foto =
    document.getElementById(
      "fotoProduto"
    );

  const nome =
    document.getElementById(
      "nomeProdutoCheckout"
    );

  const valorOriginal =
    document.getElementById(
      "valorOriginal"
    );

  const valorRestante =
    document.getElementById(
      "valorRestante"
    );

  const valorCompleto =
    document.getElementById(
      "valorCompletoTexto"
    );

  if (foto) {
    foto.src =
      converterUrlImagem(
        produtoCheckout.imagem || ""
      );

    foto.alt =
      produtoCheckout.nome ||
      "Presente";
  }

  if (nome) {
    nome.textContent =
      produtoCheckout.nome ||
      "Presente";
  }

  if (valorOriginal) {
    if (arrecadado > 0) {
      valorOriginal.style.display =
        "block";

      valorOriginal.textContent =
        formatarMoeda(valor);
    } else {
      valorOriginal.style.display =
        "none";
    }
  }

  if (valorRestante) {
    valorRestante.textContent =
      formatarMoeda(restante);
  }

  if (valorCompleto) {
    valorCompleto.textContent =
      formatarMoeda(restante);
  }
}

function abrirOpcao(id) {
  document
    .querySelectorAll(
      ".checkoutConteudo"
    )
    .forEach((conteudo) => {
      conteudo.classList.toggle(
        "ativo",
        conteudo.id === id
      );
    });

  metodoSelecionado = "";

  document
    .querySelectorAll(".opcao")
    .forEach((opcao) =>
      opcao.classList.remove(
        "ativa"
      )
    );

  desmontarBrickCartao();
  limparAreaPagamento();
}

function selecionar(
  elemento,
  metodo
) {
  const conteudo =
    elemento.closest(
      ".checkoutConteudo"
    );

  if (!conteudo) return;

  conteudo
    .querySelectorAll(".opcao")
    .forEach((opcao) =>
      opcao.classList.remove(
        "ativa"
      )
    );

  elemento.classList.add("ativa");
  metodoSelecionado = metodo;
}

function montarCompra(tipo) {
  const nome =
    document
      .getElementById("nome")
      ?.value.trim();

  const email =
    document
      .getElementById("email")
      ?.value.trim();

  if (!nome) {
    alert("Digite seu nome.");
    return null;
  }

  if (!email) {
    alert("Digite seu e-mail.");
    return null;
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email)
  ) {
    alert(
      "Digite um e-mail válido."
    );

    return null;
  }

  const valorTotal =
    Number(
      produtoCheckout.valor
    ) || 0;

  const arrecadado =
    Number(
      produtoCheckout.arrecadado
    ) || 0;

  const restante =
    Math.max(
      valorTotal - arrecadado,
      0
    );

  let valorPagamento = 0;

  if (tipo === "parcial") {
    valorPagamento =
      Number(
        document
          .getElementById(
            "valorContribuicao"
          )
          ?.value
      );

    if (
      !Number.isFinite(
        valorPagamento
      ) ||
      valorPagamento <= 0
    ) {
      alert(
        "Informe um valor válido."
      );

      return null;
    }

    if (
      valorPagamento >
      restante
    ) {
      alert(
        `O valor máximo é ${formatarMoeda(restante)}.`
      );

      return null;
    }

  } else if (
    tipo === "total"
  ) {
    valorPagamento =
      restante;

  } else {
    return null;
  }

  return {
    produtoId:
      produtoCheckout.id,

    produtoNome:
      produtoCheckout.nome,

    produtoImagem:
      produtoCheckout.imagem,

    tipoContribuicao:
      tipo,

    valor:
      valorPagamento,

    nome,
    email
  };
}

async function continuarPagamento(
  tipo
) {
  if (!produtoCheckout) return;

  if (!metodoSelecionado) {
    alert(
      "Escolha PIX ou Cartão de Crédito."
    );

    return;
  }

  const compra =
    montarCompra(tipo);

  if (!compra) return;

  if (
    metodoSelecionado === "pix"
  ) {
    desmontarBrickCartao();

    await gerarPix(compra);

    return;
  }

  await abrirFormularioCartao(
    compra
  );
}

async function gerarPix(compra) {
  const area =
    document.getElementById(
      "areaPagamento"
    );

  if (!area) return;

  area.innerHTML = `
    <div class="resumoPagamentoPendente">
      <p>Gerando PIX...</p>
    </div>
  `;

  try {
    const resposta =
      await fetch(
        `${ASGARD_API}/api/casamentos/${encodeURIComponent(CASAMENTO_SLUG)}/pagamentos/pix`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify(compra)
        }
      );

    const dados =
      await resposta.json();

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

        <p>
          Valor:
          <strong>
            ${formatarMoeda(
              dados.valor
            )}
          </strong>
        </p>

        ${
          qrCodeImagem
            ? `
              <img
                src="${qrCodeImagem}"
                alt="QR Code PIX">
            `
            : `
              <p>
                Use o código PIX abaixo.
              </p>
            `
        }

        <textarea
          id="codigoPixCopiaCola"
          readonly>${dados.qrCode || ""}</textarea>

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

    iniciarConsultaStatus(
      dados.orderId ||
      dados.pagamentoId
    );

  } catch (erro) {
    console.error(erro);

    area.innerHTML = `
      <div class="resumoPagamentoPendente">
        <p>
          ${escaparHtml(
            erro.message
          )}
        </p>
      </div>
    `;
  }
}

async function copiarCodigoPix() {
  const codigo =
    document
      .getElementById(
        "codigoPixCopiaCola"
      )
      ?.value || "";

  if (!codigo) {
    alert(
      "Código PIX indisponível."
    );

    return;
  }

  await navigator.clipboard
    .writeText(codigo);

  alert(
    "Código PIX copiado!"
  );
}

async function obterMercadoPago() {
  if (
    mercadoPago &&
    bricksBuilder
  ) {
    return {
      mercadoPago,
      bricksBuilder
    };
  }

  const resposta =
    await fetch(
      `${ASGARD_API}/api/config/mercadopago`
    );

  const dados =
    await resposta.json();

  if (
    !resposta.ok ||
    !dados.publicKey
  ) {
    throw new Error(
      dados.erro ||
      "Public Key do Mercado Pago indisponível."
    );
  }

  if (
    typeof MercadoPago ===
    "undefined"
  ) {
    throw new Error(
      "SDK do Mercado Pago não carregou."
    );
  }

  mercadoPago =
    new MercadoPago(
      dados.publicKey,
      {
        locale: "pt-BR"
      }
    );

  bricksBuilder =
    mercadoPago.bricks();

  return {
    mercadoPago,
    bricksBuilder
  };
}

async function abrirFormularioCartao(
  compra
) {
  const area =
    document.getElementById(
      "areaPagamento"
    );

  if (!area) return;

  desmontarBrickCartao();

  area.innerHTML = `
    <div class="cartaoMercadoPago">

      <h3>
        Pagamento com Cartão
      </h3>

      <p class="valorCartaoCheckout">
        Valor:
        <strong>
          ${formatarMoeda(
            compra.valor
          )}
        </strong>
      </p>

      <div
        id="cardPaymentBrick_container">
      </div>

      <p
        id="statusPagamentoCartao">
      </p>

    </div>
  `;

  try {
    const {
      bricksBuilder
    } =
      await obterMercadoPago();

    const settings = {
      initialization: {
        amount:
          Number(
            compra.valor
          )
      },

      style: {
        theme: "default"
      },

      callbacks: {
        onReady: () => {
          console.log(
            "Formulário de cartão pronto"
          );
        },

        onSubmit: (
          formData,
          additionalData
        ) => {
          return processarCartao(
            formData,
            additionalData,
            compra
          );
        },

        onError: (erro) => {
          console.error(
            "Erro no Card Payment Brick:",
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

    area.innerHTML = `
      <div class="resumoPagamentoPendente">
        <p>
          ${escaparHtml(
            erro.message
          )}
        </p>
      </div>
    `;
  }
}

async function processarCartao(
  formData,
  additionalData,
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

      token:
        formData.token,

      installments:
        formData.installments,

      payment_method_id:
        formData.payment_method_id,

      payment_type_id:
        additionalData?.paymentTypeId ||
        "credit_card",

      payer:
        formData.payer
    };

    const resposta =
      await fetch(
        `${ASGARD_API}/api/casamentos/${encodeURIComponent(CASAMENTO_SLUG)}/pagamentos/cartao`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              payload
            )
        }
      );

    const dados =
      await resposta.json();

    if (!resposta.ok) {
      const erros =
        Array.isArray(
          dados.erros
        )
          ? dados.erros
              .map(
                (e) =>
                  e.message ||
                  e.code
              )
              .filter(Boolean)
              .join(" | ")
          : "";

      throw new Error(
        erros ||
        dados.detalhe ||
        dados.erro ||
        "Não foi possível processar o cartão."
      );
    }

    if (
      dados.status ===
        "processed" &&
      dados.statusDetail ===
        "accredited"
    ) {
      mostrarPopupPagamentoAprovado();
      return;
    }

    if (
      [
        "processing",
        "created",
        "action_required"
      ].includes(
        dados.status
      )
    ) {
      if (status) {
        status.textContent =
          "Pagamento em processamento. Aguardando confirmação...";
      }

      iniciarConsultaStatus(
        dados.orderId ||
        dados.pagamentoId
      );

      return;
    }

    if (
      [
        "failed",
        "canceled",
        "expired"
      ].includes(
        dados.status
      )
    ) {
      if (status) {
        status.textContent =
          traduzirStatusOrder(
            dados.statusDetail
          );
      }

      return;
    }

    if (status) {
      status.textContent =
        `Status do pagamento: ${dados.status}`;
    }

  } catch (erro) {
    console.error(
      "Erro ao processar cartão:",
      erro
    );

    if (status) {
      status.textContent =
        erro.message;
    }

    throw erro;
  }
}

function iniciarConsultaStatus(
  orderId
) {
  if (intervaloStatus) {
    clearInterval(
      intervaloStatus
    );
  }

  consultarStatusPagamento(
    orderId
  );

  intervaloStatus =
    setInterval(
      () =>
        consultarStatusPagamento(
          orderId
        ),
      5000
    );
}

async function consultarStatusPagamento(
  orderId
) {
  try {
    const resposta =
      await fetch(
        `${ASGARD_API}/api/casamentos/${encodeURIComponent(CASAMENTO_SLUG)}/pagamentos/${encodeURIComponent(orderId)}/status`,
        {
          cache: "no-store"
        }
      );

    const dados =
      await resposta.json();

    if (!resposta.ok) {
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

    if (
      dados.status ===
        "processed" &&
      dados.statusDetail ===
        "accredited"
    ) {
      if (
        intervaloStatus
      ) {
        clearInterval(
          intervaloStatus
        );

        intervaloStatus =
          null;
      }

      mostrarPopupPagamentoAprovado();
      return;
    }

    if (
      [
        "failed",
        "canceled",
        "expired"
      ].includes(
        dados.status
      )
    ) {
      if (
        intervaloStatus
      ) {
        clearInterval(
          intervaloStatus
        );

        intervaloStatus =
          null;
      }

      const mensagem =
        traduzirStatusOrder(
          dados.statusDetail
        );

      if (statusPix) {
        statusPix.textContent =
          mensagem;
      }

      if (statusCartao) {
        statusCartao.textContent =
          mensagem;
      }

      return;
    }

    if (statusPix) {
      statusPix.textContent =
        dados.statusDetail ===
          "waiting_transfer"
          ? "Aguardando o pagamento do PIX..."
          : "Aguardando confirmação do pagamento...";
    }

    if (statusCartao) {
      statusCartao.textContent =
        "Pagamento em processamento. Aguardando confirmação...";
    }

  } catch (erro) {
    console.error(
      "Erro ao consultar Order:",
      erro
    );
  }
}

function traduzirStatusOrder(
  statusDetail
) {
  const mensagens = {
    bad_filled_card_data:
      "Confira os dados do cartão.",

    invalid_card_token:
      "Os dados do cartão expiraram. Preencha novamente.",

    high_risk:
      "O pagamento não foi autorizado.",

    rejected_by_issuer:
      "O banco emissor recusou o pagamento.",

    required_call_for_authorize:
      "O banco solicitou autorização. Entre em contato com o emissor.",

    max_attempts_exceeded:
      "O número máximo de tentativas foi atingido.",

    expired:
      "O pagamento expirou. Inicie uma nova tentativa.",

    canceled:
      "O pagamento foi cancelado.",

    failed:
      "O pagamento não foi aprovado."
  };

  return (
    mensagens[
      statusDetail
    ] ||
    "Pagamento não aprovado. Confira os dados ou tente novamente."
  );
}

function desmontarBrickCartao() {
  if (
    cardPaymentBrickController &&
    typeof cardPaymentBrickController.unmount ===
      "function"
  ) {
    try {
      cardPaymentBrickController
        .unmount();
    } catch {}
  }

  cardPaymentBrickController =
    null;
}

function limparAreaPagamento() {
  const area =
    document.getElementById(
      "areaPagamento"
    );

  if (area) {
    area.innerHTML = "";
  }
}

function mostrarPopupPagamentoAprovado() {
  const popup =
    document.getElementById(
      "popupPagamentoAprovado"
    );

  if (popup) {
    popup.style.setProperty(
      "display",
      "flex",
      "important"
    );
  } else {
    alert(
      "Pagamento aprovado! Obrigado pelo presente."
    );
  }

  localStorage.removeItem(
    "produtoCheckout"
  );

  setTimeout(() => {
    voltarParaInicio();
  }, 3000);
}

function converterUrlImagem(url) {
  if (!url) return "";

  const drive =
    url.match(
      /drive\.google\.com\/file\/d\/([^/]+)/
    );

  if (drive?.[1]) {
    return (
      "https://drive.google.com/thumbnail" +
      `?id=${drive[1]}&sz=w1200`
    );
  }

  return url;
}

function escaparHtml(valor) {
  return String(
    valor ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

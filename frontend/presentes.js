const PRESENTES_API =
  "https://asgard-wedding-api.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  carregarPresentes();
});

function slugPresentes01() {
  return (
    new URLSearchParams(window.location.search)
      .get("casamento") || ""
  );
}

async function carregarPresentes() {
  const container =
    document.getElementById("listaPresentes");

  if (!container) return;

  try {
    const resposta = await fetch(
      `${PRESENTES_API}/api/casamentos/${encodeURIComponent(slugPresentes01())}/presentes`,
      { cache: "no-store" }
    );

    const produtos =
      await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        produtos.erro ||
        "Não foi possível carregar os presentes."
      );
    }

    window.__presentesPublicos =
      Array.isArray(produtos)
        ? produtos
        : [];

    if (!window.__presentesPublicos.length) {
      container.innerHTML =
        `<p class="listaPresentesVazia">Nenhum presente foi cadastrado ainda.</p>`;
      return;
    }

    container.innerHTML =
      window.__presentesPublicos
        .map(
          (produto, index) =>
            criarCardPresente(
              produto,
              index
            )
        )
        .join("");
  } catch (erro) {
    console.error(erro);

    container.innerHTML =
      `<p class="listaPresentesVazia">Não foi possível carregar a lista agora.</p>`;
  }
}

function criarCardPresente(
  produto,
  index
) {
  const livre =
    produto.tipo ===
    "contribuicao_livre";

  const valor =
    Number(produto.valor) || 0;

  const arrecadado =
    Number(produto.arrecadado) || 0;

  const restante =
    Math.max(
      valor - arrecadado,
      0
    );

  const quitado =
    !livre &&
    (
      Boolean(produto.comprado) ||
      (
        valor > 0 &&
        restante <= 0
      )
    );

  const imagem =
    typeof converterUrlImagem === "function"
      ? converterUrlImagem(
          produto.imagem || ""
        )
      : (produto.imagem || "");

  const imagemHtml =
    imagem
      ? `<img src="${escaparHtml(imagem)}" alt="${escaparHtml(produto.nome || "Presente")}">`
      : `<div class="cardPresenteSemImagem">Sem imagem</div>`;

  const valorHtml =
    livre
      ? `<p class="valorAtual">VOCÊ ESCOLHE O VALOR</p>`
      : (
          arrecadado > 0
            ? `
              <p class="valorAntigo">${formatarMoeda(valor)}</p>
              ${
                quitado
                  ? `<p class="presenteado">PRESENTEADO</p>`
                  : `<p class="valorAtual">${formatarMoeda(restante)}</p>`
              }
            `
            : `<p class="valorAtual">${formatarMoeda(valor)}</p>`
        );

  return `
    <article class="cardPresente ${livre ? "contribuicaoLivreCard" : ""}">
      ${imagemHtml}

      <h3>${escaparHtml(produto.nome || "Presente")}</h3>

      ${
        produto.descricao
          ? `<p class="descricaoPresente">${escaparHtml(produto.descricao)}</p>`
          : ""
      }

      ${valorHtml}

      ${
        !livre && produto.link
          ? `<a href="${escaparHtml(produto.link)}" target="_blank" rel="noopener noreferrer" class="btnVerProduto">Ver produto</a>`
          : ""
      }

      <button
        type="button"
        onclick="abrirCheckout(${index})"
        ${quitado ? "disabled" : ""}>
        ${
          livre
            ? "CONTRIBUIR"
            : (
                quitado
                  ? "PRESENTEADO"
                  : "PRESENTEAR"
              )
        }
      </button>
    </article>
  `;
}

function abrirCheckout(index) {
  const produtos =
    window.__presentesPublicos || [];

  const produto =
    produtos[index];

  if (!produto) {
    alert(
      "Não foi possível localizar esse presente."
    );
    return;
  }

  const livre =
    produto.tipo ===
    "contribuicao_livre";

  if (!livre) {
    const valor =
      Number(produto.valor) || 0;

    const arrecadado =
      Number(produto.arrecadado) || 0;

    if (
      Math.max(
        valor - arrecadado,
        0
      ) <= 0
    ) {
      alert(
        "Esse presente já foi completado."
      );
      return;
    }
  }

  localStorage.setItem(
    "produtoCheckout",
    JSON.stringify({
      ...produto,
      index
    })
  );

  localStorage.removeItem(
    "valorPagamento"
  );

  localStorage.removeItem(
    "tipoContribuicao"
  );

  localStorage.removeItem(
    "metodoPagamento"
  );

  window.location.href =
    `pagamento.html${
      slugPresentes01()
        ? `?casamento=${encodeURIComponent(slugPresentes01())}`
        : ""
    }`;
}

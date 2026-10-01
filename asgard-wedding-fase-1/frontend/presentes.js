let produtosPresentes = [];

document.addEventListener("asgard:casamento-carregado", () => {
  carregarPresentes();
});

async function carregarPresentes() {
  const container = document.getElementById("listaPresentes");
  if (!container) return;

  container.innerHTML = `<p class="listaPresentesVazia">Carregando presentes...</p>`;

  try {
    const resposta = await fetch(
      `${ASGARD_API}/api/casamentos/${encodeURIComponent(CASAMENTO_SLUG)}/presentes`
    );
    const dados = await resposta.json();

    if (!resposta.ok) throw new Error(dados.erro || "Não foi possível carregar presentes.");

    produtosPresentes = Array.isArray(dados) ? dados : [];

    if (!produtosPresentes.length) {
      container.innerHTML =
        `<p class="listaPresentesVazia">Nenhum presente cadastrado ainda.</p>`;
      return;
    }

    container.innerHTML = produtosPresentes.map((produto, index) => {
      const valor = Number(produto.valor) || 0;
      const arrecadado = Number(produto.arrecadado) || 0;
      const restante = Math.max(valor - arrecadado, 0);
      const quitado = Boolean(produto.comprado) || (valor > 0 && restante <= 0);

      return `
        <article class="cardPresente">
          ${produto.imagem ? `<img src="${produto.imagem}" alt="">` : ""}
          <h3>${escaparHtml(produto.nome)}</h3>
          ${produto.descricao ? `<p class="descricaoPresente">${escaparHtml(produto.descricao)}</p>` : ""}
          <p class="valorAtual">${formatarMoeda(restante || valor)}</p>
          ${produto.link ? `<a href="${produto.link}" target="_blank" rel="noopener noreferrer" class="btnVerProduto">Ver produto</a>` : ""}
          <button type="button" onclick="abrirCheckout(${index})" ${quitado ? "disabled" : ""}>
            ${quitado ? "PRESENTEADO" : "PRESENTEAR"}
          </button>
        </article>
      `;
    }).join("");
  } catch (erro) {
    console.error(erro);
    container.innerHTML =
      `<p class="listaPresentesVazia">Não foi possível carregar a lista agora.</p>`;
  }
}

function abrirCheckout(index) {
  const produto = produtosPresentes[index];
  if (!produto) return;

  localStorage.setItem("produtoCheckout", JSON.stringify({
    ...produto,
    casamentoSlug: CASAMENTO_SLUG
  }));

  window.location.href =
    `pagamento.html?casamento=${encodeURIComponent(CASAMENTO_SLUG)}`;
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
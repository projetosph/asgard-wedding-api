let produtosPresentes = [];

document.addEventListener("asgard:casamento-carregado", carregarPresentes);

async function carregarPresentes() {
  const container = document.getElementById("listaPresentes");
  if (!container) return;

  container.innerHTML = `<p class="listaPresentesVazia">Carregando presentes...</p>`;

  try {
    const resposta = await fetch(
      `${ASGARD_API}/api/casamentos/${encodeURIComponent(CASAMENTO_SLUG)}/presentes`
    );
    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Não foi possível carregar os presentes.");
    }

    produtosPresentes = Array.isArray(dados) ? dados : [];

    if (!produtosPresentes.length) {
      container.innerHTML = `<p class="listaPresentesVazia">Nenhum presente foi cadastrado ainda.</p>`;
      return;
    }

    container.innerHTML = produtosPresentes
      .map((produto, index) => criarCardPresente(produto, index))
      .join("");
  } catch (erro) {
    console.error("Erro ao carregar presentes:", erro);
    container.innerHTML = `<p class="listaPresentesVazia">Não foi possível carregar a lista de presentes agora.</p>`;
  }
}

function criarCardPresente(produto, index) {
  const valor = Number(produto.valor) || 0;
  const arrecadado = Number(produto.arrecadado) || 0;
  const restante = Math.max(valor - arrecadado, 0);
  const quitado = Boolean(produto.comprado) || (valor > 0 && restante <= 0);
  const imagem = converterUrlImagem(produto.imagem || "");

  const imagemHtml = imagem
    ? `<img src="${imagem}" alt="${escaparHtml(produto.nome || "Presente")}" onerror="this.style.display='none'">`
    : `<div class="cardPresenteSemImagem">Sem imagem</div>`;

  let valorHtml = "";
  if (arrecadado > 0) {
    valorHtml = `
      <p class="valorAntigo">${formatarMoeda(valor)}</p>
      ${quitado
        ? `<p class="presenteado">PRESENTEADO</p>`
        : `<p class="valorAtual">${formatarMoeda(restante)}</p>`}
    `;
  } else {
    valorHtml = `<p class="valorAtual">${formatarMoeda(valor)}</p>`;
  }

  const linkLoja = produto.link
    ? `<a href="${produto.link}" target="_blank" rel="noopener noreferrer" class="btnVerProduto">Ver produto</a>`
    : "";

  return `
    <article class="cardPresente">
      ${imagemHtml}
      <h3>${escaparHtml(produto.nome || "Presente")}</h3>
      ${produto.descricao ? `<p class="descricaoPresente">${escaparHtml(produto.descricao)}</p>` : ""}
      ${valorHtml}
      ${linkLoja}
      <button type="button" onclick="abrirCheckout(${index})" ${quitado ? "disabled" : ""}>
        ${quitado ? "PRESENTEADO" : "PRESENTEAR"}
      </button>
    </article>
  `;
}

function abrirCheckout(index) {
  const produto = produtosPresentes[index];
  if (!produto) {
    alert("Não foi possível localizar esse presente.");
    return;
  }

  const valor = Number(produto.valor) || 0;
  const arrecadado = Number(produto.arrecadado) || 0;
  const restante = Math.max(valor - arrecadado, 0);

  if (restante <= 0) {
    alert("Esse presente já foi completado.");
    return;
  }

  localStorage.setItem(
    "produtoCheckout",
    JSON.stringify({
      ...produto,
      valor,
      arrecadado,
      restante,
      casamentoSlug: CASAMENTO_SLUG
    })
  );

  window.location.href = `pagamento.html?casamento=${encodeURIComponent(CASAMENTO_SLUG)}`;
}

function converterUrlImagem(url) {
  if (!url) return "";

  const drive = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (drive?.[1]) {
    return `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w1200`;
  }

  const driveOpen = url.match(/[?&]id=([^&]+)/);
  if (url.includes("drive.google.com") && driveOpen?.[1]) {
    return `https://drive.google.com/thumbnail?id=${driveOpen[1]}&sz=w1200`;
  }

  return url;
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
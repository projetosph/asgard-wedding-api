document.addEventListener("DOMContentLoaded", async () => {
  t3ConfigurarVolta();

  document.getElementById("footerMount").innerHTML =
    t3Footer();

  const casamento =
    await t3CarregarCasamento();

  if (casamento) {
    t3AtualizarMonograma(casamento);
  }

  carregarPresentes();
});

async function carregarPresentes() {
  const container =
    document.getElementById("listaPresentes");

  try {
    const resposta = await fetch(
      `${T3_API}/api/casamentos/${encodeURIComponent(t3Slug())}/presentes`,
      { cache: "no-store" }
    );

    const dados =
      await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro ||
        "Não foi possível carregar os presentes."
      );
    }

    const presentes =
      Array.isArray(dados)
        ? dados
        : (dados.presentes || []);

    if (!presentes.length) {
      container.innerHTML =
        '<p class="placeholder-value">Nenhum presente cadastrado ainda.</p>';
      return;
    }

    container.innerHTML =
      presentes
        .map((presente, index) => {
          const livre =
            presente.tipo ===
            "contribuicao_livre";

          const valor =
            Number(presente.valor || 0);

          const arrecadado =
            Number(presente.arrecadado || 0);

          const restante =
            Math.max(
              valor - arrecadado,
              0
            );

          const quitado =
            !livre &&
            (
              Boolean(presente.comprado) ||
              (
                valor > 0 &&
                restante <= 0
              )
            );

          return `
            <article class="cardPresente ${livre ? "contribuicaoLivreCard" : ""}">
              ${
                presente.imagem
                  ? `<img src="${escapar(presente.imagem)}" alt="${escapar(presente.nome || "Presente")}">`
                  : `<div class="cardPresenteSemImagem">SEM IMAGEM</div>`
              }

              <h3>${escapar(presente.nome || "Presente")}</h3>

              <p class="descricaoPresente">
                ${escapar(presente.descricao || "")}
              </p>

              ${
                livre
                  ? `<p class="valorAtual">VOCÊ ESCOLHE O VALOR</p>`
                  : (
                      arrecadado > 0
                        ? `<p class="valorAntigo">${moeda(valor)}</p>`
                        : ""
                    )
              }

              ${
                livre
                  ? ""
                  : (
                      quitado
                        ? `<p class="presenteado">PRESENTEADO</p>`
                        : `<p class="valorAtual">${moeda(restante || valor)}</p>`
                    )
              }

              ${
                !livre && presente.link
                  ? `<a class="btnVerProduto" href="${escapar(presente.link)}" target="_blank" rel="noopener noreferrer">VER PRODUTO ↗</a>`
                  : ""
              }

              ${
                quitado
                  ? ""
                  : `<button type="button" data-presente="${index}">${livre ? "CONTRIBUIR" : "PRESENTEAR"}</button>`
              }
            </article>
          `;
        })
        .join("");

    container
      .querySelectorAll("[data-presente]")
      .forEach((botao) => {
        botao.addEventListener(
          "click",
          () => {
            const index =
              Number(
                botao.dataset.presente
              );

            localStorage.setItem(
              "produtoCheckout",
              JSON.stringify({
                ...presentes[index],
                index
              })
            );

            window.location.href =
              t3Link(
                "template-03-checkout.html"
              );
          }
        );
      });

  } catch (erro) {
    console.error(erro);

    container.innerHTML =
      '<p class="placeholder-value">Não foi possível carregar a lista agora.</p>';
  }
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  );
}

function escapar(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

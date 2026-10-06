document.addEventListener("DOMContentLoaded", async () => {
  await t2InicializarPagina("presentes");

  document.getElementById("iconePresentear").innerHTML = t2Icone("presente");
  document.getElementById("iconeLoja").innerHTML =
    `<svg viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6H18a2 2 0 0 0 2-1.6L21 8H7"/></svg>`;

  await carregarPresentes();
});

async function carregarPresentes() {
  const container = document.getElementById("listaPresentes");

  try {
    const resposta = await fetch(
      `${T2_API}/api/casamentos/${encodeURIComponent(t2Slug())}/presentes`,
      { cache: "no-store" }
    );

    const dados = await resposta.json();
    if (!resposta.ok) {
      throw new Error(dados.erro || "Não foi possível carregar os presentes.");
    }

    const presentes = Array.isArray(dados) ? dados : (dados.presentes || []);

    if (!presentes.length) {
      container.innerHTML = `<div class="t2-paper t2-empty">A lista de presentes ainda está sendo preparada.</div>`;
      return;
    }

    container.innerHTML = presentes.map((presente, index) => {
      const valor = Number(presente.valor || 0);
      const arrecadado = Number(presente.arrecadado || 0);
      const restante = Math.max(valor - arrecadado, 0);
      const quitado =
        Boolean(presente.comprado) ||
        (valor > 0 && restante <= 0);

      return `
        <article class="t2-product">
          <div class="t2-product-media">
            ${
              presente.imagem
                ? `<img src="${t2EscapeAttr(presente.imagem)}" alt="${t2EscapeAttr(presente.nome || "Presente")}" loading="lazy">`
                : `<div class="t2-no-image">SEM IMAGEM</div>`
            }
          </div>

          <div class="t2-product-body">
            <h3>${t2EscapeHtml(presente.nome || "Presente")}</h3>
            <p class="t2-product-description">${t2EscapeHtml(presente.descricao || "")}</p>

            ${
              quitado
                ? `<p class="t2-product-status">Presenteado ♡</p>`
                : `<p class="t2-product-price">${t2Moeda(restante || valor)}</p>`
            }

            <div class="t2-product-actions">
              ${
                presente.link
                  ? `<a class="t2-btn t2-btn-light" href="${t2EscapeAttr(presente.link)}" target="_blank" rel="noopener noreferrer">Ver produto ↗</a>`
                  : `<span class="t2-btn t2-btn-light" style="opacity:.45">Sem link</span>`
              }

              ${
                quitado
                  ? `<span class="t2-btn t2-btn-primary" style="opacity:.65">Presenteado</span>`
                  : `<button class="t2-btn t2-btn-primary" type="button" data-presentear="${index}">Presentear</button>`
              }
            </div>
          </div>
        </article>
      `;
    }).join("");

    container.querySelectorAll("[data-presentear]").forEach((botao) => {
      botao.addEventListener("click", () => {
        const index = Number(botao.dataset.presentear);
        localStorage.setItem(
          "produtoCheckout",
          JSON.stringify({ ...presentes[index], index })
        );
        window.location.href = t2Link("template-02-checkout.html");
      });
    });
  } catch (erro) {
    console.error(erro);
    container.innerHTML = `<div class="t2-paper t2-empty">Não foi possível carregar a lista agora.</div>`;
  }
}

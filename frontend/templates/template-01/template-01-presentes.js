document.addEventListener("DOMContentLoaded", async () => {
  await t1Init("gifts");
  carregarPresentes();
});

async function carregarPresentes() {
  const box = document.getElementById("giftList");

  try {
    const r = await fetch(
      `${T1_API}/api/casamentos/${encodeURIComponent(t1Slug())}/presentes`,
      { cache:"no-store" }
    );

    const dados = await r.json();
    if (!r.ok) throw new Error(dados.erro || "Erro ao carregar.");

    const presentes = Array.isArray(dados) ? dados : [];

    if (!presentes.length) {
      box.innerHTML = `<div class="t1-card">A lista ainda está sendo preparada.</div>`;
      return;
    }

    box.innerHTML = presentes.map((p,index) => {
      const livre = p.tipo === "contribuicao_livre";
      const valor = Number(p.valor || 0);
      const arrecadado = Number(p.arrecadado || 0);
      const restante = Math.max(valor - arrecadado, 0);
      const quitado = !livre && (Boolean(p.comprado) || (valor > 0 && restante <= 0));

      return `
        <article class="t1-product ${livre ? "contribuicaoLivreCard" : ""}">
          <div class="t1-product-media">
            ${p.imagem
              ? `<img src="${t1Esc(p.imagem)}" alt="${t1Esc(p.nome || "Presente")}" loading="lazy">`
              : "SEM IMAGEM"
            }
          </div>

          <div class="t1-product-body">
            <h3>${t1Esc(p.nome || "Presente")}</h3>
            <p>${t1Esc(p.descricao || "")}</p>

            <strong class="t1-price">
              ${livre
                ? "VOCÊ ESCOLHE O VALOR"
                : (quitado ? "PRESENTEADO ♡" : t1Money(restante || valor))
              }
            </strong>

            <div class="t1-actions">
              ${!livre && p.link
                ? `<a class="t1-btn t1-btn-light" target="_blank" rel="noopener noreferrer" href="${t1Esc(p.link)}">Ver produto</a>`
                : `<span class="t1-btn t1-btn-light">${livre ? "Valor livre" : "Sem link"}</span>`
              }

              ${quitado
                ? `<span class="t1-btn" style="opacity:.5">Presenteado</span>`
                : `<button class="t1-btn" type="button" data-i="${index}">${livre ? "Contribuir" : "Presentear"}</button>`
              }
            </div>
          </div>
        </article>
      `;
    }).join("");

    box.querySelectorAll("[data-i]").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.i);
        localStorage.setItem(
          "produtoCheckout",
          JSON.stringify({ ...presentes[i], index:i })
        );
        location.href = t1Link("template-01-checkout.html");
      });
    });
  } catch (err) {
    console.error(err);
    box.innerHTML = `<div class="t1-card">Não foi possível carregar a lista agora.</div>`;
  }
}

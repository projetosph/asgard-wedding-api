document.addEventListener("DOMContentLoaded", async () => {
  await t2InicializarPagina("recados");
  await carregarRecados();

  document.getElementById("formRecado").addEventListener("submit", enviarRecado);
});

async function carregarRecados() {
  const container = document.getElementById("listaRecados");

  try {
    const resposta = await fetch(
      `${T2_API}/api/casamentos/${encodeURIComponent(t2Slug())}/recados`,
      { cache: "no-store" }
    );

    const dados = await resposta.json();

    if (!resposta.ok) throw new Error(dados.erro || "Erro ao carregar recados.");

    if (!Array.isArray(dados) || !dados.length) {
      container.innerHTML =
        `<article class="t2-paper t2-message"><p>Ainda não recebemos recados. Seja o primeiro ♡</p></article>`;
      return;
    }

    container.innerHTML = dados.slice(0, 20).map((r) => `
      <article class="t2-paper t2-message">
        <strong>${t2EscapeHtml(r.nome || "Convidado")}</strong>
        <p>${t2EscapeHtml(r.mensagem || "")}</p>
      </article>
    `).join("");
  } catch (erro) {
    console.error(erro);
    container.innerHTML =
      `<article class="t2-paper t2-message"><p>Não foi possível carregar os recados agora.</p></article>`;
  }
}

async function enviarRecado(event) {
  event.preventDefault();

  const status = document.getElementById("statusRecado");
  const nome = document.getElementById("nomeRecado").value.trim();
  const mensagem = document.getElementById("mensagemRecado").value.trim();

  status.textContent = "Enviando...";

  try {
    const resposta = await fetch(
      `${T2_API}/api/casamentos/${encodeURIComponent(t2Slug())}/recados`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, mensagem })
      }
    );

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(dados.erro || "Não foi possível enviar o recado.");
    }

    event.target.reset();
    status.textContent = "Recado enviado com carinho ♡";
    await carregarRecados();
  } catch (erro) {
    status.textContent = erro.message;
  }
}

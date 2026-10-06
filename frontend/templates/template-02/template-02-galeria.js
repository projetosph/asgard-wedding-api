document.addEventListener("DOMContentLoaded", async () => {
  await t2InicializarPagina("galeria");
  await carregarGaleria();
});

async function carregarGaleria() {
  const container = document.getElementById("galeriaFotos");

  try {
    const resposta = await fetch(
      `${T2_API}/api/casamentos/${encodeURIComponent(t2Slug())}/galeria`,
      { cache: "no-store" }
    );

    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    const fotos = await resposta.json();

    if (!Array.isArray(fotos) || !fotos.length) {
      container.innerHTML =
        `<div class="t2-paper t2-gallery-empty">As fotos serão adicionadas em breve.</div>`;
      return;
    }

    container.innerHTML = fotos.map((foto) => `
      <figure class="t2-gallery-item">
        <img
          src="${t2EscapeAttr(foto.imagem_url)}"
          alt="${t2EscapeAttr(foto.legenda || "Foto do casal")}"
          loading="lazy">
      </figure>
    `).join("");
  } catch (erro) {
    console.error("Erro ao carregar galeria:", erro);
    container.innerHTML =
      `<div class="t2-paper t2-gallery-empty">Não foi possível carregar a galeria agora.</div>`;
  }
}

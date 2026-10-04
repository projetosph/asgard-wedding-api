document.addEventListener("DOMContentLoaded", async () => {
  const slug = t3Slug();
  const container = document.getElementById("galeriaFotos");
  if (!slug || !container) return;

  try {
    const resposta = await fetch(
      `${T3_API}/api/casamentos/${encodeURIComponent(slug)}/galeria`,
      { cache: "no-store" }
    );
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    const fotos = await resposta.json();
    if (!Array.isArray(fotos) || !fotos.length) {
      container.innerHTML = `<div class="gallery-placeholder">As fotos serão adicionadas em breve.</div>`;
      return;
    }

    container.innerHTML = fotos.map((foto) => `
      <figure class="t3-gallery-item">
        <img src="${t3EscapeAttr(foto.imagem_url)}" alt="${t3EscapeAttr(foto.legenda || "Foto do casal")}">
        ${foto.legenda ? `<figcaption>${t3EscapeHtml(foto.legenda)}</figcaption>` : ""}
      </figure>
    `).join("");
  } catch (erro) {
    console.error("Erro ao carregar galeria:", erro);
    container.innerHTML = `<div class="gallery-placeholder">Não foi possível carregar as fotos agora.</div>`;
  }
});

function t3EscapeHtml(valor){
  return String(valor ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function t3EscapeAttr(valor){ return t3EscapeHtml(valor); }

document.addEventListener("DOMContentLoaded", async () => {
  await t2InicializarPagina("musica");
  document.getElementById("musicIcon").innerHTML = t2Icone("musica");
  await carregarMusica();
});

async function carregarMusica() {
  const player = document.getElementById("musicaPlayer");

  try {
    const resposta = await fetch(
      `${T2_API}/api/casamentos/${encodeURIComponent(t2Slug())}/musica`,
      { cache: "no-store" }
    );

    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    const musica = await resposta.json();

    if (!musica?.url) {
      player.innerHTML = `<p style="color:var(--t2-muted)">A música deste casamento ainda não foi cadastrada.</p>`;
      return;
    }

    t2Texto("musicaTitulo", musica.titulo || "Nossa música");

    const url = String(musica.url).trim();
    const direta = /\.(mp3|ogg|wav|m4a)(\?|#|$)/i.test(url);

    if (direta) {
      player.innerHTML = `
        <audio controls preload="none">
          <source src="${t2EscapeAttr(url)}">
        </audio>
      `;
    } else {
      player.innerHTML = `
        <a class="t2-btn t2-btn-primary" href="${t2EscapeAttr(url)}" target="_blank" rel="noopener noreferrer">
          Ouvir música ↗
        </a>
      `;
    }
  } catch (erro) {
    console.error(erro);
    player.innerHTML = `<p style="color:var(--t2-muted)">Não foi possível carregar a música agora.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const slug = t3Slug();
  const botao = document.getElementById("musicBtn");
  const audio = document.getElementById("audioCasamento");

  if (!slug) return;

  try {
    const resposta = await fetch(
      `${T3_API}/api/casamentos/${encodeURIComponent(slug)}/musica`,
      { cache: "no-store" }
    );

    if (!resposta.ok) return;

    const musica = await resposta.json();
    if (!musica?.url) return;

    const url = String(musica.url).trim();
    const titulo = String(musica.titulo || "Nossa música").trim();
    const direta = /\.(mp3|ogg|wav|m4a)(\?|#|$)/i.test(url);

    if (direta && audio && botao) {
      audio.src = url;
      audio.preload = "none";
      botao.title = titulo;
      return;
    }

    if (botao) {
      const novo = botao.cloneNode(true);
      botao.replaceWith(novo);
      novo.title = titulo;
      novo.addEventListener("click", () => {
        window.open(url, "_blank", "noopener,noreferrer");
      });
    }
  } catch (erro) {
    console.error("Erro ao carregar música:", erro);
  }
});

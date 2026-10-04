document.addEventListener("DOMContentLoaded", async () => {
  const slug = t3Slug();
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
    const titulo = musica.titulo || "Nossa música";
    const direta = /\.(mp3|ogg|wav|m4a)(\?|#|$)/i.test(url);

    const box = document.createElement("div");
    box.className = "t3-music-control";

    if (direta) {
      const audio = new Audio(url);
      audio.preload = "none";
      const botao = document.createElement("button");
      botao.type = "button";
      botao.textContent = `♫ ${titulo}`;
      botao.addEventListener("click", async () => {
        if (audio.paused) {
          try { await audio.play(); botao.classList.add("playing"); }
          catch (e) { console.error(e); }
        } else {
          audio.pause();
          botao.classList.remove("playing");
        }
      });
      audio.addEventListener("ended", () => botao.classList.remove("playing"));
      box.appendChild(botao);
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `♫ ${titulo}`;
      box.appendChild(link);
    }

    document.body.appendChild(box);
  } catch (erro) {
    console.error("Erro ao carregar música:", erro);
  }
});

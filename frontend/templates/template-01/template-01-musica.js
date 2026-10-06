document.addEventListener("DOMContentLoaded", async () => {
  await t1Init("music");

  const player = document.getElementById("musicPlayer");

  try {
    const r = await fetch(
      `${T1_API}/api/casamentos/${encodeURIComponent(t1Slug())}/musica`,
      { cache:"no-store" }
    );
    if (!r.ok) throw new Error();
    const m = await r.json();

    if (!m?.url) {
      player.innerHTML = `<p>A música ainda não foi cadastrada.</p>`;
      return;
    }

    document.getElementById("musicTitle").textContent = m.titulo || "Nossa música";
    const url = String(m.url);
    const direct = /\.(mp3|ogg|wav|m4a)(\?|#|$)/i.test(url);

    player.innerHTML = direct
      ? `<audio controls preload="none"><source src="${t1Esc(url)}"></audio>`
      : `<a class="t1-btn" href="${t1Esc(url)}" target="_blank" rel="noopener noreferrer">Ouvir música ↗</a>`;
  } catch {
    player.innerHTML = `<p>Não foi possível carregar a música agora.</p>`;
  }
});

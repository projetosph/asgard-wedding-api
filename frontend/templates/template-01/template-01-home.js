document.addEventListener("DOMContentLoaded", async () => {
  const w = await t1Init("home");

  document.getElementById("homeGiftLink").href = t1Link("template-01-presentes.html");
  document.getElementById("homeRsvpLink").href = t1Link("template-01-presenca.html");

  if (w) {
    const nome = w.local_nome || "—";
    const endereco = w.local_endereco || w.endereco || nome;
    document.getElementById("homeLocalNome").textContent = nome;
    const addrEl = document.getElementById("homeLocalEndereco");
    if (addrEl) addrEl.textContent = w.local_endereco || w.endereco || "";
    document.getElementById("homeMap").src =
      `https://www.google.com/maps?q=${encodeURIComponent(endereco)}&output=embed`;
    document.getElementById("homeMapLink").href =
      w.mapa_url || w.link_mapa || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;

    iniciarContador(w.data_casamento, w.horario);
  }

  carregarGaleriaHome();

  document.getElementById("homeRecadoForm").addEventListener("submit", enviarRecadoHome);
});

function iniciarContador(dataValor, horarioValor) {
  if (!dataValor) return;
  const hora = String(horarioValor || "15:30").slice(0,5);
  const alvo = new Date(`${String(dataValor).slice(0,10)}T${hora}:00`);

  function tick() {
    let diff = alvo.getTime() - Date.now();
    if (diff < 0) diff = 0;
    document.getElementById("cdDias").textContent = Math.floor(diff / 86400000);
    document.getElementById("cdHoras").textContent = String(Math.floor((diff % 86400000) / 3600000)).padStart(2,"0");
    document.getElementById("cdMinutos").textContent = String(Math.floor((diff % 3600000) / 60000)).padStart(2,"0");
  }

  tick();
  setInterval(tick, 60000);
}

async function carregarGaleriaHome() {
  const box = document.getElementById("homeGallery");

  try {
    const r = await fetch(
      `${T1_API}/api/casamentos/${encodeURIComponent(t1Slug())}/galeria`,
      { cache:"no-store" }
    );
    if (!r.ok) throw new Error();
    const fotos = await r.json();

    if (!Array.isArray(fotos) || !fotos.length) {
      box.innerHTML = `<div class="t1-box">As fotos serão adicionadas em breve.</div>`;
      return;
    }

    box.innerHTML = fotos.map(f => `
      <figure>
        <img src="${t1Esc(f.imagem_url)}" alt="${t1Esc(f.legenda || "Foto do casal")}" loading="lazy">
      </figure>
    `).join("");
  } catch {
    box.innerHTML = `<div class="t1-box">Não foi possível carregar a galeria agora.</div>`;
  }
}

async function enviarRecadoHome(e) {
  e.preventDefault();

  const status = document.getElementById("homeRecadoStatus");
  const nome = document.getElementById("homeRecadoNome").value.trim();
  const mensagem = document.getElementById("homeRecadoMensagem").value.trim();

  status.textContent = "Enviando...";

  try {
    const r = await fetch(
      `${T1_API}/api/casamentos/${encodeURIComponent(t1Slug())}/recados`,
      {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ nome, mensagem })
      }
    );
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || "Não foi possível enviar.");
    e.target.reset();
    status.textContent = "Recado enviado com carinho ♡";
  } catch (err) {
    status.textContent = err.message;
  }
}

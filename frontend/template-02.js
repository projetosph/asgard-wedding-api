const API = "https://asgard-wedding-api.onrender.com";

const params = new URLSearchParams(window.location.search);
const slug = params.get("casamento") || "paulo-e-alana";

let casamento = {
  slug,
  noivo: "Paulo",
  noiva: "Alana",
  data_casamento: "2026-09-07",
  horario: "15:30",
  local_nome: "Local da cerimônia",
  local_endereco: "Consulte o convite"
};

document.addEventListener("DOMContentLoaded", async () => {
  atualizarLinks();
  await carregarCasamento();
  preencherPagina();
  iniciarContador();
  configurarMusica();
  configurarRecado();
});

function atualizarLinks() {
  const q = `?casamento=${encodeURIComponent(slug)}`;

  document.getElementById("btnPresenca").href = `presenca.html${q}`;
  document.getElementById("cardPresenca").href = `presenca.html${q}`;
  document.getElementById("btnPresentes").href = `presentes.html${q}`;
  document.getElementById("giftBannerLink").href = `presentes.html${q}`;
}

async function carregarCasamento() {
  try {
    const r = await fetch(`${API}/api/casamentos/${encodeURIComponent(slug)}`, {
      cache: "no-store"
    });

    if (!r.ok) return;

    const dados = await r.json();
    casamento = { ...casamento, ...dados };
  } catch (e) {
    console.warn("Usando dados de demonstração do Template 02.", e);
  }
}

function preencherPagina() {
  const noivo = casamento.noivo || casamento.nome_noivo || "Noivo";
  const noiva = casamento.noiva || casamento.nome_noiva || "Noiva";

  setText("nome1", noivo);
  setText("nome2", noiva);

  const i1 = noivo.trim().charAt(0).toUpperCase();
  const i2 = noiva.trim().charAt(0).toUpperCase();

  setText("iniciais", `${i1} · ${i2}`);
  setText("iniciaisFinal", `${i1} & ${i2}`);

  const data = parseData(casamento.data_casamento);

  if (data) {
    setText(
      "dataCasamento",
      capitalizar(data.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      }))
    );

    setText(
      "cardData",
      capitalizar(data.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long"
      }))
    );

    setText(
      "dataCurta",
      `${String(data.getDate()).padStart(2,"0")} · ${String(data.getMonth()+1).padStart(2,"0")} · ${data.getFullYear()}`
    );
  }

  setText("cardHorario", formatarHorario(casamento.horario || "15:30"));
  setText("localNome", casamento.local_nome || casamento.local || "Local da cerimônia");
  setText("localEndereco", casamento.local_endereco || casamento.endereco || "Endereço do evento");

  const endereco =
    casamento.local_endereco ||
    casamento.endereco ||
    casamento.local_nome ||
    "";

  const mapa =
    casamento.mapa_url ||
    casamento.link_mapa ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;

  document.getElementById("mapLink").href = mapa;
}

function iniciarContador() {
  const data = parseData(casamento.data_casamento);
  if (!data) return;

  const [h, m] = String(casamento.horario || "15:30").slice(0,5).split(":").map(Number);
  data.setHours(Number.isFinite(h) ? h : 15, Number.isFinite(m) ? m : 30, 0, 0);

  function atualizar() {
    const diff = data.getTime() - Date.now();

    if (diff <= 0) {
      setText("dias", "000");
      setText("horas", "00");
      setText("minutos", "00");
      setText("segundos", "00");
      return;
    }

    setText("dias", String(Math.floor(diff / 86400000)).padStart(3, "0"));
    setText("horas", String(Math.floor((diff % 86400000) / 3600000)).padStart(2, "0"));
    setText("minutos", String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0"));
    setText("segundos", String(Math.floor((diff % 60000) / 1000)).padStart(2, "0"));
  }

  atualizar();
  setInterval(atualizar, 1000);
}

function configurarMusica() {
  const audio = document.getElementById("weddingAudio");
  const botao = document.getElementById("musicButton");

  botao.addEventListener("click", async () => {
    if (!audio.src && !audio.querySelector("source")) {
      alert("A música deste casamento ainda não foi configurada.");
      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
        botao.textContent = "❚❚ Pausar";
      } catch {
        alert("Não foi possível iniciar a música.");
      }
    } else {
      audio.pause();
      botao.textContent = "♪ Música";
    }
  });
}

function configurarRecado() {
  document.getElementById("recadoForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = document.getElementById("nomeRecado").value.trim();
    const mensagem = document.getElementById("mensagemRecado").value.trim();
    const status = document.getElementById("recadoStatus");

    status.textContent = "Enviando...";

    try {
      const r = await fetch(
        `${API}/api/casamentos/${encodeURIComponent(slug)}/recados`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome, mensagem })
        }
      );

      if (!r.ok) throw new Error();

      e.target.reset();
      status.textContent = "Recado enviado com carinho. ♥";
    } catch {
      status.textContent = "O envio de recados ainda precisa ser ligado à rota pública atual do backend.";
    }
  });
}

function parseData(valor) {
  if (!valor) return null;
  const [a, m, d] = String(valor).slice(0,10).split("-").map(Number);
  if (![a,m,d].every(Number.isFinite)) return null;
  return new Date(a, m - 1, d, 12, 0, 0);
}

function formatarHorario(v) {
  return String(v).slice(0,5).replace(":", "h");
}

function capitalizar(v) {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
}

function setText(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}

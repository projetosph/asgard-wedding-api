
const T3_API = "https://asgard-wedding-api.onrender.com";

function t3Slug() {
  return new URLSearchParams(window.location.search).get("casamento") || "";
}

function t3Link(pagina) {
  const slug = t3Slug();
  return `${pagina}${slug ? `?casamento=${encodeURIComponent(slug)}` : ""}`;
}

async function t3CarregarCasamento() {
  const slug = t3Slug();
  if (!slug) return null;

  try {
    const resposta = await fetch(
      `${T3_API}/api/casamentos/${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );

    if (!resposta.ok) {
      throw new Error(`HTTP ${resposta.status}`);
    }

    const dados = await resposta.json();
    return dados.casamento || dados;
  } catch (erro) {
    console.error("Erro ao carregar casamento:", erro);
    return null;
  }
}

function t3Texto(id, valor, fallback = "—") {
  const el = document.getElementById(id);
  if (el) el.textContent = valor || fallback;
}

function t3Data(valor) {
  if (!valor) return null;

  const [ano, mes, dia] = String(valor).slice(0, 10).split("-").map(Number);

  if (![ano, mes, dia].every(Number.isFinite)) return null;

  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

function t3FormatarData(valor) {
  const data = t3Data(valor);
  if (!data) return "—";

  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function t3FormatarHorario(valor) {
  if (!valor) return "—";
  return String(valor).slice(0, 5).replace(":", "h");
}

function t3AtualizarMonograma(casamento) {
  const noivo = casamento?.noivo || casamento?.nome_noivo || "";
  const noiva = casamento?.noiva || casamento?.nome_noiva || "";

  const iniciais = noivo && noiva
    ? `${noivo.trim().charAt(0).toUpperCase()} & ${noiva.trim().charAt(0).toUpperCase()}`
    : "—";

  document.querySelectorAll("[data-couple-monogram]").forEach(el => {
    el.textContent = iniciais;
  });
}

function t3ConfigurarVolta() {
  document.querySelectorAll("[data-home-link]").forEach(el => {
    el.href = t3Link("template-03.html");
  });
}

const ASGARD_API = "https://asgard-wedding-api.onrender.com";

function normalizarSlug(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function obterSlugCasamento() {
  const parametros = new URLSearchParams(window.location.search);
  const querySlug = parametros.get("casamento");
  if (querySlug) return normalizarSlug(querySlug);

  const partes = window.location.pathname.split("/").map(p => p.trim()).filter(Boolean);
  const arquivos = new Set([
    "index.html", "presentes.html", "presenca.html",
    "pagamento.html", "login.html", "admin.html"
  ]);

  for (const parte of partes) {
    const p = parte.toLowerCase();
    if (!arquivos.has(p) && !p.includes(".")) return normalizarSlug(parte);
  }

  return "paulo-e-alana";
}

const CASAMENTO_SLUG = obterSlugCasamento();

function formatarDataExtenso(dataIso) {
  if (!dataIso) return "";
  const [ano, mes, dia] = String(dataIso).slice(0, 10).split("-").map(Number);
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril",
    "Maio", "Junho", "Julho", "Agosto",
    "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return `${String(dia).padStart(2, "0")} de ${meses[mes - 1]} de ${ano}`;
}

function formatarHorario(horario) {
  if (!horario) return "";
  const [hora, minuto] = String(horario).split(":");
  return minuto && minuto !== "00" ? `${hora}h${minuto}` : `${hora}h`;
}

function dataHoraCasamento(casamento) {
  if (!casamento?.data_casamento) return null;
  const data = String(casamento.data_casamento).slice(0, 10);
  const hora = casamento.horario ? String(casamento.horario).slice(0, 8) : "00:00:00";
  return new Date(`${data}T${hora}`);
}

function atualizarLinksDoCasamento() {
  document.querySelectorAll("a[data-preservar-casamento]").forEach(link => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    const url = new URL(href, window.location.href);
    url.searchParams.set("casamento", CASAMENTO_SLUG);
    link.setAttribute("href", `${url.pathname}${url.search}${url.hash}`);
  });
}

function aplicarCasamentoNaPagina(casamento) {
  const nomeCasal = `${casamento.noivo} & ${casamento.noiva}`;
  const iniciais = `${casamento.noivo?.[0] || ""} & ${casamento.noiva?.[0] || ""}`;

  document.title = nomeCasal;

  document.querySelectorAll("[data-casal-nomes]").forEach(el => el.textContent = nomeCasal);
  document.querySelectorAll("[data-casal-iniciais]").forEach(el => el.textContent = iniciais);
  document.querySelectorAll("[data-casamento-data]").forEach(el => el.textContent = formatarDataExtenso(casamento.data_casamento));
  document.querySelectorAll("[data-casamento-horario]").forEach(el => {
    const horario = formatarHorario(casamento.horario);
    el.textContent = horario ? `Pontualmente às ${horario}` : "";
  });
  document.querySelectorAll("[data-local-nome]").forEach(el => el.textContent = casamento.local_nome || "");
  document.querySelectorAll("[data-local-endereco]").forEach(el => el.textContent = casamento.local_endereco || "");

  const iframe = document.querySelector("[data-mapa-iframe]");
  if (iframe && casamento.mapa_url) iframe.src = casamento.mapa_url;

  const mapaLink = document.querySelector("[data-mapa-link]");
  if (mapaLink && casamento.mapa_url) mapaLink.href = casamento.mapa_url;

  if (casamento.cor_primaria) {
    document.documentElement.style.setProperty("--casamento-cor-primaria", casamento.cor_primaria);
  }
  if (casamento.cor_secundaria) {
    document.documentElement.style.setProperty("--casamento-cor-secundaria", casamento.cor_secundaria);
  }

  atualizarLinksDoCasamento();
}

async function carregarCasamento() {
  const resposta = await fetch(`${ASGARD_API}/api/casamentos/${encodeURIComponent(CASAMENTO_SLUG)}`);
  const dados = await resposta.json();

  if (!resposta.ok) {
    throw new Error(dados.erro || "Não foi possível carregar este casamento.");
  }

  window.CASAMENTO = dados;
  aplicarCasamentoNaPagina(dados);

  document.dispatchEvent(
    new CustomEvent("asgard:casamento-carregado", { detail: dados })
  );

  return dados;
}

document.addEventListener("DOMContentLoaded", () => {
  carregarCasamento().catch(erro => {
    console.error("Asgard Wedding:", erro);
    const alvo = document.querySelector("[data-erro-casamento]");
    if (alvo) alvo.textContent = erro.message;
  });
});
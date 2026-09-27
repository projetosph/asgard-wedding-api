// ASGARD WEDDING - contexto do casamento
// Aceita:
//   /paulo-e-alana
//   /paulo-e-alana/presentes.html
//   ?casamento=paulo-e-alana
// Durante a transição, usa paulo-e-alana como fallback.

const ASGARD_API =
  window.ASGARD_API || "https://casamento-backend-f7e4.onrender.com";

function obterSlugCasamento() {
  const query = new URLSearchParams(window.location.search).get("casamento");
  if (query) return normalizarSlug(query);

  const partes = window.location.pathname
    .split("/")
    .filter(Boolean);

  const ignorar = new Set([
    "index.html",
    "presentes.html",
    "presenca.html",
    "pagamento.html",
    "login.html",
    "admin.html"
  ]);

  const candidato = partes.find(p => !ignorar.has(p.toLowerCase()));

  return normalizarSlug(candidato || "paulo-e-alana");
}

function normalizarSlug(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CASAMENTO_SLUG = obterSlugCasamento();

async function carregarCasamento() {
  const resposta = await fetch(
    `${ASGARD_API}/api/casamentos/${encodeURIComponent(CASAMENTO_SLUG)}`
  );

  const dados = await resposta.json();

  if (!resposta.ok) {
    throw new Error(dados.erro || "Casamento não encontrado.");
  }

  window.CASAMENTO = dados;
  aplicarCasamentoNaPagina(dados);
  document.dispatchEvent(
    new CustomEvent("asgard:casamento-carregado", { detail: dados })
  );

  return dados;
}

function aplicarCasamentoNaPagina(c) {
  const nomeCasal = `${c.noivo} & ${c.noiva}`;
  const iniciais = `${c.noivo?.[0] || ""} & ${c.noiva?.[0] || ""}`;

  document.querySelectorAll("[data-casal-nomes]")
    .forEach(el => el.textContent = nomeCasal);

  document.querySelectorAll("[data-casal-iniciais]")
    .forEach(el => el.textContent = iniciais);

  document.querySelectorAll("[data-casamento-data]")
    .forEach(el => el.textContent = formatarDataBR(c.data_casamento));

  document.querySelectorAll("[data-local-nome]")
    .forEach(el => el.textContent = c.local_nome || "");

  document.title = nomeCasal;

  if (c.cor_primaria) {
    document.documentElement.style.setProperty("--casamento-cor-primaria", c.cor_primaria);
  }
  if (c.cor_secundaria) {
    document.documentElement.style.setProperty("--casamento-cor-secundaria", c.cor_secundaria);
  }

  atualizarLinksDoCasamento();
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "";
  const apenasData = String(dataISO).slice(0, 10);
  const [ano, mes, dia] = apenasData.split("-");
  return `${dia}/${mes}/${ano}`;
}

function atualizarLinksDoCasamento() {
  document.querySelectorAll("a[data-preservar-casamento]").forEach(link => {
    const destino = link.getAttribute("href");
    if (!destino) return;

    const url = new URL(destino, window.location.href);
    url.searchParams.set("casamento", CASAMENTO_SLUG);
    link.setAttribute("href", url.pathname + url.search + url.hash);
  });
}

function dataHoraCasamento(c) {
  if (!c?.data_casamento) return null;
  const data = String(c.data_casamento).slice(0, 10);
  const hora = c.horario ? String(c.horario).slice(0, 8) : "00:00:00";
  return new Date(`${data}T${hora}`);
}

document.addEventListener("DOMContentLoaded", () => {
  carregarCasamento().catch(erro => {
    console.error("Asgard Wedding:", erro);
    const alvo = document.querySelector("[data-erro-casamento]");
    if (alvo) alvo.textContent = erro.message;
  });
});
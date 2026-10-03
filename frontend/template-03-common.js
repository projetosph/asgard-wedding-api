const T3_API = "https://asgard-wedding-api.onrender.com";

function t3Slug() {
  return new URLSearchParams(location.search).get("casamento") || "";
}

async function t3CarregarCasamento() {
  const slug = t3Slug();
  if (!slug) return null;

  try {
    const r = await fetch(`${T3_API}/api/casamentos/${encodeURIComponent(slug)}`, {cache:"no-store"});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const dados = await r.json();
    return dados.casamento || dados;
  } catch (e) {
    console.error("Não foi possível carregar o casamento:", e);
    return null;
  }
}

function t3Data(valor) {
  if (!valor) return null;
  const [a,m,d] = String(valor).slice(0,10).split("-").map(Number);
  if (![a,m,d].every(Number.isFinite)) return null;
  return new Date(a,m-1,d,12,0,0);
}

function t3Set(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor || "—";
}

function t3Query(pagina) {
  const slug = t3Slug();
  return `${pagina}${slug ? `?casamento=${encodeURIComponent(slug)}` : ""}`;
}

function t3TopoVoltar(pagina="template-03.html") {
  const el = document.getElementById("voltarCasamento");
  if (el) el.href = t3Query(pagina);
}

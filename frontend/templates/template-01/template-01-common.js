const T1_API = "https://asgard-wedding-api.onrender.com";

const T1_SOCIAL = {
  whatsapp: "https://wa.me/5575999207455",
  instagram: "https://www.instagram.com/asgardtec?stkn=MXA4dHZtNnd3aTI1Mg%3D%3D&utm_source=qr",
  facebook: "https://www.facebook.com/share/19WMXVyN5B/?mibextid=wwXIfr"
};

const T1_DEFAULT_COVER =
  "https://storage.alboom.ninja/sites/4564/albuns/713676/pre-wedding-campo-alegre-ck.419.jpg?t=1600800043";

function t1Slug() {
  return new URLSearchParams(location.search).get("casamento") || "";
}

function t1Link(page) {
  const slug = t1Slug();
  return `${page}${slug ? `?casamento=${encodeURIComponent(slug)}` : ""}`;
}

function t1Esc(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function t1Money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function t1Date(value) {
  if (!value) return "—";
  const [y,m,d] = String(value).slice(0,10).split("-").map(Number);
  return new Date(y,m-1,d,12).toLocaleDateString("pt-BR", {
    day:"2-digit",
    month:"long",
    year:"numeric"
  });
}

function t1Hour(value) {
  return value ? String(value).slice(0,5).replace(":","h") : "—";
}

function t1Header(active = "") {
  const items = [
    ["home","Início","template-01.html"],
    ["gifts","Presentes","template-01-presentes.html"],
    ["rsvp","Presença","template-01-presenca.html"],
    ["local","Local","template-01-local.html"],
    ["messages","Recados","template-01.html#recados"],
    ["gallery","Galeria","template-01.html#galeria"],
    ["music","Músicas","template-01-musica.html"]
  ];

  return `
    <header class="t1-header">
      <a class="t1-logo" href="${t1Link("template-01.html")}">
        <strong data-t1-monogram>— & —</strong>
      </a>

      <button class="t1-menu-btn" id="t1MenuBtn" type="button" aria-label="Abrir menu">☰</button>

      <nav class="t1-nav" id="t1Nav">
        ${items.map(([key,label,page]) => `
          <a class="${active===key?"active":""}" href="${page.includes("#") ? `${page}${t1Slug()?`?casamento=${encodeURIComponent(t1Slug())}`:""}` : t1Link(page)}">
            ${label}
          </a>
        `).join("")}
      </nav>

      <a class="t1-header-gift" href="${t1Link("template-01-presentes.html")}">
        Lista de Presentes
      </a>
    </header>
  `;
}

function t1Footer() {
  return `
    <footer class="t1-footer">
      <div class="t1-footer-brand">
        <strong>Asgard Wedding</strong>
        <span>· por Asgard Tech</span>
      </div>

      <div class="t1-social">
        <a href="${T1_SOCIAL.whatsapp}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <a href="${T1_SOCIAL.instagram}" target="_blank" rel="noopener noreferrer">Instagram</a>
        <a href="${T1_SOCIAL.facebook}" target="_blank" rel="noopener noreferrer">Facebook</a>
      </div>
    </footer>
  `;
}

async function t1Wedding() {
  const slug = t1Slug();
  if (!slug) return null;

  try {
    const response = await fetch(
      `${T1_API}/api/casamentos/${encodeURIComponent(slug)}`,
      { cache:"no-store" }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const wedding = data.casamento || data;
    t1Apply(wedding);
    return wedding;
  } catch (error) {
    console.error("Erro ao carregar casamento:", error);
    return null;
  }
}

function t1Apply(w) {
  const a = w?.noivo || "";
  const b = w?.noiva || "";
  const mono = `${a?.[0]?.toUpperCase() || "—"} & ${b?.[0]?.toUpperCase() || "—"}`;

  document.querySelectorAll("[data-t1-monogram]").forEach(el => el.textContent = mono);
  document.querySelectorAll("[data-t1-couple]").forEach(el => el.textContent = a && b ? `${a} & ${b}` : "—");
  document.querySelectorAll("[data-t1-date]").forEach(el => el.textContent = t1Date(w?.data_casamento));
  document.querySelectorAll("[data-t1-time]").forEach(el => el.textContent = w?.horario ? `Pontualmente às ${t1Hour(w.horario)}` : "—");

  const cover = w?.foto_capa || w?.foto_home || w?.foto_principal || T1_DEFAULT_COVER;
  document.documentElement.style.setProperty("--t1-cover", `url("${String(cover).replaceAll('"','\\"')}")`);
}

async function t1Init(active = "") {
  const h = document.getElementById("t1Header");
  const f = document.getElementById("t1Footer");
  if (h) h.innerHTML = t1Header(active);
  if (f) f.innerHTML = t1Footer();

  document.getElementById("t1MenuBtn")?.addEventListener("click", () => {
    document.getElementById("t1Nav")?.classList.toggle("open");
  });

  return t1Wedding();
}

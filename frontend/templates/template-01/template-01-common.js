const T1_API = "https://asgard-wedding-api.onrender.com";

const T1_SOCIAL = {
  whatsapp: "https://wa.me/5575999207455",
  instagram: "https://www.instagram.com/asgardtec?stkn=MXA4dHZtNnd3aTI1Mg%3D%3D&utm_source=qr",
  facebook: "https://www.facebook.com/share/19WMXVyN5B/?mibextid=wwXIfr"
};

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

  const navLink = (page) => {
    if (page.includes("#")) {
      const [base, hash] = page.split("#");
      return `${t1Link(base)}#${hash}`;
    }
    return t1Link(page);
  };

  return `
    <header class="t1-header">
      <a class="t1-logo" href="${t1Link("template-01.html")}" aria-label="Início">
        <strong data-t1-monogram>— & —</strong>
      </a>

      <div class="t1-header-actions">
        <a class="t1-header-gift" href="${t1Link("template-01-presentes.html")}">
          Lista de Presentes
        </a>

        <button
          class="t1-menu-btn"
          id="t1MenuBtn"
          type="button"
          aria-label="Abrir menu"
          aria-expanded="false"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      <nav class="t1-nav" id="t1Nav" aria-hidden="true">
        <div class="t1-nav-head">
          <span>Menu</span>
          <button id="t1MenuClose" type="button" aria-label="Fechar menu">×</button>
        </div>

        ${items.map(([key,label,page]) => `
          <a class="${active===key?"active":""}" href="${navLink(page)}">${label}</a>
        `).join("")}
      </nav>

      <div class="t1-nav-backdrop" id="t1NavBackdrop"></div>
    </header>
  `;
}

function t1Footer() {
  return `
    <footer class="t1-footer">
      <div class="t1-footer-brand">
        <strong>ASGARD TECH</strong>
        <span>Feito com ❤ para todos os casais</span>
      </div>

      <div class="t1-social">
        <a href="${T1_SOCIAL.whatsapp}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <a href="${T1_SOCIAL.instagram}" target="_blank" rel="noopener noreferrer">Instagram</a>
        <a href="${T1_SOCIAL.facebook}" target="_blank" rel="noopener noreferrer">Facebook</a>
      </div>

      <small>© 2026 Asgard TECH</small>
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
  document.querySelectorAll("[data-t1-time]").forEach(el => {
    el.textContent = w?.horario ? `Pontualmente às ${t1Hour(w.horario)}` : "—";
  });
}

function t1MenuSetup() {
  const btn = document.getElementById("t1MenuBtn");
  const close = document.getElementById("t1MenuClose");
  const nav = document.getElementById("t1Nav");
  const backdrop = document.getElementById("t1NavBackdrop");

  const open = () => {
    nav?.classList.add("open");
    backdrop?.classList.add("open");
    document.body.classList.add("menu-open");
    btn?.setAttribute("aria-expanded","true");
    nav?.setAttribute("aria-hidden","false");
  };

  const shut = () => {
    nav?.classList.remove("open");
    backdrop?.classList.remove("open");
    document.body.classList.remove("menu-open");
    btn?.setAttribute("aria-expanded","false");
    nav?.setAttribute("aria-hidden","true");
  };

  btn?.addEventListener("click", open);
  close?.addEventListener("click", shut);
  backdrop?.addEventListener("click", shut);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") shut();
  });
}

async function t1Init(active = "") {
  const h = document.getElementById("t1Header");
  const f = document.getElementById("t1Footer");

  if (h) h.innerHTML = t1Header(active);
  if (f) f.innerHTML = t1Footer();

  t1MenuSetup();
  return t1Wedding();
}

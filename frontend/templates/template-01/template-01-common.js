const T1_API = "https://asgard-wedding-api.onrender.com";

const T1_SOCIAL = {
  whatsapp: "https://wa.me/5575999207455",
  instagram: "https://www.instagram.com/azgard.br?stkn=MXA4dHZtNnd3aTI1Mg%3D%3D&utm_source=qr",
  facebook: "https://www.facebook.com/people/Azgard-Solu%C3%A7%C3%B5es-Digitais/61575165721932/?mibextid=wwXIfr&rdid=OC62yg32hqhWkWQX&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F19WMXVyN5B%2F%3Fmibextid%3DwwXIfr"
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
        <div class="t1-footer-brandline">
          <img src="../../assets/branding/noivaria-logo.svg" alt="">
          <div><strong>NOIVARIA</strong><small>por Azgard</small></div>
        </div>
        <span>Feito para celebrar histórias.</span>
      </div>

      <div class="t1-social" aria-label="Redes sociais da Azgard">
        <a href="${T1_SOCIAL.whatsapp}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="WhatsApp">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a9.86 9.86 0 0 0-8.46 14.93L2 22l5.2-1.49A9.99 9.99 0 1 0 12 2Zm0 17.98a8 8 0 0 1-4.08-1.1l-.29-.17-3.08.88.91-3-.19-.31A8 8 0 1 1 12 19.98Zm4.39-5.99c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.93-1.19-.71-.64-1.2-1.42-1.34-1.66-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.09 3.62.57.25 1.02.39 1.37.5.58.18 1.1.16 1.51.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/></svg>
        </a>
        <a href="${T1_SOCIAL.instagram}" target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.25-3.1a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z"/></svg>
        </a>
        <a href="${T1_SOCIAL.facebook}" target="_blank" rel="noopener noreferrer" aria-label="Facebook" title="Facebook">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.25c-1.24 0-1.62.77-1.62 1.55V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12Z"/></svg>
        </a>
      </div>

      <small class="t1-footer-copy">© 2026 Azgard</small>
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

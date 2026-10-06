const T2_API = "https://asgard-wedding-api.onrender.com";
const T2_DEFAULT_BG =
  "https://storage.alboom.ninja/sites/4564/albuns/713676/pre-wedding-campo-alegre-ck.419.jpg?t=1600800043";

const T2_SOCIAL = {
  whatsapp: "https://wa.me/5575999207455",
  instagram: "https://www.instagram.com/asgardtec?stkn=MXA4dHZtNnd3aTI1Mg%3D%3D&utm_source=qr",
  facebook: "https://www.facebook.com/share/19WMXVyN5B/?mibextid=wwXIfr"
};

function t2Slug() {
  return new URLSearchParams(window.location.search).get("casamento") || "";
}

function t2Link(pagina) {
  const slug = t2Slug();
  return `${pagina}${slug ? `?casamento=${encodeURIComponent(slug)}` : ""}`;
}

function t2EscapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function t2EscapeAttr(valor) {
  return t2EscapeHtml(valor);
}

function t2Data(valor) {
  if (!valor) return null;
  const [ano, mes, dia] = String(valor).slice(0, 10).split("-").map(Number);
  if (![ano, mes, dia].every(Number.isFinite)) return null;
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

function t2FormatarData(valor) {
  const data = t2Data(valor);
  if (!data) return "—";
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function t2FormatarHorario(valor) {
  if (!valor) return "—";
  return String(valor).slice(0, 5).replace(":", "h");
}

function t2Texto(id, valor, fallback = "—") {
  const el = document.getElementById(id);
  if (el) el.textContent = valor || fallback;
}

function t2Icone(nome) {
  const icones = {
    home: `<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8Z"/></svg>`,
    presente: `<svg viewBox="0 0 24 24"><path d="M4 10h16v11H4zM3 7h18v3H3zM12 7v14M12 7H8.7A2.7 2.7 0 1 1 12 3.3V7Zm0 0h3.3A2.7 2.7 0 1 0 12 3.3V7Z"/></svg>`,
    presenca: `<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 9h16M9 14l2 2 4-4"/></svg>`,
    local: `<svg viewBox="0 0 24 24"><path d="M12 22s7-6 7-13a7 7 0 1 0-14 0c0 7 7 13 7 13Z"/><circle cx="12" cy="9" r="2.2"/></svg>`,
    recado: `<svg viewBox="0 0 24 24"><path d="M21 11.2A8.5 8.5 0 0 1 9.5 19L4 21l2-5.2A8.5 8.5 0 1 1 21 11.2Z"/></svg>`,
    galeria: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m5 18 5-5 3 3 2-2 4 4"/></svg>`,
    musica: `<svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12M9 9l10-2"/><circle cx="6.5" cy="18.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>`,
    seta: `<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>`
  };
  return icones[nome] || "";
}

function t2Header(ativo = "") {
  const itens = [
    ["inicio", "Início", "template-02.html"],
    ["presentes", "Presentes", "template-02-presentes.html"],
    ["presenca", "Presença", "template-02-presenca.html"],
    ["local", "Local", "template-02-local.html"],
    ["recados", "Recados", "template-02-recados.html"],
    ["galeria", "Galeria", "template-02-galeria.html"],
    ["musica", "Músicas", "template-02-musica.html"]
  ];

  return `
    <header class="t2-header">
      <a class="t2-brand" href="${t2Link("template-02.html")}">
        <span data-t2-monogram>— & —</span>
        <small>nosso casamento</small>
      </a>

      <nav class="t2-nav" aria-label="Navegação principal">
        ${itens.map(([chave, rotulo, pagina]) => `
          <a class="${ativo === chave ? "ativo" : ""}" href="${t2Link(pagina)}">${rotulo}</a>
        `).join("")}
      </nav>

      <a class="t2-header-rsvp" href="${t2Link("template-02-presenca.html")}">
        <span>♡</span> Confirmar presença
      </a>
    </header>
  `;
}

function t2Footer() {
  return `
    <footer class="t2-footer">
      <div class="t2-footer-brand">
        <strong>Asgard Wedding</strong>
        <span>—</span>
        <small>por Asgard Tech</small>
      </div>

      <div class="t2-social">
        <a href="${T2_SOCIAL.whatsapp}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
          <svg viewBox="0 0 24 24"><path d="M12 2a9.8 9.8 0 0 0-8.5 14.8L2 22l5.3-1.4A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Z"/><path d="M8.4 7.7c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.7c.1.3.1.5-.1.7l-.6.7c-.2.2-.1.4 0 .6.6 1.1 1.5 2 2.6 2.6.2.1.4.2.6 0l.9-1c.2-.2.4-.3.7-.2l1.8.8c.3.1.4.3.4.6 0 .7-.3 1.5-.9 2-.6.5-1.3.8-2.1.7-1.3-.2-3-.9-4.8-2.5-1.4-1.3-2.4-2.9-2.8-4.2-.3-1-.1-1.8.2-2.5Z"/></svg>
          <span>WhatsApp</span>
        </a>
        <i></i>
        <a href="${T2_SOCIAL.instagram}" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>
          <span>Instagram</span>
        </a>
        <i></i>
        <a href="${T2_SOCIAL.facebook}" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
          <svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v6h4v-6h3l1-4h-4V9c0-.7.3-1 1-1Z"/></svg>
          <span>Facebook</span>
        </a>
      </div>
    </footer>
  `;
}

async function t2CarregarCasamento() {
  const slug = t2Slug();
  if (!slug) return null;

  try {
    const resposta = await fetch(
      `${T2_API}/api/casamentos/${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );

    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    const dados = await resposta.json();
    const casamento = dados.casamento || dados;

    t2AplicarCasamento(casamento);
    return casamento;
  } catch (erro) {
    console.error("Erro ao carregar casamento:", erro);
    return null;
  }
}

function t2AplicarCasamento(casamento) {
  const noivo = casamento?.noivo || casamento?.nome_noivo || "";
  const noiva = casamento?.noiva || casamento?.nome_noiva || "";

  const i1 = noivo ? noivo.charAt(0).toUpperCase() : "—";
  const i2 = noiva ? noiva.charAt(0).toUpperCase() : "—";

  document.querySelectorAll("[data-t2-monogram]").forEach((el) => {
    el.textContent = `${i1} & ${i2}`;
  });

  document.querySelectorAll("[data-t2-casal]").forEach((el) => {
    el.textContent = noivo && noiva ? `${noivo} & ${noiva}` : "—";
  });

  document.querySelectorAll("[data-t2-data]").forEach((el) => {
    el.textContent = t2FormatarData(casamento?.data_casamento);
  });

  document.querySelectorAll("[data-t2-horario]").forEach((el) => {
    const horario = t2FormatarHorario(casamento?.horario);
    el.textContent = horario === "—" ? "—" : `Pontualmente às ${horario}`;
  });

  const imagem =
    casamento?.foto_capa ||
    casamento?.foto_home ||
    casamento?.foto_principal ||
    T2_DEFAULT_BG;

  document.documentElement.style.setProperty(
    "--t2-background-image",
    `url("${String(imagem).replaceAll('"', '\\"')}")`
  );
}

async function t2InicializarPagina(ativo) {
  const header = document.getElementById("t2Header");
  const footer = document.getElementById("t2Footer");

  if (header) header.innerHTML = t2Header(ativo);
  if (footer) footer.innerHTML = t2Footer();

  return t2CarregarCasamento();
}

function t2Moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

const params = new URLSearchParams(window.location.search);
const casamentoSlug = params.get("casamento");

if (casamentoSlug) {
  window.location.replace(
    `casamento.html?casamento=${encodeURIComponent(casamentoSlug)}`
  );
}

// Coloque aqui o WhatsApp da empresa com 55 + DDD + número, somente dígitos.
const WHATSAPP_EMPRESA = "5575999207455";

const MENSAGEM_ORCAMENTO =
  "Olá! Conheci a Noivaria e gostaria de fazer um orçamento para um site de casamento.";

function abrirWhatsApp() {
  if (!WHATSAPP_EMPRESA) {
    alert("Configure o número do WhatsApp da Azgard no arquivo lobby.js.");
    return;
  }

  const numero = WHATSAPP_EMPRESA.replace(/\D/g, "");
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(MENSAGEM_ORCAMENTO)}`;

  window.open(url, "_blank", "noopener,noreferrer");
}

document.querySelectorAll("[data-whatsapp]").forEach((botao) => {
  botao.addEventListener("click", abrirWhatsApp);
});

const menuToggle = document.getElementById("menuToggle");
const menu = document.getElementById("menu");

menuToggle?.addEventListener("click", () => {
  menu.classList.toggle("open");
});




/* ===== DEMONSTRAÇÃO DOS TEMPLATES REAIS ===== */
const TEMPLATE_DEMO_SLUG = "joao-e-maria";
const templateFrame = document.getElementById("templateDemoFrame");
const templateOpen = document.getElementById("abrirTemplateDemo");
const templateLabel = document.getElementById("templateBrowserLabel");
const templateTabs = document.querySelectorAll("[data-template]");

function selecionarTemplateDemo(template) {
  const valido = ["template-01","template-02","template-03","template-04"].includes(template)
    ? template
    : "template-01";

  templateTabs.forEach((botao) => {
    const ativo = botao.dataset.template === valido;
    botao.classList.toggle("active", ativo);
    botao.setAttribute("aria-selected", ativo ? "true" : "false");
  });

  const numero = valido.slice(-2);

  if (templateLabel) {
    templateLabel.textContent = `Prévia real · Template ${numero}`;
  }

  if (templateFrame) {
    templateFrame.title = `Prévia real do Template ${numero}`;
    templateFrame.src =
      `admin-template-preview.html?template=${encodeURIComponent(valido)}`;
  }

  if (templateOpen) {
    templateOpen.href =
      `templates/${valido}/${valido}.html?casamento=${encodeURIComponent(TEMPLATE_DEMO_SLUG)}`;
  }
}

templateTabs.forEach((botao) => {
  botao.addEventListener("click", () => {
    selecionarTemplateDemo(botao.dataset.template);
  });
});

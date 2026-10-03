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
  "Olá! Conheci a Asgard Wedding e gostaria de fazer um orçamento para um site de casamento.";

function abrirWhatsApp() {
  if (!WHATSAPP_EMPRESA) {
    alert("Configure o número do WhatsApp da Asgard Tech no arquivo lobby.js.");
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



const API = "https://asgard-wedding-api.onrender.com";
const SITE_BASE = "https://projetosph.github.io/asgard-wedding-api";

const token = sessionStorage.getItem("asgard_casal_token");
const usuario = JSON.parse(sessionStorage.getItem("asgard_casal_usuario") || "null");

if (!token || !usuario || usuario.perfil !== "casal") {
  window.location.replace("casal-login.html");
}

let casamento = null;
let presentes = [];
let pagamentos = [];
let presencas = [];
let recados = [];

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("btnSair").addEventListener("click", sair);
  document.getElementById("mobileMenu").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  document.querySelectorAll(".nav-item").forEach((botao) => {
    botao.addEventListener("click", () => abrirView(botao.dataset.view));
  });

  document.getElementById("copiarLink").addEventListener("click", copiarLink);
  document.getElementById("btnNovoPresente").addEventListener("click", () => abrirModalPresente());
  document.getElementById("fecharModal").addEventListener("click", fecharModal);
  document.getElementById("formPresente").addEventListener("submit", salvarPresente);
  document.getElementById("mpResumoBotao").addEventListener("click", () => abrirView("mercadopago"));
  document.getElementById("btnConectarMp").addEventListener("click", conectarMercadoPago);

  await carregarTudo();
});

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

async function api(caminho, opcoes = {}) {
  const resposta = await fetch(`${API}${caminho}`, {
    ...opcoes,
    headers: {
      ...headers(),
      ...(opcoes.headers || {})
    },
    cache: "no-store"
  });

  const texto = await resposta.text();

  let dados = {};
  try {
    dados = texto ? JSON.parse(texto) : {};
  } catch {
    dados = { erro: texto };
  }

  if (resposta.status === 401) {
    sair();
    throw new Error("Sua sessão expirou.");
  }

  if (!resposta.ok) {
    throw new Error(dados.erro || "Não foi possível concluir a operação.");
  }

  return dados;
}

function sair() {
  sessionStorage.removeItem("asgard_casal_token");
  sessionStorage.removeItem("asgard_casal_usuario");
  window.location.href = "casal-login.html";
}

function abrirView(nome) {
  document.querySelectorAll(".view").forEach((el) => {
    el.classList.toggle("active", el.id === `view-${nome}`);
  });

  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === nome);
  });

  document.getElementById("sidebar").classList.remove("open");
}

async function carregarTudo() {
  try {
    const dados = await api("/api/casal/painel");

    casamento = dados.casamento;
    presentes = dados.presentes || [];
    pagamentos = dados.pagamentos || [];
    presencas = dados.presencas || [];
    recados = dados.recados || [];

    renderCabecalho();
    renderResumo(dados.resumo || {});
    renderPresentes();
    renderPagamentos();
    renderPresencas();
    renderRecados();

    await carregarMercadoPago();
  } catch (e) {
    console.error(e);
    alert(e.message);
  }
}

function renderCabecalho() {
  const nomes = `${casamento.noivo} & ${casamento.noiva}`;

  document.getElementById("tituloCasal").textContent = nomes;
  document.getElementById("siteCasalTitulo").textContent = nomes;

  if (casamento.data_casamento) {
    const data = new Date(`${String(casamento.data_casamento).slice(0,10)}T12:00:00`);
    document.getElementById("dataCasamento").textContent =
      data.toLocaleDateString("pt-BR", {
        day:"2-digit",
        month:"long",
        year:"numeric"
      });
  }

  const link = `${SITE_BASE}/casamento.html?casamento=${encodeURIComponent(casamento.slug)}`;

  document.getElementById("linkSite").value = link;
  document.getElementById("abrirSite").href = link;
}

function renderResumo(r) {
  document.getElementById("metricPresentes").textContent = Number(r.totalPresentes || 0);
  document.getElementById("metricArrecadado").textContent = moeda(r.arrecadado || 0);
  document.getElementById("metricConfirmados").textContent = Number(r.totalConfirmados || 0);
  document.getElementById("metricRecados").textContent = Number(r.totalRecados || 0);

  const meta = Number(r.valorTotalPresentes || 0);
  const arrecadado = Number(r.arrecadado || 0);
  const percentual = meta > 0 ? Math.min(100, (arrecadado / meta) * 100) : 0;

  document.getElementById("progressoTexto").textContent =
    `${moeda(arrecadado)} de ${moeda(meta)}`;

  document.getElementById("progressoBarra").style.width = `${percentual}%`;
}

function renderPresentes() {
  const container = document.getElementById("listaPresentesPainel");

  if (!presentes.length) {
    container.innerHTML = `<p class="muted">Nenhum presente cadastrado ainda.</p>`;
    return;
  }

  container.innerHTML = presentes.map((p) => `
    <article class="gift-card">
      <div class="gift-image">
        ${p.imagem
          ? `<img src="${escapeAttr(p.imagem)}" alt="${escapeHtml(p.nome)}">`
          : `SEM IMAGEM`}
      </div>

      <div class="gift-content">
        <h3>${escapeHtml(p.nome)}</h3>
        <p>${escapeHtml(p.descricao || "")}</p>

        <div class="gift-value">
          <span>${moeda(p.valor)}</span>
          <strong>${moeda(p.arrecadado || 0)} recebido</strong>
        </div>

        <div class="gift-actions">
          <button data-edit="${p.id}">EDITAR</button>
          <button data-disable="${p.id}">REMOVER</button>
        </div>
      </div>
    </article>
  `).join("");

  container.querySelectorAll("[data-edit]").forEach((b) => {
    b.addEventListener("click", () => {
      const presente = presentes.find(p => String(p.id) === b.dataset.edit);
      abrirModalPresente(presente);
    });
  });

  container.querySelectorAll("[data-disable]").forEach((b) => {
    b.addEventListener("click", () => desativarPresente(b.dataset.disable));
  });
}

function renderPagamentos() {
  const container = document.getElementById("listaPagamentos");

  if (!pagamentos.length) {
    container.innerHTML = `<p class="muted">Nenhum pagamento registrado ainda.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="simple-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Presente</th>
          <th>Valor</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${pagamentos.map((p) => `
          <tr>
            <td>${dataHora(p.criado_em)}</td>
            <td>${escapeHtml(p.presente_nome || "Presente")}</td>
            <td>${moeda(p.valor)}</td>
            <td class="${p.status === "processed" ? "status-ok" : ""}">
              ${escapeHtml(statusPagamento(p))}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderPresencas() {
  const container = document.getElementById("listaPresencas");

  if (!presencas.length) {
    container.innerHTML = `<p class="muted">Nenhuma presença confirmada ainda.</p>`;
    return;
  }

  container.innerHTML = presencas.map((p) => `
    <div class="list-row">
      <div>
        <strong>${escapeHtml(p.nome || "Convidado")}</strong>
        ${p.mensagem ? `<div class="muted">${escapeHtml(p.mensagem)}</div>` : ""}
      </div>
      <strong>${Number(p.quantidade || 0)} pessoa(s)</strong>
    </div>
  `).join("");
}

function renderRecados() {
  const container = document.getElementById("listaRecados");

  if (!recados.length) {
    container.innerHTML = `<p class="muted">Nenhum recado recebido ainda.</p>`;
    return;
  }

  container.innerHTML = recados.map((r) => `
    <article class="message-card">
      <strong>${escapeHtml(r.nome || "Convidado")}</strong>
      <p>${escapeHtml(r.mensagem || "")}</p>
    </article>
  `).join("");
}

async function carregarMercadoPago() {
  try {
    const mp = await api(`/api/casal/mercadopago/status`);

    const conectado = Boolean(mp.conectado);

    document.getElementById("mpStatus").textContent =
      conectado ? "CONECTADO" : "NÃO CONECTADO";

    document.getElementById("mpStatus").classList.toggle("ok", conectado);

    document.getElementById("mpTitulo").textContent =
      conectado ? "Conta conectada" : "Conecte seu Mercado Pago";

    document.getElementById("mpDescricao").textContent =
      conectado
        ? "Os pagamentos do seu casamento estão vinculados à conta conectada."
        : "Conecte sua conta para receber os presentes diretamente.";

    document.getElementById("btnConectarMp").textContent =
      conectado ? "RECONECTAR MERCADO PAGO" : "CONECTAR MERCADO PAGO";

    document.getElementById("mpResumoTitulo").textContent =
      conectado ? "Conectado" : "Não conectado";

    document.getElementById("mpResumoTexto").textContent =
      conectado
        ? "Sua conta está pronta para receber pagamentos."
        : "Conecte sua conta antes de receber presentes.";
  } catch (e) {
    console.error(e);
  }
}

async function conectarMercadoPago() {
  try {
    const dados = await api(
      `/api/casamentos/${encodeURIComponent(casamento.slug)}/mercadopago/conectar-ticket`,
      { method: "POST" }
    );

    window.location.href = dados.url;
  } catch (e) {
    alert(e.message);
  }
}

function abrirModalPresente(presente = null) {
  document.getElementById("modalPresenteTitulo").textContent =
    presente ? "Editar presente" : "Novo presente";

  document.getElementById("presenteId").value = presente?.id || "";
  document.getElementById("presenteNome").value = presente?.nome || "";
  document.getElementById("presenteDescricao").value = presente?.descricao || "";
  document.getElementById("presenteValor").value = presente?.valor || "";
  document.getElementById("presenteImagem").value = presente?.imagem || "";
  document.getElementById("presenteLink").value = presente?.link || "";
  document.getElementById("presenteMensagem").textContent = "";

  document.getElementById("modalPresente").classList.remove("hidden");
}

function fecharModal() {
  document.getElementById("modalPresente").classList.add("hidden");
}

async function salvarPresente(evento) {
  evento.preventDefault();

  const id = document.getElementById("presenteId").value;
  const mensagem = document.getElementById("presenteMensagem");

  const corpo = {
    nome: document.getElementById("presenteNome").value.trim(),
    descricao: document.getElementById("presenteDescricao").value.trim(),
    valor: Number(document.getElementById("presenteValor").value),
    imagem: document.getElementById("presenteImagem").value.trim() || null,
    link: document.getElementById("presenteLink").value.trim() || null
  };

  try {
    mensagem.textContent = "Salvando...";

    await api(
      id ? `/api/casal/presentes/${id}` : "/api/casal/presentes",
      {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(corpo)
      }
    );

    fecharModal();
    await carregarTudo();
  } catch (e) {
    mensagem.textContent = e.message;
    mensagem.className = "error-text";
  }
}

async function desativarPresente(id) {
  if (!confirm("Remover este presente da lista?")) return;

  try {
    await api(`/api/casal/presentes/${id}`, { method: "DELETE" });
    await carregarTudo();
  } catch (e) {
    alert(e.message);
  }
}

async function copiarLink() {
  const input = document.getElementById("linkSite");
  await navigator.clipboard.writeText(input.value);
  const botao = document.getElementById("copiarLink");
  const antigo = botao.textContent;
  botao.textContent = "COPIADO ✓";
  setTimeout(() => botao.textContent = antigo, 1600);
}

function statusPagamento(p) {
  if (p.status === "processed" && p.status_detail === "accredited") {
    return "Pago";
  }
  return p.status_detail || p.status || "Pendente";
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style:"currency",
    currency:"BRL"
  });
}

function dataHora(valor) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("pt-BR");
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function escapeAttr(valor) {
  return escapeHtml(valor);
}

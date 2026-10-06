const API = "https://asgard-wedding-api.onrender.com";
const token =
  sessionStorage.getItem("asgard_admin_token") ||
  localStorage.getItem("asgard_admin_token");

let sites = [];
let dashboard = {};
let selectedTemplate = "template-01";

if (!token) {
  location.href = "admin-login.html";
}

async function api(path, options = {}) {
  const r = await fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const data = await r.json().catch(() => ({}));

  if (r.status === 401 || r.status === 403) {
    sessionStorage.removeItem("asgard_admin_token");
    localStorage.removeItem("asgard_admin_token");
    location.href = "admin-login.html";
    throw new Error("Sessão encerrada.");
  }

  if (!r.ok) {
    throw new Error(data.erro || "Não foi possível concluir a operação.");
  }

  return data;
}

document.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll(".nav").forEach(btn => {
    btn.onclick = () => mudarView(btn.dataset.view);
  });

  document.getElementById("btnNovoRapido").onclick = () => mudarView("novo");
  document.getElementById("btnSair").onclick = sair;
  document.getElementById("busca").oninput = renderSites;
  document.getElementById("filtroStatus").onchange = renderSites;
  document.getElementById("formNovo").onsubmit = criarSite;

  document.querySelectorAll(".template-tab").forEach(btn => {
    btn.onclick = () => selecionarTemplateNovo(btn.dataset.template);
  });

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.onclick = () => fecharModal("modalSite");
  });

  await carregar();
});

function mudarView(view) {
  document.querySelectorAll(".nav").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
  const titulos = {sites:"Sites",historico:"Histórico",novo:"Novo site"};
  document.getElementById("tituloView").textContent = titulos[view] || "ADM";
}

async function carregar() {
  [dashboard, sites] = await Promise.all([
    api("/api/admin/dashboard"),
    api("/api/admin/casamentos")
  ]);
  renderMetricas();
  renderSites();
}

function renderMetricas() {
  const cards = [
    [dashboard.casamentosTotal || 0, "Total"],
    [dashboard.casamentosPublicados || 0, "No ar"],
    [dashboard.casamentosPausados || 0, "Pausados"],
    [dashboard.casamentosConcluidos || 0, "Concluídos"],
    [dashboard.casamentosCancelados || 0, "Cancelados"]
  ];

  document.getElementById("metricas").innerHTML = cards.map(([valor, label]) => `
    <div class="metric"><strong>${valor}</strong><span>${label}</span></div>
  `).join("");
}

function statusLabel(s) {
  return {
    publicado:"No ar",
    rascunho:"Rascunho",
    pausado:"Pausado",
    concluido:"Concluído",
    cancelado:"Cancelado",
    arquivado:"Arquivado"
  }[s] || s;
}

function formatarData(v) {
  if (!v) return "—";
  const d = new Date(String(v).slice(0,10) + "T12:00:00");
  return d.toLocaleDateString("pt-BR");
}

function renderSites() {
  const busca = document.getElementById("busca").value.trim().toLowerCase();
  const filtro = document.getElementById("filtroStatus").value;

  const filtrados = sites.filter(s => {
    const texto = `${s.noivo} ${s.noiva} ${s.slug} ${s.local_nome || ""}`.toLowerCase();
    return (!busca || texto.includes(busca)) && (!filtro || s.status === filtro);
  });

  document.getElementById("listaSites").innerHTML = filtrados.length
    ? filtrados.map(s => `
      <article class="site-card">
        <div class="site-top">
          <div>
            <span class="eyebrow">${s.template?.replace("template-","TEMPLATE ") || "TEMPLATE"}</span>
            <h3>${esc(s.noivo)} & ${esc(s.noiva)}</h3>
            <div class="slug">${esc(s.slug)}</div>
          </div>
          <span class="badge ${esc(s.status)}">${statusLabel(s.status)}</span>
        </div>

        <div class="site-meta">
          <div class="meta"><small>Data</small><strong>${formatarData(s.data_casamento)}</strong></div>
          <div class="meta"><small>Presentes</small><strong>${s.total_presentes || 0}</strong></div>
          <div class="meta"><small>Confirmados</small><strong>${s.total_confirmados || 0}</strong></div>
        </div>

        <div class="site-actions">
          <button class="primary" onclick="abrirSite(${s.id})">Gerenciar</button>
          <button class="ghost" onclick="preverSite(${s.id})">Prévia</button>
          ${s.status === "publicado"
            ? `<button class="secondary" onclick="mudarStatus(${s.id},'pausado')">Pausar</button>`
            : `<button class="secondary" onclick="mudarStatus(${s.id},'publicado')">Colocar no ar</button>`
          }
          <button class="ghost" onclick="verHistorico(${s.id})">Histórico</button>
        </div>
      </article>
    `).join("")
    : `<div class="panel muted">Nenhum site encontrado.</div>`;
}

function selecionarTemplateNovo(template) {
  selectedTemplate = template;
  document.querySelectorAll(".template-tab").forEach(b => b.classList.toggle("active", b.dataset.template === template));
  document.getElementById("templateSelecionadoTexto").textContent =
    `Template ${template.slice(-2)}`;
  document.getElementById("templatePreview").src =
    `admin-template-preview.html?template=${encodeURIComponent(template)}`;
}

async function criarSite(e) {
  e.preventDefault();
  const msg = document.getElementById("novoMsg");
  msg.textContent = "Criando...";

  try {
    const site = await api("/api/admin/casamentos", {
      method:"POST",
      body:JSON.stringify({
        noivo:document.getElementById("novoNoivo").value.trim(),
        noiva:document.getElementById("novoNoiva").value.trim(),
        slug:document.getElementById("novoSlug").value.trim(),
        dataCasamento:document.getElementById("novoData").value,
        horario:document.getElementById("novoHorario").value || null,
        localNome:document.getElementById("novoLocal").value.trim() || null,
        localEndereco:document.getElementById("novoEndereco").value.trim() || null,
        mapaUrl:document.getElementById("novoMapa").value.trim() || null,
        template:selectedTemplate,
        status:"rascunho"
      })
    });

    msg.textContent = "Site criado como rascunho ✓";
    e.target.reset();
    await carregar();
    mudarView("sites");
    abrirSite(site.id);
  } catch (err) {
    msg.textContent = err.message;
  }
}

function sitePorId(id) {
  return sites.find(s => Number(s.id) === Number(id));
}

function previewUrl(site) {
  return `${location.origin}${location.pathname.replace(/admin\.html.*$/,"")}admin-template-preview.html?template=${encodeURIComponent(site.template || "template-01")}&noivo=${encodeURIComponent(site.noivo)}&noiva=${encodeURIComponent(site.noiva)}`;
}

function preverSite(id) {
  const s = sitePorId(id);
  if (!s) return;
  document.getElementById("modalSiteConteudo").innerHTML = `
    <span class="eyebrow">PRÉVIA</span>
    <h2>${esc(s.noivo)} & ${esc(s.noiva)}</h2>
    <div class="iframe-frame"><iframe src="${previewUrl(s)}"></iframe></div>
    <p class="preview-note">Esta prévia não altera o site publicado.</p>
  `;
  abrirModal("modalSite");
}

async function abrirSite(id) {
  const s = sitePorId(id);
  if (!s) return;

  document.getElementById("modalSiteConteudo").innerHTML = `
    <span class="eyebrow">GERENCIAR SITE</span>
    <h2>${esc(s.noivo)} & ${esc(s.noiva)}</h2>
    <p class="muted">Controle template, status e ciclo de vida do site.</p>

    <div class="details-grid">
      <label>Noivo<input id="editNoivo" value="${attr(s.noivo)}"></label>
      <label>Noiva<input id="editNoiva" value="${attr(s.noiva)}"></label>
      <label>Data<input id="editData" type="date" value="${attr(String(s.data_casamento || "").slice(0,10))}"></label>
      <label>Horário<input id="editHora" type="time" value="${attr(String(s.horario || "").slice(0,5))}"></label>
      <label class="full">Local<input id="editLocal" value="${attr(s.local_nome || "")}"></label>
      <label class="full">Endereço<input id="editEndereco" value="${attr(s.local_endereco || "")}"></label>
      <label class="full">Mapa<input id="editMapa" value="${attr(s.mapa_url || "")}"></label>
    </div>

    <h3>Template</h3>
    <div class="template-picker">
      ${["template-01","template-02","template-03","template-04"].map(t => `
        <button type="button" class="template-choice ${t===s.template?"active":""}" data-edit-template="${t}">
          ${t.slice(-2)}
        </button>
      `).join("")}
    </div>

    <div class="iframe-frame" style="margin-top:10px">
      <iframe id="editPreview" src="${previewUrl(s)}"></iframe>
    </div>

    <h3>Ciclo de vida</h3>
    <div class="lifecycle">
      ${["publicado","pausado","concluido","cancelado","arquivado"].map(st => `
        <button type="button" class="life-option ${st===s.status?"active":""}" data-status="${st}">
          ${statusLabel(st)}
        </button>
      `).join("")}
    </div>

    <div class="site-actions">
      <button class="primary" id="btnSalvarSite">Salvar alterações</button>
      <button class="ghost" id="btnHistoricoModal">Ver histórico</button>
      <button class="secondary" id="btnReutilizar">Reutilizar estrutura</button>
    </div>

    <div class="danger-zone">
      <strong>Zona de exclusão</strong>
      <p class="muted">Excluir apaga definitivamente os dados operacionais do casamento. Use somente quando não precisar mais do histórico do site.</p>
      <button class="danger" id="btnExcluirSite">Excluir definitivamente</button>
    </div>
  `;

  let editTemplate = s.template || "template-01";

  document.querySelectorAll("[data-edit-template]").forEach(btn => {
    btn.onclick = () => {
      editTemplate = btn.dataset.editTemplate;
      document.querySelectorAll("[data-edit-template]").forEach(b => b.classList.toggle("active", b===btn));
      document.getElementById("editPreview").src =
        `admin-template-preview.html?template=${encodeURIComponent(editTemplate)}&noivo=${encodeURIComponent(document.getElementById("editNoivo").value)}&noiva=${encodeURIComponent(document.getElementById("editNoiva").value)}`;
    };
  });

  document.querySelectorAll("[data-status]").forEach(btn => {
    btn.onclick = async () => {
      await mudarStatus(id, btn.dataset.status, false);
      fecharModal("modalSite");
    };
  });

  document.getElementById("btnSalvarSite").onclick = async () => {
    await api(`/api/admin/casamentos/${id}`, {
      method:"PUT",
      body:JSON.stringify({
        noivo:document.getElementById("editNoivo").value.trim(),
        noiva:document.getElementById("editNoiva").value.trim(),
        dataCasamento:document.getElementById("editData").value,
        horario:document.getElementById("editHora").value || null,
        localNome:document.getElementById("editLocal").value.trim() || null,
        localEndereco:document.getElementById("editEndereco").value.trim() || null,
        mapaUrl:document.getElementById("editMapa").value.trim() || null,
        template:editTemplate
      })
    });
    await carregar();
    fecharModal("modalSite");
  };

  document.getElementById("btnHistoricoModal").onclick = () => verHistorico(id);
  document.getElementById("btnReutilizar").onclick = () => abrirReutilizar(id);
  document.getElementById("btnExcluirSite").onclick = () => confirmarExclusao(id);

  abrirModal("modalSite");
}

async function mudarStatus(id, status, recarregarModal = true) {
  const site = sitePorId(id);
  const mensagens = {
    publicado:"O site ficará acessível imediatamente.",
    pausado:"O site sairá do ar, mas todos os dados serão preservados.",
    concluido:"O site sairá do ar e ficará registrado como concluído.",
    cancelado:"O site sairá do ar e ficará registrado como cancelado.",
    arquivado:"O site sairá do ar e ficará guardado no histórico."
  };

  if (!confirm(`${statusLabel(status)}?\n\n${mensagens[status] || ""}`)) return;

  await api(`/api/admin/casamentos/${id}/status`, {
    method:"POST",
    body:JSON.stringify({
      status,
      observacao:`Alterado pelo ADM para ${statusLabel(status)}`
    })
  });

  await carregar();
  if (recarregarModal && site) renderSites();
}

async function verHistorico(id) {
  const s = sitePorId(id);
  const h = await api(`/api/admin/casamentos/${id}/historico`);

  document.getElementById("historicoGlobal").innerHTML = `
    <h3>${esc(s?.noivo || "")} & ${esc(s?.noiva || "")}</h3>
    <div class="history">
      ${h.length ? h.map(x => `
        <div class="history-item">
          <strong>${x.status_anterior ? `${statusLabel(x.status_anterior)} → ` : ""}${statusLabel(x.status_novo)}</strong>
          <small>${new Date(x.criado_em).toLocaleString("pt-BR")}</small>
          ${x.observacao ? `<small>${esc(x.observacao)}</small>` : ""}
        </div>
      `).join("") : `<div class="muted">Sem movimentações registradas.</div>`}
    </div>
  `;
  fecharModal("modalSite");
  mudarView("historico");
}

function abrirReutilizar(id) {
  const s = sitePorId(id);
  document.getElementById("modalConfirmacaoConteudo").innerHTML = `
    <span class="eyebrow">REUTILIZAR ESTRUTURA</span>
    <h2>Transformar este slot em um novo casamento</h2>
    <p class="muted">Os presentes, pagamentos, presenças, recados, galeria, música, conexão Mercado Pago e acesso antigo do casal serão apagados. O histórico de status permanecerá.</p>

    <div class="details-grid">
      <label>Noivo<input id="reuseNoivo"></label>
      <label>Noiva<input id="reuseNoiva"></label>
      <label class="full">Novo slug<input id="reuseSlug"></label>
      <label>Data<input id="reuseData" type="date"></label>
      <label>Horário<input id="reuseHora" type="time"></label>
    </div>

    <div class="site-actions" style="margin-top:18px">
      <button class="danger" id="reuseConfirm">Reutilizar agora</button>
      <button class="ghost" onclick="fecharModal('modalConfirmacao')">Cancelar</button>
    </div>
  `;

  document.getElementById("reuseConfirm").onclick = async () => {
    if (!confirm("Esta ação limpa os dados do casamento anterior. Continuar?")) return;

    await api(`/api/admin/casamentos/${id}/reutilizar`, {
      method:"POST",
      body:JSON.stringify({
        noivo:document.getElementById("reuseNoivo").value.trim(),
        noiva:document.getElementById("reuseNoiva").value.trim(),
        slug:document.getElementById("reuseSlug").value.trim(),
        dataCasamento:document.getElementById("reuseData").value,
        horario:document.getElementById("reuseHora").value || null,
        template:s.template || "template-01"
      })
    });

    fecharModal("modalConfirmacao");
    fecharModal("modalSite");
    await carregar();
  };

  abrirModal("modalConfirmacao");
}

function confirmarExclusao(id) {
  const s = sitePorId(id);
  document.getElementById("modalConfirmacaoConteudo").innerHTML = `
    <span class="eyebrow">EXCLUSÃO DEFINITIVA</span>
    <h2>Excluir ${esc(s.noivo)} & ${esc(s.noiva)}?</h2>
    <p>Isso remove o casamento e seus dados operacionais. O registro da exclusão permanece no histórico técnico.</p>
    <p><strong>Digite EXCLUIR para confirmar:</strong></p>
    <input id="confirmDeleteText" style="width:100%;min-height:44px;border:1px solid #ddd;border-radius:9px;padding:0 12px">
    <div class="site-actions" style="margin-top:16px">
      <button class="danger" id="confirmDeleteBtn">Excluir definitivamente</button>
      <button class="ghost" onclick="fecharModal('modalConfirmacao')">Cancelar</button>
    </div>
  `;

  document.getElementById("confirmDeleteBtn").onclick = async () => {
    if (document.getElementById("confirmDeleteText").value !== "EXCLUIR") {
      alert("Digite EXCLUIR exatamente.");
      return;
    }
    await api(`/api/admin/casamentos/${id}`, {method:"DELETE"});
    fecharModal("modalConfirmacao");
    fecharModal("modalSite");
    await carregar();
  };

  abrirModal("modalConfirmacao");
}

function abrirModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

function fecharModal(id) {
  document.getElementById(id).classList.add("hidden");
}

function sair() {
  sessionStorage.removeItem("asgard_admin_token");
  sessionStorage.removeItem("asgard_admin_usuario");
  localStorage.removeItem("asgard_admin_token");
  localStorage.removeItem("asgard_admin_usuario");
  location.href = "admin-login.html";
}

function esc(v) {
  return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function attr(v) { return esc(v); }

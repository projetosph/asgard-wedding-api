const ASGARD_API = "https://asgard-wedding-api.onrender.com";
const SITE_BASE = "https://projetosph.github.io/asgard-wedding-api/";

const token = sessionStorage.getItem("asgard_admin_token");
const usuario = JSON.parse(
  sessionStorage.getItem("asgard_admin_usuario") || "null"
);

if (!token || !usuario || usuario.perfil !== "admin") {
  window.location.replace("admin-login.html");
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("usuarioNome").textContent =
    usuario?.nome || "Administrador";

  document.getElementById("btnSair").addEventListener("click", sair);

  document.querySelectorAll(".nav-item").forEach((botao) => {
    botao.addEventListener("click", () => abrirView(botao.dataset.view));
  });

  document
    .getElementById("btnNovoCasamento")
    .addEventListener("click", () => abrirView("novo"));

  document
    .getElementById("formNovoCasamento")
    .addEventListener("submit", criarCasamento);

  document
    .getElementById("modalFechar")
    .addEventListener("click", fecharModal);

  await Promise.all([
    carregarDashboard(),
    carregarCasamentos()
  ]);
});

function headersJson() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

async function api(caminho, opcoes = {}) {
  const resposta = await fetch(`${ASGARD_API}${caminho}`, {
    ...opcoes,
    headers: {
      ...headersJson(),
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
    throw new Error(dados.erro || "Erro na operação.");
  }

  return dados;
}

function sair() {
  sessionStorage.removeItem("asgard_admin_token");
  sessionStorage.removeItem("asgard_admin_usuario");
  window.location.href = "admin-login.html";
}

function abrirView(nome) {
  document.querySelectorAll(".view").forEach((el) => {
    el.classList.toggle("active", el.id === `view-${nome}`);
  });

  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === nome);
  });

  const titulos = {
    dashboard: "Dashboard",
    casamentos: "Casamentos",
    novo: "Novo casamento"
  };

  document.getElementById("tituloPagina").textContent =
    titulos[nome] || "Asgard Wedding";
}

async function carregarDashboard() {
  try {
    const d = await api("/api/admin/dashboard");

    document.getElementById("mCasamentos").textContent =
      d.casamentosTotal ?? 0;

    document.getElementById("mPublicados").textContent =
      d.casamentosPublicados ?? 0;

    document.getElementById("mMp").textContent =
      d.mercadoPagoConectados ?? 0;

    document.getElementById("mConfirmados").textContent =
      d.convidadosConfirmados ?? 0;

    document.getElementById("mArrecadado").textContent =
      Number(d.arrecadadoTotal || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });

  } catch (e) {
    console.error(e);
  }
}

async function carregarCasamentos() {
  const lista = document.getElementById("listaCasamentos");

  lista.innerHTML = `<p class="muted">Carregando...</p>`;

  try {
    const casamentos = await api("/api/admin/casamentos");

    if (!casamentos.length) {
      lista.innerHTML = `<p class="muted">Nenhum casamento cadastrado.</p>`;
      return;
    }

    lista.innerHTML = casamentos
      .map((c) => cardCasamento(c))
      .join("");

    document.querySelectorAll("[data-gerenciar]").forEach((botao) => {
      botao.addEventListener("click", () => {
        const casamento = casamentos.find(
          (c) => String(c.id) === botao.dataset.gerenciar
        );

        if (casamento) abrirCasamento(casamento);
      });
    });

  } catch (e) {
    lista.innerHTML = `<p class="erro">${escaparHtml(e.message)}</p>`;
  }
}

function cardCasamento(c) {
  const data = c.data_casamento
    ? new Date(`${String(c.data_casamento).slice(0, 10)}T12:00:00`)
        .toLocaleDateString("pt-BR")
    : "Sem data";

  return `
    <article class="wedding-card">
      <div>
        <div class="wedding-title">
          ${escaparHtml(c.noivo)} & ${escaparHtml(c.noiva)}
        </div>

        <div class="wedding-meta">
          ${data} · ${escaparHtml(c.local_nome || "Local não informado")}
        </div>

        <div class="badges">
          <span class="badge">${escaparHtml(c.status || "—")}</span>

          <span class="badge ${c.mercadopago_conectado ? "ok" : "warn"}">
            Mercado Pago:
            ${c.mercadopago_conectado ? "conectado" : "não conectado"}
          </span>

          <span class="badge">
            ${Number(c.total_presentes || 0)} presentes
          </span>

          <span class="badge">
            ${Number(c.total_confirmados || 0)} confirmados
          </span>
        </div>
      </div>

      <button data-gerenciar="${c.id}">
        GERENCIAR
      </button>
    </article>
  `;
}

function abrirCasamento(c) {
  document.getElementById("modalTitulo").textContent =
    `${c.noivo} & ${c.noiva}`;

  const site =
    `${SITE_BASE}?casamento=${encodeURIComponent(c.slug)}`;

  const conectar =
    `${ASGARD_API}/api/casamentos/${encodeURIComponent(c.slug)}/mercadopago/conectar`;

  document.getElementById("modalConteudo").innerHTML = `
    <div class="detail-grid">
      <div>
        <small>Slug</small>
        <strong>${escaparHtml(c.slug)}</strong>
      </div>

      <div>
        <small>Template</small>
        <strong>${escaparHtml(c.template || "template-01")}</strong>
      </div>

      <div>
        <small>Presentes</small>
        <strong>${Number(c.total_presentes || 0)}</strong>
      </div>

      <div>
        <small>Confirmados</small>
        <strong>${Number(c.total_confirmados || 0)}</strong>
      </div>
    </div>

    <div class="modal-actions">
      <a class="button-link" href="${site}" target="_blank">
        ABRIR SITE
      </a>

      <a class="button-link secondary" href="${conectar}" target="_blank">
        ${c.mercadopago_conectado ? "RECONECTAR MERCADO PAGO" : "CONECTAR MERCADO PAGO"}
      </a>
    </div>

    <hr>

    <h3>Criar / redefinir acesso do casal</h3>

    <form id="formUsuarioCasal" class="form-grid">
      <div class="span-2">
        <label>Nome do usuário</label>
        <input id="usuarioCasalNome" placeholder="${escaparHtml(c.noivo)} e ${escaparHtml(c.noiva)}" required>
      </div>

      <div>
        <label>E-mail</label>
        <input id="usuarioCasalEmail" type="email" required>
      </div>

      <div>
        <label>Senha temporária</label>
        <input id="usuarioCasalSenha" type="password" minlength="8" required>
      </div>

      <div class="span-2">
        <button type="submit">CRIAR ACESSO DO CASAL</button>
        <p id="usuarioCasalMsg"></p>
      </div>
    </form>
  `;

  document
    .getElementById("formUsuarioCasal")
    .addEventListener("submit", (evento) =>
      criarUsuarioCasal(evento, c.id)
    );

  document.getElementById("modalCasamento").classList.remove("hidden");
}

function fecharModal() {
  document.getElementById("modalCasamento").classList.add("hidden");
}

async function criarUsuarioCasal(evento, casamentoId) {
  evento.preventDefault();

  const msg = document.getElementById("usuarioCasalMsg");
  msg.textContent = "Salvando...";

  try {
    await api(
      `/api/admin/casamentos/${casamentoId}/usuario-casal`,
      {
        method: "POST",
        body: JSON.stringify({
          nome: document.getElementById("usuarioCasalNome").value.trim(),
          email: document.getElementById("usuarioCasalEmail").value.trim(),
          senha: document.getElementById("usuarioCasalSenha").value
        })
      }
    );

    msg.textContent = "Acesso do casal criado com sucesso.";
    msg.className = "sucesso";

  } catch (e) {
    msg.textContent = e.message;
    msg.className = "erro";
  }
}

async function criarCasamento(evento) {
  evento.preventDefault();

  const msg = document.getElementById("novoMensagem");
  msg.textContent = "Criando...";

  try {
    const criado = await api("/api/admin/casamentos", {
      method: "POST",
      body: JSON.stringify({
        noivo: document.getElementById("novoNoivo").value.trim(),
        noiva: document.getElementById("novoNoiva").value.trim(),
        slug: document.getElementById("novoSlug").value.trim(),
        dataCasamento: document.getElementById("novoData").value,
        horario: document.getElementById("novoHorario").value || null,
        template: document.getElementById("novoTemplate").value,
        localNome: document.getElementById("novoLocalNome").value.trim() || null,
        localEndereco: document.getElementById("novoLocalEndereco").value.trim() || null,
        status: document.getElementById("novoStatus").value
      })
    });

    msg.textContent =
      `Casamento ${criado.noivo} & ${criado.noiva} criado com sucesso.`;

    msg.className = "sucesso";

    evento.target.reset();

    await Promise.all([
      carregarDashboard(),
      carregarCasamentos()
    ]);

  } catch (e) {
    msg.textContent = e.message;
    msg.className = "erro";
  }
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

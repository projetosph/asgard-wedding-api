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
let galeria = [];
let musica = null;
let filtroPresentes = "";
let presenteArrastadoId = null;

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

  document.getElementById("pesquisaPresente").addEventListener("input", (evento) => {
    filtroPresentes = evento.target.value.trim().toLocaleLowerCase("pt-BR");
    renderPresentes();
  });

  document.getElementById("btnBaixarPdfPresencas").addEventListener("click", baixarPdfPresencas);
  document.getElementById("formGaleria").addEventListener("submit", adicionarFotoGaleria);
  document.getElementById("formMusica").addEventListener("submit", salvarMusica);
  document.getElementById("btnRemoverMusica").addEventListener("click", removerMusica);

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
    galeria = dados.galeria || [];
    musica = dados.musica || null;

    renderCabecalho();
    renderResumo(dados.resumo || {});
    renderPresentes();
    renderPagamentos();
    renderPresencas();
    renderRecados();
    renderGaleria();
    renderMusica();

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

function presenteQuitado(p) {
  const valor = Number(p.valor || 0);
  const arrecadado = Number(p.arrecadado || 0);
  return Boolean(p.comprado) || (valor > 0 && arrecadado >= valor);
}

function renderPresentes() {
  const container = document.getElementById("listaPresentesPainel");

  if (!presentes.length) {
    container.innerHTML = `<p class="muted">Nenhum presente cadastrado ainda.</p>`;
    return;
  }

  const ativos = presentes.filter((p) => !presenteQuitado(p));
  const posicaoAtiva = new Map(
    ativos.map((p, index) => [String(p.id), index])
  );

  const listaVisivel = presentes.filter((p) => {
    if (!filtroPresentes) return true;
    const texto = `${p.nome || ""} ${p.descricao || ""}`.toLocaleLowerCase("pt-BR");
    return texto.includes(filtroPresentes);
  });

  if (!listaVisivel.length) {
    container.innerHTML = `<p class="muted">Nenhum presente encontrado para essa pesquisa.</p>`;
    return;
  }

  container.innerHTML = listaVisivel.map((p) => {
    const quitado = presenteQuitado(p);
    const posicao = posicaoAtiva.get(String(p.id));
    const podeSubir = !quitado && posicao > 0;
    const podeDescer = !quitado && posicao < ativos.length - 1;

    return `
      <article
        class="gift-card ${quitado ? "gift-card-complete" : ""}"
        data-gift-card="${p.id}"
        draggable="${!quitado}">
        <div class="gift-image">
          ${p.imagem
            ? `<img src="${escapeAttr(p.imagem)}" alt="${escapeHtml(p.nome)}">`
            : `SEM IMAGEM`}
        </div>

        <div class="gift-content">
          <div class="gift-title-row">
            <div>
              <h3>${escapeHtml(p.nome)}</h3>
              ${quitado ? `<span class="gift-complete-pill">PRESENTEADO</span>` : ""}
            </div>

            ${!quitado ? `
              <div class="gift-order-actions" aria-label="Alterar posição">
                <button type="button" data-move-up="${p.id}" title="Mover para cima" ${podeSubir ? "" : "disabled"}>↑</button>
                <button type="button" data-move-down="${p.id}" title="Mover para baixo" ${podeDescer ? "" : "disabled"}>↓</button>
              </div>
            ` : ""}
          </div>

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
    `;
  }).join("");

  container.querySelectorAll("[data-edit]").forEach((b) => {
    b.addEventListener("click", () => {
      const presente = presentes.find(p => String(p.id) === b.dataset.edit);
      abrirModalPresente(presente);
    });
  });

  container.querySelectorAll("[data-disable]").forEach((b) => {
    b.addEventListener("click", () => desativarPresente(b.dataset.disable));
  });

  container.querySelectorAll("[data-move-up]").forEach((b) => {
    b.addEventListener("click", () => moverPresente(b.dataset.moveUp, -1));
  });

  container.querySelectorAll("[data-move-down]").forEach((b) => {
    b.addEventListener("click", () => moverPresente(b.dataset.moveDown, 1));
  });

  container.querySelectorAll("[data-gift-card][draggable='true']").forEach((card) => {
    card.addEventListener("dragstart", () => {
      presenteArrastadoId = card.dataset.giftCard;
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      presenteArrastadoId = null;
      card.classList.remove("dragging");
      container.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
    });

    card.addEventListener("dragover", (evento) => {
      if (!presenteArrastadoId || presenteArrastadoId === card.dataset.giftCard) return;
      evento.preventDefault();
      card.classList.add("drag-over");
    });

    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));

    card.addEventListener("drop", async (evento) => {
      evento.preventDefault();
      card.classList.remove("drag-over");
      await moverPresentePara(presenteArrastadoId, card.dataset.giftCard);
    });
  });
}

async function moverPresentePara(origemId, destinoId) {
  if (!origemId || !destinoId || String(origemId) === String(destinoId)) return;

  const ativos = presentes.filter((p) => !presenteQuitado(p));
  const origem = ativos.findIndex((p) => String(p.id) === String(origemId));
  const destino = ativos.findIndex((p) => String(p.id) === String(destinoId));

  if (origem < 0 || destino < 0) return;

  const [movido] = ativos.splice(origem, 1);
  ativos.splice(destino, 0, movido);

  try {
    await api("/api/casal/presentes/ordem", {
      method: "PUT",
      body: JSON.stringify({ ids: ativos.map((p) => Number(p.id)) })
    });
    await carregarTudo();
  } catch (e) {
    alert(e.message);
  }
}

async function moverPresente(id, direcao) {
  const ativos = presentes.filter((p) => !presenteQuitado(p));
  const indice = ativos.findIndex((p) => String(p.id) === String(id));
  const destino = indice + direcao;

  if (indice < 0 || destino < 0 || destino >= ativos.length) return;

  [ativos[indice], ativos[destino]] = [ativos[destino], ativos[indice]];

  try {
    await api("/api/casal/presentes/ordem", {
      method: "PUT",
      body: JSON.stringify({
        ids: ativos.map((p) => Number(p.id))
      })
    });

    await carregarTudo();
  } catch (e) {
    alert(e.message);
  }
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
          <th>Quem presenteou</th>
          <th>E-mail</th>
          <th>Presente</th>
          <th>Forma</th>
          <th>Valor</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${pagamentos.map((p) => `
          <tr>
            <td>${dataHora(p.criado_em)}</td>
            <td>${escapeHtml(p.pagador_nome || "—")}</td>
            <td>${escapeHtml(p.pagador_email || "—")}</td>
            <td>${escapeHtml(p.presente_nome || "Presente")}</td>
            <td>${escapeHtml(metodoPagamento(p.metodo_pagamento))}</td>
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
  const total = presencas.reduce((soma, p) => soma + Number(p.quantidade || 0), 0);
  document.getElementById("totalConfirmadosView").textContent = total;

  if (!presencas.length) {
    container.innerHTML = `<p class="muted">Nenhuma presença confirmada ainda.</p>`;
    return;
  }

  container.innerHTML = presencas.map((p) => `
    <div class="list-row presence-row">
      <div>
        <strong>${escapeHtml(
          Array.isArray(p.nomes)
            ? p.nomes.join(", ")
            : p.nomes || "Convidado"
        )}</strong>
        ${p.mensagem ? `<div class="muted">${escapeHtml(p.mensagem)}</div>` : ""}
      </div>
      <div class="presence-actions">
        <strong>${Number(p.quantidade || 0)} pessoa(s)</strong>
        <button type="button" class="icon-danger-btn" data-delete-presenca="${p.id}" title="Excluir confirmação" aria-label="Excluir confirmação">×</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("[data-delete-presenca]").forEach((botao) => {
    botao.addEventListener("click", () => excluirPresenca(botao.dataset.deletePresenca));
  });
}

async function excluirPresenca(id) {
  if (!confirm("Excluir esta confirmação de presença?")) return;

  try {
    await api(`/api/casal/presencas/${id}`, { method: "DELETE" });
    await carregarTudo();
  } catch (e) {
    alert(e.message);
  }
}

function nomesConfirmadosOrdenados() {
  const nomes = [];

  presencas.forEach((p) => {
    const lista = Array.isArray(p.nomes)
      ? p.nomes
      : (p.nomes ? [p.nomes] : []);

    lista.forEach((nome) => {
      const limpo = String(nome || "").trim();
      if (limpo) nomes.push(limpo);
    });
  });

  return nomes.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

function baixarPdfPresencas() {
  const nomes = nomesConfirmadosOrdenados();

  if (!nomes.length) {
    alert("Ainda não há convidados confirmados para gerar o PDF.");
    return;
  }

  if (!window.jspdf?.jsPDF) {
    alert("Não foi possível carregar o gerador de PDF. Verifique sua conexão e tente novamente.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margemX = 20;
  const inicioY = 30;
  const limiteY = altura - 24;

  const nomesCasal = `${casamento?.noivo || ""} & ${casamento?.noiva || ""}`.trim();

  function cabecalho() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(nomesCasal || "Lista de convidados", largura / 2, 18, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Lista de convidados confirmados", largura / 2, 24, { align: "center" });
    doc.setDrawColor(210);
    doc.line(margemX, 27, largura - margemX, 27);
  }

  cabecalho();
  let y = inicioY + 5;
  doc.setFontSize(11);

  nomes.forEach((nome, index) => {
    if (y > limiteY) {
      doc.addPage();
      cabecalho();
      y = inicioY + 5;
    }

    doc.text(`${index + 1}. ${nome}`, margemX, y);
    y += 7;
  });

  const totalPaginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    doc.setDrawColor(220);
    doc.line(margemX, altura - 17, largura - margemX, altura - 17);
    doc.setFontSize(8.5);
    doc.setTextColor(95);
    doc.text("Asgard Wedding · por Asgard Tech", margemX, altura - 11);
    doc.text(`Página ${pagina} de ${totalPaginas}`, largura - margemX, altura - 11, { align: "right" });
    doc.setTextColor(0);
  }

  const arquivo = (nomesCasal || "convidados")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  doc.save(`lista-confirmados-${arquivo || "casamento"}.pdf`);
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

function renderGaleria() {
  const container = document.getElementById("listaGaleriaPainel");

  if (!galeria.length) {
    container.innerHTML = `<p class="muted">Nenhuma foto cadastrada ainda.</p>`;
    return;
  }

  container.innerHTML = galeria.map((foto, index) => `
    <article class="gallery-admin-card">
      <img src="${escapeAttr(foto.imagem_url)}" alt="${escapeAttr(foto.legenda || "Foto da galeria")}">
      <div class="gallery-admin-info">
        <p>${escapeHtml(foto.legenda || "Sem legenda")}</p>
        <div class="gallery-admin-actions">
          <button type="button" data-gallery-up="${foto.id}" ${index === 0 ? "disabled" : ""}>↑</button>
          <button type="button" data-gallery-down="${foto.id}" ${index === galeria.length - 1 ? "disabled" : ""}>↓</button>
          <button type="button" class="danger-text-btn" data-gallery-delete="${foto.id}">REMOVER</button>
        </div>
      </div>
    </article>
  `).join("");

  container.querySelectorAll("[data-gallery-up]").forEach((b) => {
    b.addEventListener("click", () => moverFotoGaleria(b.dataset.galleryUp, -1));
  });
  container.querySelectorAll("[data-gallery-down]").forEach((b) => {
    b.addEventListener("click", () => moverFotoGaleria(b.dataset.galleryDown, 1));
  });
  container.querySelectorAll("[data-gallery-delete]").forEach((b) => {
    b.addEventListener("click", () => excluirFotoGaleria(b.dataset.galleryDelete));
  });
}

async function adicionarFotoGaleria(evento) {
  evento.preventDefault();
  const mensagem = document.getElementById("galeriaMensagem");
  const imagemUrl = document.getElementById("galeriaImagemUrl").value.trim();
  const legenda = document.getElementById("galeriaLegenda").value.trim();

  try {
    mensagem.textContent = "Salvando...";
    await api("/api/casal/galeria", {
      method: "POST",
      body: JSON.stringify({ imagemUrl, legenda })
    });
    document.getElementById("formGaleria").reset();
    mensagem.textContent = "Foto adicionada.";
    await carregarTudo();
  } catch (e) {
    mensagem.textContent = e.message;
    mensagem.className = "error-text";
  }
}

async function moverFotoGaleria(id, direcao) {
  const lista = [...galeria];
  const indice = lista.findIndex((f) => String(f.id) === String(id));
  const destino = indice + direcao;
  if (indice < 0 || destino < 0 || destino >= lista.length) return;

  [lista[indice], lista[destino]] = [lista[destino], lista[indice]];

  try {
    await api("/api/casal/galeria/ordem", {
      method: "PUT",
      body: JSON.stringify({ ids: lista.map((f) => Number(f.id)) })
    });
    await carregarTudo();
  } catch (e) {
    alert(e.message);
  }
}

async function excluirFotoGaleria(id) {
  if (!confirm("Remover esta foto da galeria?")) return;
  try {
    await api(`/api/casal/galeria/${id}`, { method: "DELETE" });
    await carregarTudo();
  } catch (e) {
    alert(e.message);
  }
}

function renderMusica() {
  document.getElementById("musicaTitulo").value = musica?.titulo || "";
  document.getElementById("musicaUrl").value = musica?.url || "";
}

async function salvarMusica(evento) {
  evento.preventDefault();
  const mensagem = document.getElementById("musicaMensagem");
  const titulo = document.getElementById("musicaTitulo").value.trim();
  const url = document.getElementById("musicaUrl").value.trim();

  if (!url) {
    mensagem.textContent = "Informe a URL da música ou use Remover.";
    mensagem.className = "error-text";
    return;
  }

  try {
    mensagem.textContent = "Salvando...";
    const dados = await api("/api/casal/musica", {
      method: "PUT",
      body: JSON.stringify({ titulo, url })
    });
    musica = dados;
    mensagem.textContent = "Música salva.";
    mensagem.className = "";
  } catch (e) {
    mensagem.textContent = e.message;
    mensagem.className = "error-text";
  }
}

async function removerMusica() {
  if (!musica?.url && !document.getElementById("musicaUrl").value.trim()) return;
  if (!confirm("Remover a música cadastrada?")) return;

  try {
    await api("/api/casal/musica", {
      method: "PUT",
      body: JSON.stringify({ titulo: "", url: "" })
    });
    musica = null;
    renderMusica();
    document.getElementById("musicaMensagem").textContent = "Música removida.";
  } catch (e) {
    alert(e.message);
  }
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

function metodoPagamento(valor) {
  const metodo = String(valor || "").toLowerCase();

  if (metodo === "pix") return "PIX";
  if (metodo === "cartao" || metodo === "card" || metodo === "credit_card") {
    return "Cartão";
  }

  return valor || "—";
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

document.addEventListener("DOMContentLoaded", async () => {
  const casamento = await t2InicializarPagina("presenca");

  document.getElementById("iconeData").innerHTML = t2Icone("presente");
  document.getElementById("iconeLocal").innerHTML = t2Icone("local");
  document.getElementById("iconeHora").innerHTML =
    `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;

  if (casamento) {
    t2Texto(
      "detalheHorario",
      casamento.horario
        ? `Às ${String(casamento.horario).slice(0,5).replace(":", "h")}`
        : ""
    );
    t2Texto(
      "detalheLocal",
      casamento.local_nome || casamento.local || ""
    );
  }

  const quantidade = document.getElementById("quantidadePresenca");
  quantidade.addEventListener("input", criarCampos);
  quantidade.addEventListener("change", criarCampos);

  document.getElementById("formPresenca").addEventListener("submit", enviarPresenca);
});

function criarCampos() {
  const quantidade =
    Number(document.getElementById("quantidadePresenca").value) || 0;

  const container = document.getElementById("listaNomesConvidados");
  container.innerHTML = "";

  for (let i = 2; i <= quantidade; i++) {
    container.insertAdjacentHTML(
      "beforeend",
      `
      <div class="t2-field">
        <label>Convidado ${i}</label>
        <input class="nomeConvidado" required placeholder="Nome e sobrenome">
      </div>
      `
    );
  }
}

async function enviarPresenca(event) {
  event.preventDefault();

  const botao = document.getElementById("btnConfirmarPresenca");
  const status = document.getElementById("statusPresenca");
  const titular = document.getElementById("nomePresenca").value.trim();

  const nomes = [
    titular,
    ...[...document.querySelectorAll(".nomeConvidado")]
      .map((input) => input.value.trim())
  ];

  const mensagem =
    document.getElementById("mensagemPresenca").value.trim();

  botao.disabled = true;
  status.textContent = "Enviando...";

  try {
    const resposta = await fetch(
      `${T2_API}/api/casamentos/${encodeURIComponent(t2Slug())}/presencas`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: titular,
          nomes,
          quantidade: nomes.length,
          mensagem
        })
      }
    );

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(dados.erro || "Não foi possível confirmar a presença.");
    }

    event.target.reset();
    document.getElementById("listaNomesConvidados").innerHTML = "";
    status.textContent = "Presença confirmada com sucesso ♡";
  } catch (erro) {
    status.textContent = erro.message;
  } finally {
    botao.disabled = false;
  }
}

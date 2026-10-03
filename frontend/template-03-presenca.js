
document.addEventListener("DOMContentLoaded", async () => {
  t3ConfigurarVolta();

  const casamento = await t3CarregarCasamento();
  if (casamento) t3AtualizarMonograma(casamento);

  const quantidade = document.getElementById("quantidadePresenca");

  quantidade.addEventListener("input", criarCampos);
  quantidade.addEventListener("change", criarCampos);

  document.getElementById("formPresenca")
    .addEventListener("submit", enviarPresenca);
});

function criarCampos() {
  const quantidade = Number(
    document.getElementById("quantidadePresenca").value
  ) || 0;

  const container = document.getElementById("listaNomesConvidados");
  container.innerHTML = "";

  for (let i = 2; i <= quantidade; i++) {
    container.insertAdjacentHTML(
      "beforeend",
      `
        <div class="field">
          <label>Convidado ${i}</label>
          <input class="nomeConvidado" required>
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
      .map(input => input.value.trim())
  ];

  const mensagem =
    document.getElementById("mensagemPresenca").value.trim();

  botao.disabled = true;
  status.textContent = "Enviando...";

  try {
    const resposta = await fetch(
      `${T3_API}/api/casamentos/${encodeURIComponent(t3Slug())}/presencas`,
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
      throw new Error(
        dados.erro || "Não foi possível confirmar a presença."
      );
    }

    event.target.reset();
    document.getElementById("listaNomesConvidados").innerHTML = "";
    status.textContent = "Presença confirmada com sucesso ♥";

  } catch (erro) {
    status.textContent = erro.message;
  } finally {
    botao.disabled = false;
  }
}

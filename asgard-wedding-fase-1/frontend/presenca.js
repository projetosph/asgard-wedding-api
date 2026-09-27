function criarCamposConvidados() {
  const quantidade = Number(document.getElementById("quantidadePresenca")?.value);
  const container = document.getElementById("listaNomesConvidados");
  if (!container) return;

  container.innerHTML = "";
  if (!quantidade || quantidade <= 1) return;

  for (let i = 2; i <= quantidade; i++) {
    container.insertAdjacentHTML("beforeend", `
      <input type="text"
             class="inputNome nomeConvidado"
             placeholder="Nome e sobrenome do convidado ${i}"
             required>
    `);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const quantidadeInput = document.getElementById("quantidadePresenca");
  const botao = document.getElementById("btnConfirmarPresenca");

  quantidadeInput?.addEventListener("input", criarCamposConvidados);
  quantidadeInput?.addEventListener("change", criarCamposConvidados);
  botao?.addEventListener("click", confirmarPresenca);
});

async function confirmarPresenca(event) {
  event?.preventDefault();

  const titularInput = document.getElementById("nomePresenca");
  const quantidadeInput = document.getElementById("quantidadePresenca");
  const mensagemInput = document.getElementById("mensagemPresenca");

  const titular = titularInput?.value.trim() || "";
  const quantidade = Number(quantidadeInput?.value) || 0;
  const mensagem = mensagemInput?.value.trim() || "";

  if (!titular || quantidade < 1) {
    alert("Informe nome e quantidade de pessoas.");
    return;
  }

  const nomes = [titular];
  for (const input of document.querySelectorAll(".nomeConvidado")) {
    const nome = input.value.trim();
    if (!nome) {
      alert("Preencha o nome de todos os convidados.");
      return;
    }
    nomes.push(nome);
  }

  if (nomes.length !== quantidade) {
    alert("A quantidade de nomes não confere.");
    return;
  }

  const resposta = await fetch(
    `${ASGARD_API}/api/casamentos/${encodeURIComponent(CASAMENTO_SLUG)}/presencas`,
    {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        nome: titular,
        nomes,
        quantidade,
        mensagem
      })
    }
  );

  const dados = await resposta.json();

  if (!resposta.ok) {
    alert(dados.erro || "Não foi possível confirmar a presença.");
    return;
  }

  alert("Presença confirmada com sucesso!");
  titularInput.value = "";
  quantidadeInput.value = "";
  if (mensagemInput) mensagemInput.value = "";
  document.getElementById("listaNomesConvidados").innerHTML = "";
}
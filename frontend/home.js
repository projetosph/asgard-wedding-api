document.addEventListener("DOMContentLoaded", prepararFormularioRecado);

document.addEventListener("asgard:casamento-carregado", event => {
  iniciarContador(event.detail);
});

function iniciarContador(casamento) {
  const contador = document.getElementById("contador");
  if (!contador) return;

  const destino = dataHoraCasamento(casamento);
  if (!destino) return;

  function atualizar() {
    const diferenca = destino.getTime() - Date.now();

    if (diferenca <= 0) {
      contador.textContent = "CHEGOU O GRANDE DIA";
      return;
    }

    const dias = Math.floor(diferenca / 86400000);
    const horas = Math.floor((diferenca % 86400000) / 3600000);
    const minutos = Math.floor((diferenca % 3600000) / 60000);

    contador.textContent = `${dias} DIAS | ${horas} HORAS | ${minutos} MIN`;
  }

  atualizar();
  window.setInterval(atualizar, 60000);
}

function prepararFormularioRecado() {
  const nome = document.getElementById("nomeRecado");
  const mensagem = document.getElementById("mensagemRecado");
  const botao = document.getElementById("btnEnviarRecado");

  if (!nome || !mensagem || !botao) return;

  botao.addEventListener("click", enviarRecado);

  nome.addEventListener("keydown", evento => {
    if (evento.key === "Enter") {
      evento.preventDefault();
      mensagem.focus();
    }
  });

  mensagem.addEventListener("keydown", evento => {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      enviarRecado();
    }
  });
}

async function enviarRecado() {
  const campoNome = document.getElementById("nomeRecado");
  const campoMensagem = document.getElementById("mensagemRecado");
  const botao = document.getElementById("btnEnviarRecado");

  const nome = campoNome?.value.trim() || "";
  const mensagem = campoMensagem?.value.trim() || "";

  if (!nome || !mensagem) {
    alert("Digite seu nome e a mensagem.");
    return;
  }

  if (botao) {
    botao.disabled = true;
    botao.textContent = "ENVIANDO...";
  }

  try {
    const resposta = await fetch(
      `${ASGARD_API}/api/casamentos/${encodeURIComponent(CASAMENTO_SLUG)}/recados`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, mensagem })
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Não foi possível enviar o recado.");
    }

    campoNome.value = "";
    campoMensagem.value = "";
    campoNome.focus();

    if (typeof mostrarFeedback === "function") {
      mostrarFeedback("Sua mensagem foi enviada!");
    } else {
      alert("Sua mensagem foi enviada!");
    }
  } catch (erro) {
    console.error(erro);
    alert(erro.message);
  } finally {
    if (botao) {
      botao.disabled = false;
      botao.textContent = "ENVIAR";
    }
  }
}
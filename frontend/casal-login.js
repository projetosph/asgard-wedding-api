const API = "https://asgard-wedding-api.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  const token = sessionStorage.getItem("asgard_casal_token");
  if (token) {
    window.location.href = "casal.html";
    return;
  }

  document.getElementById("loginForm").addEventListener("submit", entrar);
});

async function entrar(evento) {
  evento.preventDefault();

  const erro = document.getElementById("loginErro");
  erro.textContent = "";

  try {
    const resposta = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        email: document.getElementById("email").value.trim(),
        senha: document.getElementById("senha").value
      })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Não foi possível entrar.");
    }

    if (dados.usuario?.perfil !== "casal") {
      throw new Error("Este acesso não pertence a um casal.");
    }

    sessionStorage.setItem("asgard_casal_token", dados.token);
    sessionStorage.setItem("asgard_casal_usuario", JSON.stringify(dados.usuario));

    window.location.href = "casal.html";
  } catch (e) {
    erro.textContent = e.message;
  }
}

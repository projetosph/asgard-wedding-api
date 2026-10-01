const ASGARD_API = "https://asgard-wedding-api.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  const token = sessionStorage.getItem("asgard_admin_token");

  if (token) {
    window.location.href = "admin.html";
    return;
  }

  document
    .getElementById("loginForm")
    ?.addEventListener("submit", login);
});

async function login(evento) {
  evento.preventDefault();

  const erro = document.getElementById("loginErro");
  erro.textContent = "";

  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value;

  try {
    const resposta = await fetch(`${ASGARD_API}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, senha })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Não foi possível entrar.");
    }

    if (dados.usuario?.perfil !== "admin") {
      throw new Error("Este acesso não é de administrador.");
    }

    sessionStorage.setItem("asgard_admin_token", dados.token);
    sessionStorage.setItem(
      "asgard_admin_usuario",
      JSON.stringify(dados.usuario)
    );

    window.location.href = "admin.html";

  } catch (e) {
    erro.textContent = e.message;
  }
}

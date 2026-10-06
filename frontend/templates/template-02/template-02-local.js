document.addEventListener("DOMContentLoaded", async () => {
  const casamento = await t2InicializarPagina("local");
  document.getElementById("localIcone").innerHTML = t2Icone("local");

  if (!casamento) return;

  const nome = casamento.local_nome || casamento.local || "";
  const endereco =
    casamento.local_endereco ||
    casamento.endereco ||
    nome;

  t2Texto("localNome", nome);
  t2Texto("localEndereco", casamento.local_endereco || casamento.endereco || "");

  const mapaLink =
    casamento.mapa_url ||
    casamento.link_mapa ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;

  document.getElementById("mapaLink").href = mapaLink;
  document.getElementById("mapaFrame").src =
    `https://www.google.com/maps?q=${encodeURIComponent(endereco)}&output=embed`;
});

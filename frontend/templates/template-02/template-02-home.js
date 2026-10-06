document.addEventListener("DOMContentLoaded", async () => {
  await t2InicializarPagina("inicio");

  const casamento = await t2CarregarCasamento();
  if (casamento) {
    t2Texto("t2Noivo", casamento.noivo || casamento.nome_noivo || "");
    t2Texto("t2Noiva", casamento.noiva || casamento.nome_noiva || "");
  }

  const cards = [
    ["cardPresentes", "presente", "template-02-presentes.html"],
    ["cardPresenca", "presenca", "template-02-presenca.html"],
    ["cardLocal", "local", "template-02-local.html"],
    ["cardRecados", "recado", "template-02-recados.html"],
    ["cardGaleria", "galeria", "template-02-galeria.html"],
    ["cardMusica", "musica", "template-02-musica.html"]
  ];

  cards.forEach(([id, icone, pagina]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.href = t2Link(pagina);
    const mount = el.querySelector(".t2-home-icon");
    mount.innerHTML = t2Icone(icone);
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  const w = await t1Init("local");
  if (!w) return;

  const name = w.local_nome || "—";
  const address = w.local_endereco || w.endereco || name;

  document.getElementById("localName").textContent = name;
  document.getElementById("localAddress").textContent =
    w.local_endereco || w.endereco || "—";

  document.getElementById("localMap").src =
    `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;

  document.getElementById("localMapLink").href =
    w.mapa_url || w.link_mapa || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
});

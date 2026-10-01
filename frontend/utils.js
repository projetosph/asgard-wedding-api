function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function mostrarFeedback(texto) {
  const div = document.createElement("div");
  div.innerText = texto;
  div.style.position = "fixed";
  div.style.bottom = "20px";
  div.style.left = "50%";
  div.style.transform = "translateX(-50%)";
  div.style.background = "#2f3e3a";
  div.style.color = "white";
  div.style.padding = "12px 20px";
  div.style.borderRadius = "8px";
  div.style.fontSize = "13px";
  div.style.zIndex = "9999";
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}
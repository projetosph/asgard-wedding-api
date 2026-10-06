document.addEventListener("DOMContentLoaded", async () => {
  const w = await t1Init("rsvp");

  if (w) {
    document.getElementById("rsvpHour").textContent =
      w.horario ? `Às ${t1Hour(w.horario)}` : "—";
    document.getElementById("rsvpPlace").textContent =
      w.local_nome || "—";
  }

  const qty = document.getElementById("rsvpQty");
  qty.addEventListener("input", renderExtra);
  qty.addEventListener("change", renderExtra);
  document.getElementById("rsvpForm").addEventListener("submit", sendRsvp);
});

function renderExtra() {
  const n = Number(document.getElementById("rsvpQty").value) || 0;
  const box = document.getElementById("rsvpExtra");
  box.innerHTML = "";

  for (let i=2;i<=n;i++) {
    box.insertAdjacentHTML("beforeend", `
      <div class="t1-field">
        <label>Convidado ${i}</label>
        <input class="rsvpGuest" required>
      </div>
    `);
  }
}

async function sendRsvp(e) {
  e.preventDefault();

  const status = document.getElementById("rsvpStatus");
  const titular = document.getElementById("rsvpName").value.trim();
  const nomes = [
    titular,
    ...[...document.querySelectorAll(".rsvpGuest")].map(i => i.value.trim())
  ];
  const mensagem = document.getElementById("rsvpMsg").value.trim();

  status.textContent = "Enviando...";

  try {
    const r = await fetch(
      `${T1_API}/api/casamentos/${encodeURIComponent(t1Slug())}/presencas`,
      {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          nome:titular,
          nomes,
          quantidade:nomes.length,
          mensagem
        })
      }
    );
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || "Não foi possível confirmar.");
    e.target.reset();
    document.getElementById("rsvpExtra").innerHTML = "";
    status.textContent = "Presença confirmada com sucesso ♡";
  } catch (err) {
    status.textContent = err.message;
  }
}

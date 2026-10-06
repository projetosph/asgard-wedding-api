
document.addEventListener("DOMContentLoaded",async()=>{const page=document.body.dataset.page||"home";const c=await init(page);if(page==="home")home(c);if(page==="gifts")gifts();if(page==="rsvp")rsvp(c);if(page==="local")local(c);if(page==="messages")messages();if(page==="gallery")gallery();if(page==="music")music()});

function home(c){[["q1","gift","template-04-presentes.html"],["q2","rsvp","template-04-presenca.html"],["q3","pin","template-04-local.html"],["q4","msg","template-04-recados.html"],["q5","photo","template-04-galeria.html"],["q6","music","template-04-musica.html"]].forEach(([id,ic,p])=>{const e=document.getElementById(id);e.href=link(p);e.querySelector("i").innerHTML=icon(ic)});if(!c)return;const d=new Date(`${String(c.data_casamento).slice(0,10)}T${String(c.horario||"15:30").slice(0,5)}:00`);function tick(){let x=d-Date.now();if(x<0)x=0;document.getElementById("days").textContent=Math.floor(x/86400000);document.getElementById("hours").textContent=String(Math.floor(x%86400000/3600000)).padStart(2,"0");document.getElementById("mins").textContent=String(Math.floor(x%3600000/60000)).padStart(2,"0")}tick();setInterval(tick,60000)}

async function gifts() {
  const box =
    document.getElementById("giftList");

  try {
    const r = await fetch(
      `${API}/api/casamentos/${encodeURIComponent(slug())}/presentes`,
      { cache: "no-store" }
    );

    const dados = await r.json();

    if (!r.ok) {
      throw new Error(
        dados.erro ||
        "Erro ao carregar presentes."
      );
    }

    const presentes =
      Array.isArray(dados)
        ? dados
        : [];

    if (!presentes.length) {
      box.innerHTML =
        `<div class="card pad">A lista ainda está sendo preparada.</div>`;
      return;
    }

    box.innerHTML =
      presentes.map((p, index) => {
        const livre =
          p.tipo ===
          "contribuicao_livre";

        const valor =
          Number(p.valor || 0);

        const arrecadado =
          Number(p.arrecadado || 0);

        const restante =
          Math.max(
            valor - arrecadado,
            0
          );

        const quitado =
          !livre &&
          (
            Boolean(p.comprado) ||
            (
              valor > 0 &&
              restante <= 0
            )
          );

        return `
          <article class="gift ${livre ? "free-gift" : ""}">
            <div class="giftImg">
              ${
                p.imagem
                  ? `<img src="${esc(p.imagem)}" alt="${esc(p.nome || "Presente")}">`
                  : "SEM IMAGEM"
              }
            </div>

            <div class="giftBody">
              <h3>${esc(p.nome || "Presente")}</h3>
              <p>${esc(p.descricao || "")}</p>

              <strong>
                ${
                  livre
                    ? "VOCÊ ESCOLHE O VALOR"
                    : (
                        quitado
                          ? "PRESENTEADO ♡"
                          : money(restante || valor)
                      )
                }
              </strong>

              <div class="actions">
                ${
                  !livre && p.link
                    ? `<a class="btn soft" target="_blank" rel="noopener noreferrer" href="${esc(p.link)}">Ver produto</a>`
                    : `<span class="btn soft">${livre ? "VALOR LIVRE" : "SEM LINK"}</span>`
                }

                ${
                  quitado
                    ? ""
                    : `<button class="btn dark" data-i="${index}">${livre ? "Contribuir" : "Presentear"}</button>`
                }
              </div>
            </div>
          </article>
        `;
      }).join("");

    box.querySelectorAll("[data-i]").forEach((b) => {
      b.onclick = () => {
        const index =
          Number(b.dataset.i);

        localStorage.setItem(
          "produtoCheckout",
          JSON.stringify({
            ...presentes[index],
            index
          })
        );

        location.href =
          link(
            "template-04-checkout.html"
          );
      };
    });

  } catch (erro) {
    console.error(erro);

    box.innerHTML =
      `<div class="card pad">Não foi possível carregar a lista.</div>`;
  }
}

function rsvp(c){if(c){document.getElementById("place").textContent=c.local_nome||"—";document.getElementById("when").textContent=c.horario?`Às ${hourBR(c.horario)}`:"—"}const q=document.getElementById("qty");q.oninput=q.onchange=()=>{const n=+q.value||0,names=document.getElementById("extra");names.innerHTML="";for(let i=2;i<=n;i++)names.insertAdjacentHTML("beforeend",`<label>Convidado ${i}<input class="guest" required></label>`)};document.getElementById("rsvpForm").onsubmit=async e=>{e.preventDefault();const s=document.getElementById("rsvpStatus"),name=document.getElementById("name").value.trim(),names=[name,...[...document.querySelectorAll(".guest")].map(x=>x.value.trim())],message=document.getElementById("rsvpMsg").value.trim();s.textContent="Enviando...";try{const r=await fetch(`${API}/api/casamentos/${encodeURIComponent(slug())}/presencas`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nome:name,nomes:names,quantidade:names.length,mensagem:message})});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.erro||"Erro");e.target.reset();document.getElementById("extra").innerHTML="";s.textContent="Presença confirmada ♡"}catch(err){s.textContent=err.message}}}

function local(c){if(!c)return;const name=c.local_nome||"",address=c.local_endereco||name,url=c.mapa_url||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;document.getElementById("placeName").textContent=name||"—";document.getElementById("address").textContent=c.local_endereco||"—";document.getElementById("map").src=`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;document.getElementById("mapLink").href=url}

async function messages(){const list=document.getElementById("msgList");async function load(){try{const r=await fetch(`${API}/api/casamentos/${encodeURIComponent(slug())}/recados`,{cache:"no-store"}),a=await r.json();list.innerHTML=(Array.isArray(a)&&a.length)?a.slice(0,30).map(x=>`<article class="card msg"><strong>${esc(x.nome)}</strong><p>${esc(x.mensagem)}</p></article>`).join(""):`<div class="card pad">Seja o primeiro a deixar um recado ♡</div>`}catch{list.innerHTML=`<div class="card pad">Não foi possível carregar os recados.</div>`}}await load();document.getElementById("msgForm").onsubmit=async e=>{e.preventDefault();const st=document.getElementById("msgStatus"),nome=document.getElementById("msgName").value.trim(),mensagem=document.getElementById("msgText").value.trim();st.textContent="Enviando...";try{const r=await fetch(`${API}/api/casamentos/${encodeURIComponent(slug())}/recados`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nome,mensagem})});if(!r.ok)throw 0;e.target.reset();st.textContent="Recado enviado ♡";load()}catch{st.textContent="Não foi possível enviar."}}}

async function gallery(){const box=document.getElementById("gallery");try{const r=await fetch(`${API}/api/casamentos/${encodeURIComponent(slug())}/galeria`,{cache:"no-store"}),a=await r.json();box.innerHTML=(Array.isArray(a)&&a.length)?a.map(f=>`<figure><img src="${esc(f.imagem_url)}" alt="${esc(f.legenda||"Foto do casal")}"></figure>`).join(""):`<div class="card pad">As fotos serão adicionadas em breve.</div>`}catch{box.innerHTML=`<div class="card pad">Não foi possível carregar a galeria.</div>`}}

async function music(){const p=document.getElementById("player");try{const r=await fetch(`${API}/api/casamentos/${encodeURIComponent(slug())}/musica`,{cache:"no-store"}),m=await r.json();if(!m?.url){p.innerHTML="<p>A música ainda não foi cadastrada.</p>";return}document.getElementById("song").textContent=m.titulo||"Nossa música";const u=String(m.url),direct=/\.(mp3|ogg|wav|m4a)(\?|#|$)/i.test(u);p.innerHTML=direct?`<audio controls preload="none"><source src="${esc(u)}"></audio>`:`<a class="btn dark" target="_blank" href="${esc(u)}">Ouvir música ↗</a>`}catch{p.innerHTML="<p>Não foi possível carregar a música.</p>"}}

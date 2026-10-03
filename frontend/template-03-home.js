document.addEventListener("DOMContentLoaded", async () => {
  const slug = t3Slug();

  ["linkPresentes","linkPresentesTop"].forEach(id => {
    const el=document.getElementById(id); if(el) el.href=t3Query("template-03-presentes.html");
  });
  ["linkPresenca","linkPresencaTop"].forEach(id => {
    const el=document.getElementById(id); if(el) el.href=t3Query("template-03-presenca.html");
  });
  const gal=document.getElementById("linkGaleriaTop"); if(gal) gal.href=t3Query("template-03-galeria.html");

  const c = await t3CarregarCasamento();

  if (c) {
    t3Set("noivo", c.noivo || c.nome_noivo);
    t3Set("noiva", c.noiva || c.nome_noiva);

    const data=t3Data(c.data_casamento);
    if(data){
      t3Set("data", data.toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"}));
      iniciarContador(data, c.horario);
    }

    t3Set("localNome", c.local_nome || c.local);
    t3Set("localEndereco", c.local_endereco || c.endereco);

    const endereco=c.local_endereco || c.endereco || c.local_nome || "";
    document.getElementById("mapa").href =
      c.mapa_url || c.link_mapa ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
  }

  configurarRecado();
  configurarMusica();
});

function iniciarContador(data, horario) {
  const [h,m]=String(horario || "15:30").slice(0,5).split(":").map(Number);
  data.setHours(h||15, Number.isFinite(m)?m:30,0,0);

  const atualizar=()=>{
    const dif=data-Date.now();
    if(dif<=0){t3Set("dias","0");t3Set("horas","0");t3Set("minutos","0");return;}
    t3Set("dias",String(Math.floor(dif/86400000)));
    t3Set("horas",String(Math.floor((dif%86400000)/3600000)).padStart(2,"0"));
    t3Set("minutos",String(Math.floor((dif%3600000)/60000)).padStart(2,"0"));
  };
  atualizar(); setInterval(atualizar,60000);
}

function configurarRecado(){
  const form=document.getElementById("recadoForm");
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const status=document.getElementById("recadoStatus");
    status.textContent="Enviando...";
    const nome=document.getElementById("nomeRecado").value.trim();
    const mensagem=document.getElementById("mensagemRecado").value.trim();
    try{
      const r=await fetch(`${T3_API}/api/casamentos/${encodeURIComponent(t3Slug())}/recados`,{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nome,mensagem})
      });
      if(!r.ok) throw new Error();
      form.reset(); status.textContent="Enviado ♥";
    }catch{status.textContent="Não foi possível enviar agora.";}
  });
}

function configurarMusica(){
  const btn=document.getElementById("musicBtn"), audio=document.getElementById("audio");
  btn.addEventListener("click",async()=>{
    if(!audio.src){alert("A música ainda não foi configurada.");return;}
    if(audio.paused){await audio.play();btn.textContent="❚❚ Pausar";}
    else{audio.pause();btn.textContent="♪ Música";}
  });
}

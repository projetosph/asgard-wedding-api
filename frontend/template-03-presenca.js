document.addEventListener("DOMContentLoaded",()=>{
 t3TopoVoltar(); document.getElementById("voltarCasamento2").href=t3Query("template-03.html");
 const q=document.getElementById("quantidadePresenca"); q.addEventListener("input",campos); q.addEventListener("change",campos);
 document.getElementById("formPresenca").addEventListener("submit",enviar);
});
function campos(){
 const qtd=Number(document.getElementById("quantidadePresenca").value)||0,c=document.getElementById("listaNomesConvidados"); c.innerHTML="";
 for(let i=2;i<=qtd;i++) c.insertAdjacentHTML("beforeend",`<div class="field"><label>Convidado ${i}</label><input class="nomeConvidado" required></div>`);
}
async function enviar(e){
 e.preventDefault(); const btn=document.getElementById("btnConfirmarPresenca"),st=document.getElementById("statusPresenca");
 const titular=document.getElementById("nomePresenca").value.trim(), nomes=[titular,...[...document.querySelectorAll(".nomeConvidado")].map(i=>i.value.trim())], mensagem=document.getElementById("mensagemPresenca").value.trim();
 btn.disabled=true;st.textContent="Enviando...";
 try{
  const r=await fetch(`${T3_API}/api/casamentos/${encodeURIComponent(t3Slug())}/presencas`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nome:titular,nomes,quantidade:nomes.length,mensagem})});
  const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.erro||"Não foi possível confirmar.");
  e.target.reset();document.getElementById("listaNomesConvidados").innerHTML="";st.textContent="Presença confirmada com sucesso ♥";
 }catch(err){st.textContent=err.message}finally{btn.disabled=false}
}

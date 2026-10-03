document.addEventListener("DOMContentLoaded",()=>{
  t3TopoVoltar();
  const v=document.getElementById("voltarCasamento2"); if(v) v.href=t3Query("template-03.html");
  carregar();
});
async function carregar(){
  const c=document.getElementById("listaPresentes");
  try{
    const r=await fetch(`${T3_API}/api/casamentos/${encodeURIComponent(t3Slug())}/presentes`,{cache:"no-store"});
    const dados=await r.json();
    if(!r.ok) throw new Error(dados.erro||"Erro");
    const lista=Array.isArray(dados)?dados:(dados.presentes||[]);
    if(!lista.length){c.innerHTML='<p class="loading-value">Nenhum presente cadastrado ainda.</p>';return;}
    c.innerHTML=lista.map((p,i)=>{
      const valor=Number(p.valor||0), arrec=Number(p.arrecadado||0), restante=Math.max(valor-arrec,0);
      return `<article class="cardPresente">
        ${p.imagem?`<img src="${esc(p.imagem)}" alt="${esc(p.nome||"Presente")}">`:`<div class="cardPresenteSemImagem">SEM IMAGEM</div>`}
        <h3>${esc(p.nome||"Presente")}</h3>
        <p class="descricaoPresente">${esc(p.descricao||"")}</p>
        <p class="valorAtual">${moeda(restante||valor)}</p>
        ${p.link?`<a class="btnVerProduto" target="_blank" rel="noopener" href="${esc(p.link)}">VER PRODUTO ↗</a>`:""}
        <button type="button" data-i="${i}">PRESENTEAR</button>
      </article>`;
    }).join("");
    c.querySelectorAll("button[data-i]").forEach(b=>b.addEventListener("click",()=>{
      const p=lista[Number(b.dataset.i)];
      localStorage.setItem("produtoCheckout",JSON.stringify({...p,index:Number(b.dataset.i)}));
      location.href=t3Query("template-03-checkout.html");
    }));
  }catch(e){console.error(e);c.innerHTML='<p class="loading-value">Não foi possível carregar a lista agora.</p>';}
}
function moeda(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}

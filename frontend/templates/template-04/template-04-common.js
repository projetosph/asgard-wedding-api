
const API="https://asgard-wedding-api.onrender.com";
const DEFAULT_COVER="https://storage.alboom.ninja/sites/4564/albuns/713676/pre-wedding-campo-alegre-ck.419.jpg?t=1600800043";
const SOCIAL={whatsapp:"https://wa.me/5575999207455",instagram:"https://www.instagram.com/asgardtec",facebook:"https://www.facebook.com/share/19WMXVyN5B/"};

function slug(){return new URLSearchParams(location.search).get("casamento")||""}
function link(p){return `${p}${slug()?`?casamento=${encodeURIComponent(slug())}`:""}`}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function dateBR(v){if(!v)return"—";const[a,m,d]=String(v).slice(0,10).split("-").map(Number);return new Date(a,m-1,d,12).toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"})}
function hourBR(v){return v?String(v).slice(0,5).replace(":","h"):"—"}
function icon(n){const x={
gift:`<svg viewBox="0 0 24 24"><path d="M4 10h16v11H4zM3 7h18v3H3zM12 7v14M12 7H8.5A2.5 2.5 0 1 1 12 3.5V7Zm0 0h3.5A2.5 2.5 0 1 0 12 3.5V7Z"/></svg>`,
rsvp:`<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 9h16M9 14l2 2 4-4"/></svg>`,
pin:`<svg viewBox="0 0 24 24"><path d="M12 22s7-6 7-13a7 7 0 1 0-14 0c0 7 7 13 7 13Z"/><circle cx="12" cy="9" r="2"/></svg>`,
msg:`<svg viewBox="0 0 24 24"><path d="M21 11a8.5 8.5 0 0 1-11.5 8L4 21l2-5.2A8.5 8.5 0 1 1 21 11Z"/></svg>`,
photo:`<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="1.4"/><path d="m5 18 5-5 3 3 2-2 4 4"/></svg>`,
music:`<svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12M9 9l10-2"/><circle cx="6.5" cy="18.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>`};return x[n]||""}
function header(active=""){const nav=[["home","Início","template-04.html"],["gifts","Presentes","template-04-presentes.html"],["rsvp","RSVP","template-04-presenca.html"],["local","Local","template-04-local.html"],["messages","Recados","template-04-recados.html"],["gallery","Galeria","template-04-galeria.html"],["music","Músicas","template-04-musica.html"]];return `<header class="header"><a class="logo" href="${link("template-04.html")}"><b data-mono>— & —</b><small>save the date</small></a><button class="menu" id="menu">☰</button><nav id="nav">${nav.map(([k,l,p])=>`<a class="${k===active?"active":""}" href="${link(p)}">${l}</a>`).join("")}</nav><a class="rsvpTop" href="${link("template-04-presenca.html")}">Confirmar presença</a></header>`}
function footer(){return `<footer><div><strong>Asgard Wedding</strong> · por Asgard Tech</div><div class="social"><a href="${SOCIAL.whatsapp}" target="_blank">WhatsApp</a><a href="${SOCIAL.instagram}" target="_blank">Instagram</a><a href="${SOCIAL.facebook}" target="_blank">Facebook</a></div></footer>`}
async function wedding(){if(!slug())return null;try{const r=await fetch(`${API}/api/casamentos/${encodeURIComponent(slug())}`,{cache:"no-store"});if(!r.ok)throw 0;const j=await r.json();const c=j.casamento||j;apply(c);return c}catch(e){console.error(e);return null}}
function apply(c){const a=c?.noivo||"",b=c?.noiva||"";document.querySelectorAll("[data-couple]").forEach(e=>e.textContent=a&&b?`${a} & ${b}`:"—");document.querySelectorAll("[data-date]").forEach(e=>e.textContent=dateBR(c?.data_casamento));document.querySelectorAll("[data-time]").forEach(e=>e.textContent=c?.horario?`Às ${hourBR(c.horario)}`:"—");document.querySelectorAll("[data-mono]").forEach(e=>e.textContent=`${a?.[0]?.toUpperCase()||"—"} & ${b?.[0]?.toUpperCase()||"—"}`);const f=c?.foto_capa||c?.foto_home||c?.foto_principal||DEFAULT_COVER;document.documentElement.style.setProperty("--cover",`url("${String(f).replaceAll('"','\\"')}")`)}
async function init(active){document.getElementById("hdr").innerHTML=header(active);document.getElementById("ftr").innerHTML=footer();document.getElementById("menu")?.addEventListener("click",()=>document.getElementById("nav").classList.toggle("open"));return wedding()}

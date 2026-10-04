
const T3_API = "https://asgard-wedding-api.onrender.com";
const T3_DEFAULT_HERO_IMAGE = "https://storage.alboom.ninja/sites/4564/albuns/713676/pre-wedding-campo-alegre-ck.419.jpg?t=1600800043";

function t3Slug(){
  return new URLSearchParams(window.location.search).get("casamento") || "";
}
function t3Link(page){
  const slug = t3Slug();
  return `${page}${slug ? `?casamento=${encodeURIComponent(slug)}` : ""}`;
}
async function t3CarregarCasamento(){
  const slug = t3Slug();
  if(!slug) return null;
  try{
    const r = await fetch(`${T3_API}/api/casamentos/${encodeURIComponent(slug)}`, {cache:"no-store"});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return data.casamento || data;
  }catch(err){
    console.error('Erro ao carregar casamento:', err);
    return null;
  }
}
function t3Texto(id, valor, fallback="—"){
  const el = document.getElementById(id);
  if(el) el.textContent = valor || fallback;
}
function t3Data(valor){
  if(!valor) return null;
  const [ano, mes, dia] = String(valor).slice(0,10).split('-').map(Number);
  if(![ano,mes,dia].every(Number.isFinite)) return null;
  return new Date(ano, mes-1, dia, 12, 0, 0);
}
function t3FormatarData(valor){
  const data = t3Data(valor);
  if(!data) return '—';
  return data.toLocaleDateString('pt-BR', {day:'2-digit', month:'long', year:'numeric'});
}
function t3FormatarHorario(valor){
  if(!valor) return '—';
  return String(valor).slice(0,5).replace(':','h');
}
function t3AtualizarMonograma(casamento){
  const noivo = casamento?.noivo || casamento?.nome_noivo || '';
  const noiva = casamento?.noiva || casamento?.nome_noiva || '';
  const letra1 = noivo ? noivo.trim().charAt(0).toUpperCase() : '—';
  const letra2 = noiva ? noiva.trim().charAt(0).toUpperCase() : '—';
  const valor = `${letra1} & ${letra2}`;
  document.querySelectorAll('[data-couple-monogram]').forEach(el => el.textContent = valor);
}
function t3ConfigurarVolta(){
  document.querySelectorAll('[data-home-link]').forEach(el => el.href = t3Link('template-03.html'));
}
function t3Footer(){
  return `
  <footer class="t3-footer">
    <div class="footer-brand">
      <span>Feito para celebrar histórias.</span>
      <span><strong>ASGARD WEDDING</strong> · por Asgard Tech</span>
    </div>
    <div class="footer-social">
      <a href="https://wa.me/5575999207455" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">WA</a>
      <a href="https://www.instagram.com/asgardtec?stkn=MXA4dHZtNnd3aTI1Mg%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer" aria-label="Instagram">IG</a>
      <a href="https://www.facebook.com/share/19WMXVyN5B/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="Facebook">FB</a>
    </div>
  </footer>`;
}

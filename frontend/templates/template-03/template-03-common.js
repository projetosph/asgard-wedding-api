
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
      <a
        href="https://wa.me/5575999207455"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp"
        title="WhatsApp">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2a9.86 9.86 0 0 0-8.46 14.93L2 22l5.2-1.49A9.99 9.99 0 1 0 12 2Zm0 17.98a8 8 0 0 1-4.08-1.1l-.29-.17-3.08.88.91-3-.19-.31A8 8 0 1 1 12 19.98Zm4.39-5.99c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.93-1.19-.71-.64-1.2-1.42-1.34-1.66-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.09 3.62.57.25 1.02.39 1.37.5.58.18 1.1.16 1.51.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/>
        </svg>
      </a>

      <a
        href="https://www.instagram.com/asgardtec?stkn=MXA4dHZtNnd3aTI1Mg%3D%3D&utm_source=qr"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
        title="Instagram">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.25-3.1a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z"/>
        </svg>
      </a>

      <a
        href="https://www.facebook.com/share/19WMXVyN5B/?mibextid=wwXIfr"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Facebook"
        title="Facebook">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.25c-1.24 0-1.62.77-1.62 1.55V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12Z"/>
        </svg>
      </a>
    </div>
  </footer>`;
}


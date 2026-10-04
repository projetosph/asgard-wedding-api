
document.addEventListener('DOMContentLoaded', async () => {
  t3ConfigurarVolta();
  document.getElementById('footerMount').innerHTML = t3Footer();

  document.getElementById('linkPresentes').href = t3Link('template-03-presentes.html');
  document.getElementById('navPresentes').href = t3Link('template-03-presentes.html');
  document.getElementById('linkPresenca').href = t3Link('template-03-presenca.html');
  document.getElementById('navPresenca').href = t3Link('template-03-presenca.html');
  document.getElementById('linkGaleria').href = t3Link('template-03-galeria.html');
  document.getElementById('navGaleria').href = t3Link('template-03-galeria.html');

  const casamento = await t3CarregarCasamento();
  if(casamento){
    t3AtualizarMonograma(casamento);
    const noivo = casamento.noivo || casamento.nome_noivo || '';
    const noiva = casamento.noiva || casamento.nome_noiva || '';
    t3Texto('noivo', noivo);
    t3Texto('noiva', noiva);
    const dataFormatada = t3FormatarData(casamento.data_casamento);
    const horario = t3FormatarHorario(casamento.horario);
    t3Texto('dataHorario', dataFormatada !== '—' ? `${dataFormatada}${horario !== '—' ? ` · ${horario}` : ''}` : '—');
    t3Texto('localNome', casamento.local_nome || casamento.local || '');
    t3Texto('localEndereco', casamento.local_endereco || casamento.endereco || '');
    const endereco = casamento.local_endereco || casamento.endereco || casamento.local_nome || '';
    document.getElementById('mapaLink').href = casamento.mapa_url || casamento.link_mapa || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
    const hero = document.getElementById('heroPhoto');
    hero.src = casamento.foto_capa || casamento.foto_home || casamento.foto_principal || T3_DEFAULT_HERO_IMAGE;
    hero.alt = `Pré-wedding de ${noivo || '—'} e ${noiva || '—'}`;
    iniciarContador(casamento.data_casamento, casamento.horario);
  }
  configurarRecado();
  configurarMusica();
});

function iniciarContador(dataValor, horarioValor){
  const data = t3Data(dataValor);
  if(!data) return;
  const [hora, minuto] = String(horarioValor || '15:30').slice(0,5).split(':').map(Number);
  data.setHours(Number.isFinite(hora)?hora:15, Number.isFinite(minuto)?minuto:30, 0, 0);
  function atualizar(){
    const diff = data.getTime() - Date.now();
    if(diff <= 0){ t3Texto('dias','0'); t3Texto('horas','00'); t3Texto('minutos','00'); return; }
    t3Texto('dias', String(Math.floor(diff/86400000)));
    t3Texto('horas', String(Math.floor((diff%86400000)/3600000)).padStart(2,'0'));
    t3Texto('minutos', String(Math.floor((diff%3600000)/60000)).padStart(2,'0'));
  }
  atualizar(); setInterval(atualizar, 60000);
}

function configurarRecado(){
  const form = document.getElementById('recadoForm');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('recadoStatus');
    const nome = document.getElementById('nomeRecado').value.trim();
    const mensagem = document.getElementById('mensagemRecado').value.trim();
    status.textContent = 'Enviando...';
    try{
      const resposta = await fetch(`${T3_API}/api/casamentos/${encodeURIComponent(t3Slug())}/recados`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({nome, mensagem})
      });
      if(!resposta.ok) throw new Error();
      form.reset(); status.textContent = 'Recado enviado ♥';
    }catch{
      status.textContent = 'Não foi possível enviar agora.';
    }
  });
}

function configurarMusica(){
  const botao = document.getElementById('musicBtn');
  const audio = document.getElementById('audioCasamento');
  botao.addEventListener('click', async () => {
    if(!audio.src && !audio.querySelector('source')){
      alert('A música deste casamento ainda não foi configurada.');
      return;
    }
    if(audio.paused){
      try{ await audio.play(); botao.textContent = '❚❚ Pausar'; }
      catch{ alert('Não foi possível iniciar a música.'); }
    }else{ audio.pause(); botao.textContent = '♪ Música'; }
  });
}

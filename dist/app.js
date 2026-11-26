import { BALANCE_URL, RESERVOIR_URL, REGIONS, selectBalance, validateBalance, normalizeReservoirs, freshness, getJSON, number, sourcePower, dateTime, civilDate } from './data.js';
import { initMap } from './mapa.js';
import { initHistorical, initPlans } from './graficos.js';
import { initOperation } from './operacao.js';
import { loadMadrid, renderMadrid } from './madrid.js';
import { editorialCase, normalizeText } from './texto.js';
import { initFullscreen } from './tela-cheia.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[s]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
let rawBalance, reservoirs, editorial, currentRegion = 'brasil', balanceMode = 'loading', reservoirMode = 'loading', refreshing = false, lastReservoirQuery = 0;
let currentChapter = 'introducao', slideIndex = 0, previousFocus;
let madrid = [];
let reservoirShapes;
const refreshInterval = 60000;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const map = initMap(selectRegion);
const operation = initOperation();
initFullscreen($('#reservoir-fullscreen'));
getJSON('./data/mapa/medidores-ear.json').then(value => {
  reservoirShapes = value;
  renderReservoirs();
}).catch(() => {
  reservoirShapes = {};
  renderReservoirs();
});
function renderBalance() {
  if (!rawBalance) return;
  const state = balanceMode === 'live' && freshness(rawBalance.Data).stale ? 'stale' : balanceMode;
  const data = selectBalance(rawBalance, currentRegion);
  $('#generation-value').textContent = number(data.total / 1000);
  $('#load-value').textContent = number(data.load / 1000);
  $('#load-scope').textContent = data.name;
  $('#generation-scope').textContent = `Potência instantânea · ${data.name}`;
  $('#source-list').innerHTML = data.sources.map(source => {
    const { value, unit } = sourcePower(source.mw);
    return `<div class="source-row" title="${esc(source.name)}: ${number(source.mw, 2)} MW; ${number(source.share, 2)}% da geração"><span class="source-dot" style="background:${source.color}"></span><span class="source-name">${esc(source.name)}</span><span class="source-value">${value} <small>${unit}</small></span></div>`;
  }).join('');
  $('#mix-strip').innerHTML = data.sources.filter(s => s.mw > 0).map(s => `<span style="width:${s.barShare}%;background:${s.gradient}" title="${esc(s.name)}: ${number(s.share)}%"></span>`).join('');
  let negativeNote = $('.source-negative');
  if (data.sources.some(s => s.mw < 0)) {
    if (!negativeNote) { negativeNote = document.createElement('p'); negativeNote.className = 'source-negative'; $('#source-list').after(negativeNote); }
    negativeNote.textContent = 'Resíduo negativo da fonte preservado; barras partem de zero.';
  } else negativeNote?.remove();
  const prefix = state === 'saved' ? 'Leitura salva' : state === 'stale' ? 'Medição defasada' : 'Medição ONS';
  const time = `${dateTime(data.date)} (brasília)`;
  $('#reading-balance').textContent = editorialCase(`${prefix} de ${time}. consulta automática a cada 60 s.`);
  const notice = $('#fetch-notice');
  notice.hidden = state === 'live';
  if (state === 'saved') notice.textContent = `consulta ao ONS indisponível. leitura salva de ${time}.`;
  if (state === 'stale') notice.textContent = `medição do ONS defasada ou com horário incompatível. leitura de ${time}.`;
  renderFlows();
  normalizeText($('.system-section'));
}
function renderReservoirs() {
  if (!reservoirs) return;
  const percent = currentRegion === 'brasil' ? reservoirs.sinPercent : reservoirs.regions[currentRegion].percent;
  $('#ear-value').textContent = number(percent);
  $('#ear-track').style.width = percent + '%';
  $('#ear-date').textContent = civilDate(reservoirs.date);
  const meters = $('#reservoirs');
  if (reservoirShapes && !meters.firstElementChild?.matches('.ear-meter')) {
    meters.innerHTML = REGIONS.map(region => {
      const shape = reservoirShapes[region.id];
      const wave = shape ? `M-40 0${'q10 -5 20 0t20 0'.repeat(Math.ceil((shape.width + 100) / 40))}V140H-40Z` : '';
      return `<div class="ear-meter" data-ear="${region.id}">
      <div class="ear-vessel" role="meter" aria-label="${editorialCase(region.name)}" aria-valuemin="0" aria-valuemax="100">
        ${shape ? `<svg class="ear-map" viewBox="0 0 ${shape.width} 130" aria-hidden="true">
          <defs><clipPath id="ear-clip-${region.id}"><path d="${shape.path}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath></defs>
          <path class="ear-land" d="${shape.path}" fill-rule="evenodd"/>
          <g clip-path="url(#ear-clip-${region.id})"><g class="ear-level"><path class="ear-wave" d="${wave}"/></g></g>
          <path class="ear-border" d="${shape.path}"/>
        </svg>` : ''}
      </div><div class="ear-measure"><strong></strong><span>${editorialCase(region.short)}</span></div></div>`;
    }).join('');
  }
  for (const meter of meters.querySelectorAll('.ear-meter')) {
    const id = meter.dataset.ear;
    const value = reservoirs.regions[id].percent;
    const label = `${number(value)}%`;
    meter.classList.toggle('selected', id === currentRegion);
    meter.querySelector('strong').textContent = label;
    const vessel = meter.querySelector('.ear-vessel');
    vessel.setAttribute('aria-valuenow', value);
    vessel.setAttribute('aria-valuetext', label);
    const level = vessel.querySelector('.ear-level');
    if (level) level.setAttribute('transform', `translate(0 ${125 - value * 1.2})`);
  }
  const old = Date.now() - Date.parse(reservoirs.date + 'T12:00:00-03:00') > 4 * 86400000;
  $('#reading-reservoirs').textContent = `ONS · ${civilDate(reservoirs.date)} de ${reservoirs.date.slice(0, 4)} · referência diária${reservoirMode !== 'live' ? ' · leitura salva' : ''}${old ? ' · referência antiga' : ''}`;
  normalizeText($('.reservoir-panel'));
}
function selectRegion(id) {
  currentRegion = id;
  map.setRegion(id);
  operation.setRegion(id);
  renderBalance(); renderReservoirs();
  $('#announcer').textContent = editorialCase(`Subsistema selecionado: ${id === 'brasil' ? 'Brasil' : REGIONS.find(r => r.id === id).name}`);
}
function renderFlows() {
  if (!rawBalance) return;
  $('#live-flows').hidden = false;
  $('.flow-table').innerHTML = `<div class="flow-table-head"><span>Subsistema</span><span>Importação</span><span>Exportação</span></div>` + REGIONS.map(r => `<div><span>${r.name}</span><span>${number(rawBalance[r.id].importacao / 1000, 2)} GW</span><span>${number(rawBalance[r.id].exportacao / 1000, 2)} GW</span></div>`).join('');
  $('.flow-note').textContent = `ONS · ${dateTime(rawBalance.Data)} (Brasília). Valores agregados por subsistema. O mapa mostra infraestrutura cadastrada pela EPE.`;
}
function resetGenerationTimer() {
  const fill = $('#generation-fill');
  fill.getAnimations().forEach(animation => animation.cancel());
  if (!reducedMotion.matches) fill.animate([{ transform: 'translateY(0px)' }, { transform: 'translateY(24px)' }],
    { duration: refreshInterval, fill: 'forwards' });
}
async function refreshData() {
  if (refreshing) return;
  refreshing = true;
  const shouldQueryReservoirs = Date.now() - lastReservoirQuery >= 3600000;
  const jobs = [getJSON(BALANCE_URL).then(validateBalance).then(raw => {
    if (!rawBalance || Date.parse(raw.Data) >= Date.parse(rawBalance.Data)) {
      rawBalance = raw;
      resetGenerationTimer();
    }
    balanceMode = freshness(rawBalance.Data).stale ? 'stale' : 'live';
  }).catch(() => { balanceMode = rawBalance ? 'saved' : 'error'; })];
  if (shouldQueryReservoirs) jobs.push(getJSON(RESERVOIR_URL).then(normalizeReservoirs).then(data => { if (!reservoirs || data.date >= reservoirs.date) reservoirs = data; reservoirMode = 'live'; lastReservoirQuery = Date.now(); }).catch(() => { reservoirMode = reservoirs ? 'saved' : 'error'; }));
  await Promise.allSettled(jobs);
  refreshing = false;
  renderBalance(); renderReservoirs();
  operation.refresh(rawBalance?.Data);
  if (!rawBalance) { $('#source-list').innerHTML = '<p class="loading-copy">balanço indisponível. a consulta será repetida automaticamente.</p>'; $('#reading-balance').textContent = 'balanço indisponível.'; }
  if (!reservoirs) { $('#reservoirs').innerHTML = '<p class="loading-copy">reservatórios indisponíveis. a consulta será repetida automaticamente.</p>'; $('#reading-reservoirs').textContent = 'referência diária indisponível.'; $('#ear-value').textContent = '—'; }
  normalizeText($('.system-section'));
}

const introductoryChapter = () => ({ id:'introducao', title:'O problema da coordenação', claim:editorial.research.question, summary:editorial.research.hypothesis, points:[editorial.research.mechanism,editorial.research.failure,`Método: ${editorial.research.method}`], pages:[3,4,5] });
function allChapters() { return editorial ? [introductoryChapter(), ...editorial.chapters] : []; }
function renderEditorialNavigation() {
  const chapters = allChapters();
  $('#chapter-nav').innerHTML = chapters.map(ch => `<a href="#trabalho/${ch.id}" data-chapter="${ch.id}">${esc(ch.id === 'introducao' ? 'Pergunta e hipótese' : ch.title)}</a>`).join('');
  normalizeText($('#chapter-nav'));
}
function renderChapter(id) {
  if (!editorial) { $('#chapter-content').innerHTML = '<p>Carregando os capítulos do trabalho…</p>'; return; }
  const chapters = allChapters(), ch = chapters.find(c => c.id === id) || chapters[0]; currentChapter = ch.id;
  $$('[data-chapter]').forEach(a => a.toggleAttribute('aria-current', false));
  $(`[data-chapter="${ch.id}"]`)?.setAttribute('aria-current','page');
  if (matchMedia('(max-width: 800px)').matches) $(`[data-chapter="${ch.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' });
  let extra = '';
  if (ch.id === 'historia') extra = `<div class="history-list">${editorial.timeline.map(e=>`<div class="history-event"><time>${esc(e.year)}</time><div><h4>${esc(e.title)}</h4><p>${esc(e.text)}</p></div></div>`).join('')}</div>`;
  if (ch.id === 'estrutura') extra = `<h3>Explore cada elo</h3><div class="segment-tabs" role="tablist" aria-label="Segmentos">${editorial.segments.map((s,i)=>`<button role="tab" id="tab-${s.id}" data-segment="${s.id}" aria-selected="${i===0}" aria-controls="segment-detail" tabindex="${i===0?'0':'-1'}">${esc(s.name)}</button>`).join('')}</div><div class="segment-detail" id="segment-detail" role="tabpanel"></div><p class="caution-note">CR4 e HHI usam bases e períodos diferentes. Alguns índices do trabalho são parciais; não formam um ranking comparável entre os quatro segmentos.</p>`;
  if (ch.id === 'operacao') extra = `<h3>Responsabilidades distintas</h3><div class="institution-list">${editorial.institutions.slice(0,6).map(i=>`<article><strong>${esc(i.name)}</strong><p>${esc(i.role)}</p></article>`).join('')}</div><p class="caution-note">O contrato comercial não define uma rota exclusiva para os elétrons. A operação física responde às condições da rede.</p><a href="#panorama" class="text-link">Explorar o SIN no painel</a>`;
  if (ch.id === 'regulacao') extra = '<div class="comparison"><article><h3>ACR</h3><p>Distribuidoras contratam para o consumidor cativo sob regras reguladas. A tarifa incorpora energia, rede e encargos.</p></article><article><h3>ACL</h3><p>Agentes elegíveis negociam fornecimento e gerenciam a exposição contratual. Rede e encargos continuam na fatura.</p></article></div><p class="caution-note">Elegibilidade e cronogramas são descritos conforme o recorte do trabalho, em 24/11/2026.</p>';
  if (ch.id === 'itaipu') extra = '<div class="chapter-stat"><strong>72,45</strong><span>TWh em 2025</span></div><p class="stat-caption">Energia suprida por Itaipu às duas compradoras, não geração bruta.</p><div class="split-energy" aria-hidden="true"><span></span><span></span></div><div class="split-labels"><span>Brasil: 46,68 TWh<br>ENBPar · 64,43%</span><span>Paraguai: 25,77 TWh<br>ANDE · 35,57%</span></div><p class="caution-note">Os direitos binacionais são paritários. A energia efetivamente entregue difere porque cada país pode adquirir a parcela não utilizada pelo outro. Fonte: Itaipu Binacional, conforme o PDF, p. 34.</p>';
  if (ch.id === 'integracao') extra = '<h3>Interconexões citadas no trabalho</h3><div class="transit-row"><span>Garabi I e II · Argentina</span><strong>2 × 1.100 MW</strong></div><div class="transit-row"><span>Melo · Uruguai</span><strong>500 MW</strong></div><div class="transit-row"><span>Rivera · Uruguai</span><strong>70 MW</strong></div><p class="caution-note">Potência nominal das interconexões não equivale à disponibilidade em cada hora. Fluxos comerciais e fluxos físicos têm universos distintos. Recorte do trabalho, pp. 36–39.</p>';
  if (ch.id === 'transicao') extra = '<div class="chapter-stat"><strong>86,6</strong><span>% de renováveis em 2025</span></div><p class="stat-caption">Oferta interna de eletricidade · BEN 2026 final, citado no PDF. Valor histórico, diferente do balanço instantâneo do ONS.</p><h3>O que os números permitem dizer</h3><div class="comparison"><article><h3>26,3 GW</h3><p>Pedidos de conexão de datacenters até 2038, conforme o PDE 2035 citado no trabalho. São projetos protocolados, não consumo já instalado.</p></article><article><h3>4 GW</h3><p>Premissa de novas cargas constantes em cenário do ONS. A redução simulada de cortes é de 693 MW médios, não um resultado observado.</p></article></div><p class="caution-note">A introdução do PDF usa 86,8% da síntese do BEN; esta apresentação adota 86,6% da edição final, como o corpo e a conclusão.</p>';
  if (ch.id === 'conclusao') extra = `<blockquote>${esc(editorial.presentationClosing.statement)}</blockquote><h3>Para discutir com a turma</h3><p>${esc(editorial.presentationClosing.discussion)}</p><p class="caution-note">A pesquisa é documental e descritiva. Ela identifica mecanismos e limites, sem demonstrar causalmente redução de tarifas, emissões ou interrupções.</p>`;
  const idx = chapters.indexOf(ch), previous = chapters[idx-1], next = chapters[idx+1];
  $('#chapter-content').innerHTML = `<h2>${esc(ch.title)}</h2><p class="chapter-lead">${esc(ch.claim)}</p><p>${esc(ch.summary)}</p>${extra}<h3>${ch.id==='introducao'?'Como a pesquisa se organiza':'Pontos para a apresentação'}</h3><ul>${ch.points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><p class="chapter-source">Síntese do trabalho original · páginas impressas ${ch.pages[0]}–${ch.pages.at(-1)} · recorte documental até 24/11/2026. <a href="./assets/trabalho.pdf#page=${ch.pages[0]+1}" target="_blank" rel="noopener">Conferir no PDF</a></p><nav class="chapter-pagination" aria-label="Avançar no trabalho">${previous ? `<a href="#trabalho/${previous.id}">Anterior: ${esc(previous.title)}</a>` : '<span></span>'}${next ? `<a href="#trabalho/${next.id}">Próximo: ${esc(next.title)}</a>` : '<a href="#fontes">Fontes e notas</a>'}</nav>`;
  if (ch.id === 'estrutura') selectSegment(editorial.segments[0].id);
  normalizeText($('#chapter-content'));
}
function selectSegment(id, focus = false) {
  const s = editorial.segments.find(s=>s.id===id); if (!s) return;
  $$('[data-segment]').forEach(button=>{const selected=button.dataset.segment===id;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;if(selected&&focus)button.focus();});
  $('#segment-detail').setAttribute('aria-labelledby','tab-'+id);
  $('#segment-detail').innerHTML = `<h3>${esc(s.job)}</h3><dl><dt>Mercado</dt><dd>${esc(s.market)}</dd><dt>Restrição</dt><dd>${esc(s.constraint)}</dd><dt>Como medir</dt><dd>${esc(s.measure)}</dd><dt>Qualidade</dt><dd>${esc(s.quality)}</dd></dl>`;
  normalizeText($('#segment-detail'));
}
let activeView = '';
function route({ focus = false } = {}) {
  const [requested, id] = location.hash.slice(1).split('/');
  const section = ['historico', 'planejamento', 'cut-title', 'curve-title', 'fontes'].includes(requested) ? document.getElementById(requested) : null;
  const view = requested === 'trabalho' ? 'trabalho' : requested === 'fontes' && activeView ? activeView : 'panorama';
  for (const name of ['panorama','trabalho']) $('#view-'+name).hidden = view !== name;
  if (view === 'trabalho' && requested === 'trabalho') renderChapter(id || 'introducao');
  if (!section && (activeView !== view || requested === 'panorama' || view === 'trabalho')) window.scrollTo({top:0,behavior:'instant'});
  activeView = view;
  if (requested === 'fontes') section.open = true;
  if (section) requestAnimationFrame(() => section.scrollIntoView({ block: 'start' }));
  else if (focus) $('#conteudo').focus({preventScroll:true});
  const title = view==='trabalho' ? allChapters().find(c=>c.id===currentChapter)?.title || 'o trabalho' : 'setor elétrico brasileiro';
  document.title = editorialCase(`${title} | economia industrial`);
}

function slides() { return madrid; }

function renderSlide() {
  const slide = madrid[slideIndex];
  if (!slide) return;
  renderMadrid($('#slide-stage'), slide, closePresentation);
  $('#slide-counter').textContent = `${slideIndex + 1} / ${madrid.length}`;
  $('#previous-slide').disabled = slideIndex === 0;
  $('#next-slide').disabled = slideIndex === madrid.length - 1;
  $('#slide-progress').replaceChildren(...madrid.map((_, i) => {
    const mark = document.createElement('span');
    if (i <= slideIndex) mark.className = 'done';
    return mark;
  }));
  $('#slide-context').textContent = slide.block;
  $('#presentation').scrollTop = 0;
}
function changeSlide(delta) { const next=Math.min(Math.max(0,slideIndex+delta),slides().length-1); if(next!==slideIndex){slideIndex=next;renderSlide();$('#slide-title').focus({preventScroll:true});} }
function openPresentation() { if(!madrid.length || document.fullscreenElement || document.querySelector('.panel-expanded'))return;previousFocus=document.activeElement;slideIndex=0;renderSlide();$('#presentation').showModal();document.body.style.overflow='hidden';$('#close-presentation').focus(); }
function closePresentation() { $('#presentation').close();document.body.style.overflow='';previousFocus?.focus(); }

document.addEventListener('click', event=>{
  const segment=event.target.closest('[data-segment]');if(segment)selectSegment(segment.dataset.segment);
});
document.addEventListener('keydown',event=>{
  if($('#presentation').open){const interactive=event.target.closest('button,a,input,select,textarea,summary,[role="button"],[contenteditable]');if(event.key==='ArrowRight'||event.key==='PageDown'||(event.key===' '&&!interactive)){event.preventDefault();changeSlide(1);}if(event.key==='ArrowLeft'||event.key==='PageUp'){event.preventDefault();changeSlide(-1);}if(event.key==='Home'){event.preventDefault();slideIndex=0;renderSlide();}if(event.key==='End'){event.preventDefault();slideIndex=slides().length-1;renderSlide();}return;}
  if(event.key.toLowerCase()==='p'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!$('#data-dialog').open&&!event.target.closest('input,textarea,select,[contenteditable]'))openPresentation();
  const segment=event.target.closest('[data-segment]');
  if(segment&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const ids=editorial.segments.map(s=>s.id),idx=ids.indexOf(segment.dataset.segment);selectSegment(event.key==='Home'?ids[0]:event.key==='End'?ids.at(-1):ids[(idx+(event.key==='ArrowRight'?1:-1)+ids.length)%ids.length],true);}
});
$('#data-notes').addEventListener('click',()=>$('#data-dialog').showModal());
$('#dialog-notes-link').addEventListener('click',()=>$('#data-dialog').close());
$('#present').addEventListener('click',openPresentation);
$('#close-presentation').addEventListener('click',closePresentation);
$('#presentation').addEventListener('cancel',event=>{event.preventDefault();closePresentation();});
$('#previous-slide').addEventListener('click',()=>changeSlide(-1));$('#next-slide').addEventListener('click',()=>changeSlide(1));
window.addEventListener('hashchange',()=>route({focus:true}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshData();});
window.addEventListener('online',()=>refreshData());
setInterval(()=>{if(!document.hidden)refreshData();},refreshInterval);
reducedMotion.addEventListener('change', () => { if (rawBalance) resetGenerationTimer(); });
setInterval(()=>{if(!document.hidden)renderBalance();},30000);

async function init() {
  route();
  const local = await Promise.allSettled([
    getJSON('./data/balance.json').then(validateBalance).then(raw=>{rawBalance=raw;balanceMode='saved';renderBalance();}),
    getJSON('./data/reservoirs.json').then(normalizeReservoirs).then(data=>{reservoirs=data;reservoirMode='saved';renderReservoirs();}),
    getJSON('./data/editorial.json').then(data=>{editorial=data;renderEditorialNavigation();route();}),
    loadMadrid().then(slides => { madrid = slides; $('#present').disabled = false; }),
    getJSON('./data/capacity.json').then(data=>{$('#capacity-data').innerHTML=`<div class="capacity-number">${number(data.totalMW/1000)} <small>GW</small></div><div class="capacity-rows">${data.groups.map(g=>`<div><span>${esc(g.type)} · ${esc(g.origin)}</span><strong>${number(g.mw/1000,2)} GW</strong></div>`).join('')}</div>`; normalizeText($('#capacity-data'));})
  ]);
  local.forEach((result, i) => {
    if (result.status !== 'rejected') return;
    console.warn('recurso local indisponível', i, result.reason.message);
    if (i === 2) $('#chapter-content').innerHTML = '<p>capítulos indisponíveis. <a href="./assets/trabalho.pdf">abra o trabalho em PDF.</a></p>';
    if (i === 3) $('#present').textContent = 'apresentação indisponível';
    if (i === 4) $('#capacity-data').textContent = 'a leitura de capacidade não carregou. consulte a fonte abaixo.';
  });
  await refreshData();
}
function setTheme(theme) {
  const light = theme === 'claro';
  document.documentElement.dataset.theme = light ? 'claro' : 'eletrica';
  const action = light ? 'ativar modo escuro' : 'ativar modo claro';
  $('#theme-toggle').setAttribute('aria-label', action);
  $('#theme-toggle').title = action;
  $('#theme-toggle use').setAttribute('href', light ? '#i-moon' : '#i-sun');
  $('#theme-toggle').setAttribute('aria-pressed', String(light));
  $('meta[name="theme-color"]').content = light ? '#edf3f7' : '#080b10';
  try { localStorage.setItem('luz-tema', theme); } catch {}
  document.dispatchEvent(new Event('themechange'));
}

let savedTheme;
try { savedTheme = localStorage.getItem('luz-tema'); } catch {}
setTheme(savedTheme);
$('#theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'claro' ? 'eletrica' : 'claro'));
$('#present').disabled = true;
normalizeText(document.body);
document.addEventListener('click', event => {
  if (!event.target.closest('a[href="#fontes"]')) return;
  $('#fontes').open = true;
  if (location.hash === '#fontes') requestAnimationFrame(() => $('#fontes').scrollIntoView({ block: 'start' }));
});
initHistorical().catch(() => { $('#history-chart').textContent = 'série histórica indisponível.'; $('#sankey-chart').textContent = 'fluxo histórico indisponível.'; });
initPlans().catch(() => { $('#plan-charts').textContent = 'cenários da EPE indisponíveis.'; });
init();

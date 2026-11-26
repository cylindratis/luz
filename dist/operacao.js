import { getJSON, number, REGIONS } from './data.js';
import { lineChart } from './graficos.js';
import { editorialCase } from './texto.js';

const $ = selector => document.querySelector(selector);
const endpoint = 'https://tr.ons.org.br/Content/Get/';
const regionCodes = {
  brasil: 'SIN', norte: 'Norte', nordeste: 'Nordeste',
  sudesteECentroOeste: 'SudesteECentroOeste', sul: 'Sul'
};
const sourceColors = {
  total: ['total', 'var(--plot-blue)', 'energy'],
  Hidraulica: ['hidráulica', 'var(--plot-blue)', 'water'], Eolica: ['eólica', 'var(--plot-green)', 'wind'],
  Solar: ['solar', 'var(--plot-orange)', 'solar'], Termica: ['térmica', 'var(--plot-red)', 'thermal'],
  Nuclear: ['nuclear', 'var(--plot-ink)', 'nuclear'], Mmgd: ['MMGD', 'var(--plot-purple)', 'distributed']
};
const curveSources = Object.keys(sourceColors).filter(id => id !== 'total');
const regionLabel = id => editorialCase(REGIONS.find(region => region.id === id)?.short || 'SIN');
const clock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const localClock = date => Object.fromEntries(clock.formatToParts(date).map(part => [part.type, part.value]));
const localDay = date => {
  const parts = localClock(date);
  return [parts.year, parts.month, parts.day].join('-');
};
const isoDay = day => day.split('-').reverse().join('/');
const minuteLabel = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const dateShift = (day, days) => new Date(Date.parse(day) + days * 86400000).toISOString().slice(0, 10);

export function parseCurve(raw) {
  if (!Array.isArray(raw?.rows)) throw new Error('série do ONS indisponível');
  const points = new Map();
  for (const row of raw.rows) {
    const [minute, value] = row.c?.map(p => p?.v) || [];
    if (Number.isInteger(minute) && minute >= 0 && minute < 1440 && Number.isFinite(value)) points.set(minute, value);
  }
  if (!points.size) throw new Error('série do ONS vazia');
  return points;
}

export function mergeCurve(parts, last, source) {
  const points = [];
  for (let minute = 0; minute <= last; minute++) {
    let value;
    if (source === 'total') {
      const values = Object.values(parts).map(part => part.get(minute));
      value = values.length && values.every(Number.isFinite) ? values.reduce((a,b) => a + b, 0) : null;
    } else value = parts[source]?.get(minute) ?? null;
    points.push([minute, value]);
  }
  return points;
}

function renderCuts(raw, region, days) {
  const end = raw.reference;
  const start = dateShift(end, 1 - days);
  const totals = {};
  const reasons = {};
  const common = Object.keys(raw.data.eolica).filter(day => day >= start && day <= end && day in raw.data.solar);
  for (const kind of ['eolica', 'solar']) {
    totals[kind] = 0;
    for (const day of common) {
      const values = raw.data[kind][day];
      for (const [area, codes] of Object.entries(values)) {
        if (region !== 'brasil' && area !== region) continue;
        for (const [code, value] of Object.entries(codes)) {
          totals[kind] += value;
          reasons[code] = (reasons[code] || 0) + value;
        }
      }
    }
  }
  const sum = totals.solar + totals.eolica;
  const area = regionLabel(region);
  if (!common.length) { $('#cut-chart').textContent = 'sem período comum nas bases do ONS'; return; }
  const names = { REL: 'indisponibilidade externa', CNF: 'confiabilidade', ENE: 'razão energética', PAR: 'parecer de acesso', outros: 'sem código publicado' };
  const list = Object.entries(reasons).filter(([, v]) => v > 0).sort((a,b) => b[1]-a[1])
    .map(([code,v]) => `${names[code] || 'outros motivos'} ${number(v / 1000, 2)} GWh`).join(' · ');
  const bar = (kind, label, color) => `<div><span>${label}</span><span>${number(totals[kind] / 1000, 2)} GWh</span><i aria-hidden="true" style="--cut-width:${sum ? totals[kind] / sum * 100 : 0}%;--swatch:${color}"></i></div>`;
  $('#cut-chart').innerHTML = `<p class="cut-total">${number(sum / 1000, 2)} <small>GWh</small></p><p class="chart-source">geração não realizada apurada · ${area}</p>
    <div class="cut-bars">${bar('eolica','eólica','var(--plot-green)')}${bar('solar','solar','var(--plot-orange)')}</div>
    ${list ? `<details class="chart-table"><summary>ver motivos registrados</summary><p class="cut-reasons">${list}</p></details>` : ''}`;
  const old = Math.round((Date.parse(localDay(new Date())) - Date.parse(end)) / 86400000);
  $('#cut-status').textContent = `ONS · ${isoDay(common[0])} a ${isoDay(end)} · ${common.length}/${days} dias publicados${old > 3 ? ' · dados defasados' : ''} · sujeito a revisão`;
}

export function initOperation() {
  const sourceControl = $('#curve-sources'), cutPeriod = $('#cut-period');
  let region = 'brasil', measuredAt, cutData;
  let curve = null, revision = 0, source = 'total';
  sourceControl.innerHTML = Object.entries(sourceColors).map(([id, [label, color, icon]]) =>
    `<button class="control source-button" type="button" data-curve-source="${id}" aria-pressed="${id === source}" style="--source-color:${color}"><svg class="icon" aria-hidden="true"><use href="#i-${icon}"/></svg><span>${label}</span></button>`
  ).join('');
  function selectSource(id) {
    source = id;
    for (const button of sourceControl.children) button.setAttribute('aria-pressed', String(button.dataset.curveSource === source));
    renderCurves();
  }
  cutPeriod.replaceChildren(new Option('7 dias', 7), new Option('30 dias', 30));
  const renderCurves = () => {
    if (!curve || curve.region !== region) return;
    const [label, color] = sourceColors[source];
    const points = mergeCurve(curve.parts, curve.minute, source);
    lineChart($('#curve-chart'), [{ name: label, points, color }], {
      label: 'curva de geração do dia', unit: 'MW', timeName: 'horário de Brasília',
      first: 0, last: 1440, ticks: [0, 360, 720, 1080, 1440], labelFormat: minuteLabel, decimals: 0
    });
    const last = points.findLast(([, value]) => Number.isFinite(value))?.[0];
    const area = regionLabel(region);
    const now = localClock(new Date());
    const delayed = Number(now.hour) * 60 + Number(now.minute) - last > 15;
    const freshness = curve.saved || curve.day !== localDay(new Date()) ? ' · última leitura disponível' : delayed ? ' · medição defasada' : '';
    $('#curve-status').textContent = last == null ? 'sem medição nesta série' :
      `ONS · ${area} · ${isoDay(curve.day)} · até ${minuteLabel(last)} (brasília)${freshness}`;
  };
  async function refresh(timestamp) {
    measuredAt = timestamp || measuredAt;
    const clockDate = new Date(measuredAt || Date.now());
    if (!Number.isFinite(clockDate.valueOf())) return;
    const day = localDay(clockDate);
    if (day !== localDay(new Date())) {
      if (curve?.region === region) { curve.saved = true; renderCurves(); }
      else {
        $('#curve-chart').innerHTML = '<p class="chart-empty">aguardando medições do dia no ONS.</p>';
        $('#curve-status').textContent = '';
      }
      return;
    }
    const selected = region;
    const task = ++revision;
    const eligible = curveSources.filter(id => id !== 'Nuclear' || ['brasil','sudesteECentroOeste'].includes(selected));
    try {
      const entries = await Promise.all(eligible.map(async id => [
        id, parseCurve(await getJSON(endpoint + `Geracao_${regionCodes[selected]}_${id}`))
      ]));
      if (task !== revision || day !== localDay(new Date())) return;
      const t = localClock(clockDate);
      const minute = Number(t.hour) * 60 + Number(t.minute);
      const last = Math.max(...entries.flatMap(([, points]) => [...points.keys()]));
      if (last > minute + 10) throw new Error('série sem correspondência com a medição do dia');
      curve = { parts: Object.fromEntries(entries), minute: Math.min(last,minute), day, region: selected };
      renderCurves();
    } catch {
      if (task !== revision) return;
      if (curve?.region === region) { curve.saved = true; renderCurves(); }
      else {
        $('#curve-chart').innerHTML = '<p class="chart-empty">a série intradiária está indisponível. <a href="https://www.ons.org.br/paginas/energia-agora/carga-e-geracao">consultar o ONS</a></p>';
        $('#curve-status').textContent = '';
      }
    }
  }
  sourceControl.addEventListener('click', event => {
    const button = event.target.closest('[data-curve-source]');
    if (button) selectSource(button.dataset.curveSource);
  });
  const updateCuts = () => { if (cutData) renderCuts(cutData, region, Number(cutPeriod.value)); };
  cutPeriod.addEventListener('change', updateCuts);
  getJSON('./data/curtailment.json').then(raw => {
    cutData = raw;
    updateCuts();
  }).catch(() => {
    $('#cut-chart').innerHTML = '<p class="chart-empty">cortes indisponíveis no site. <a href="https://dados.ons.org.br/dataset/restricao_coff_eolica_usi">consultar dados do ONS</a></p>';
  });
  return {
    refresh,
    setRegion(id) {
      if (id === region) return;
      region = id;
      revision++;
      const nuclear = sourceControl.querySelector('[data-curve-source="Nuclear"]');
      nuclear.hidden = !['brasil','sudesteECentroOeste'].includes(id);
      if (nuclear.hidden && source === 'Nuclear') selectSource('total');
      $('#curve-chart').innerHTML = '<p class="chart-empty">consultando o subsistema…</p>';
      $('#curve-status').textContent = '';
      refresh();
      updateCuts();
    }
  };
}

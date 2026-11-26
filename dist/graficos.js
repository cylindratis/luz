import { getJSON, number } from './data.js';
import { editorialCase } from './texto.js';
import { initFullscreen } from './tela-cheia.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const names = text => escape(editorialCase(text));
const colors = ['var(--plot-blue)', 'var(--plot-green)', 'var(--plot-orange)', 'var(--plot-red)', 'var(--plot-ink)', 'var(--plot-purple)'];
const chartTable = (headers, rows) => `<table><thead><tr>${headers.map(h => `<th scope="col">${names(h)}</th>`).join('')}</tr></thead><tbody>${
  rows.map(row => `<tr>${row.map((v, i) => i ? `<td>${names(v)}</td>` : `<th scope="row">${names(v)}</th>`).join('')}</tr>`).join('')
}</tbody></table>`;

function setOptions(select, values, selected) {
  select.replaceChildren(...values.map(([value, label]) => new Option(editorialCase(label), value)));
  if (values.some(([value]) => String(value) === String(selected))) select.value = selected;
}

function attachTable(container, headers, rows) {
  const details = document.createElement('details');
  details.className = 'chart-table';
  details.innerHTML = '<summary>ver dados da série</summary>';
  details.addEventListener('toggle', () => {
    if (!details.open || details.children.length > 1) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = chartTable(headers, rows);
    details.append(wrapper);
  });
  container.append(details);
}

export function lineChart(container, series, options) {
  const all = series.flatMap(line => line.points.filter(point => Number.isFinite(point[1])));
  if (!all.length) { container.innerHTML = '<p class="chart-empty">sem dados para esta seleção.</p>'; return; }
  const labels = [...new Set(all.map(p => p[0]))].sort((a, b) => a - b);
  const first = options.first ?? labels[0], last = options.last ?? labels.at(-1);
  const left = 70, right = 610, top = 22, bottom = 202;
  const values = all.map(p => p[1]);
  let min = Math.min(0, ...values), max = Math.max(0, ...values);
  if (min === max) max += 1;
  const x = time => left + ((time - first) / (last - first || 1)) * (right - left);
  const y = value => bottom - ((value - min) / (max - min)) * (bottom - top);
  const marksX = options.ticks ?? [...new Set([first, Math.round(first + (last - first) / 3), Math.round(first + (last - first) * 2 / 3), last])];
  const marksY = Array.from({ length: 5 }, (_, i) => min + ((max - min) / 4) * i);
  const valueFormat = options.valueFormat ?? (value => number(value, options.decimals ?? 1));
  const labelFormat = options.labelFormat ?? String;
  const svg = `<svg class="plot" viewBox="0 0 630 235" role="img" aria-label="${names(options.label)} (${escape(options.unit)})">
    ${marksY.map(value => `<line x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/><text text-anchor="end" x="${left - 9}" y="${y(value) + 4}">${valueFormat(value)}</text>`).join('')}
    ${marksX.map(time => `<text text-anchor="middle" x="${x(time)}" y="224">${names(labelFormat(time))}</text>`).join('')}
    <text x="${left}" y="15" class="plot-unit">${names(options.unit)}</text>
    ${series.map((line, i) => {
      let move = true;
      const path = line.points.map(([time, value]) => {
        if (!Number.isFinite(value)) { move = true; return ''; }
        const op = move ? 'M' : 'L'; move = false;
        return op + x(time).toFixed(2) + ',' + y(value).toFixed(2);
      }).join(' ');
      const color = line.color || colors[i % colors.length];
      const dots = line.points.length < 12 ? line.points.filter(p => Number.isFinite(p[1])).map(([time, value]) =>
        `<circle cx="${x(time)}" cy="${y(value)}" r="3" style="fill:${color}"/>`).join('') : '';
      return `<path d="${path}" class="plot-series" style="stroke:${color}" />${dots}`;
    }).join('')}
    <line class="plot-marker" x1="${right}" x2="${right}" y1="${top}" y2="${bottom}" hidden/>
  </svg>`;
  const legend = `<ul class="chart-legend">${series.map((l, i) => `<li><i style="--swatch:${l.color || colors[i % colors.length]}"></i>${names(l.name)}</li>`).join('')}</ul>`;
  container.innerHTML = svg + legend + '<output class="plot-reading" aria-live="off"></output>';
  const chart = container.querySelector('.plot'), output = container.querySelector('.plot-reading');
  const lookup = series.map(s => new Map(s.points));
  const display = time => {
    const marker = chart.querySelector('.plot-marker');
    marker.removeAttribute('hidden');
    marker.setAttribute('x1', x(time));
    marker.setAttribute('x2', x(time));
    output.textContent = `${labelFormat(time)} · ${series.map((line, i) => {
      const value = lookup[i].get(time);
      return editorialCase(line.name) + ' ' + (Number.isFinite(value) ? valueFormat(value) + ' ' + options.unit : '—');
    }).join(' · ')}`;
  };
  chart.addEventListener('pointermove', event => {
    const matrix = chart.getScreenCTM();
    if (!matrix) return;
    const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const estimate = first + ((position.x - left) / (right - left)) * (last - first);
    const time = labels.reduce((best, candidate) => Math.abs(candidate - estimate) < Math.abs(best - estimate) ? candidate : best);
    display(time);
  });
  display(labels.at(-1));
  attachTable(container, [options.timeName || 'ano', ...series.map(line => `${line.name} (${options.unit})`)], labels.map(time =>
    [labelFormat(time), ...lookup.map(line => Number.isFinite(line.get(time)) ? valueFormat(line.get(time)) : '—')]));
}

function sankey(container, year) {
  const sourceGroups = [
    ['hidrelétrica', 'var(--plot-blue)', ['hidráulica']],
    ['carvão', 'var(--plot-ink)', ['carvão vapor']],
    ['gás natural', 'var(--plot-red)', ['gás natural']],
    ['óleo e derivados', 'var(--plot-orange)', ['óleo diesel', 'óleo combustível']],
    ['nuclear', 'var(--plot-purple)', ['urânio contido no uo2']],
    ['biomassa', 'var(--plot-green)', ['lenha', 'bagaço de cana', 'lixívia', 'biodiesel']],
    ['eólica', 'var(--wind)', ['eólica']],
    ['solar', 'var(--solar)', ['solar']]
  ];
  const listed = new Set(sourceGroups.flatMap(group => group[2]));
  const others = Object.entries(year.fontes).filter(([name]) => !listed.has(name)).reduce((sum, [,value]) => sum + value, 0);
  const input = sourceGroups.map(([name, color, columns]) => [name, columns.reduce((sum, key) => sum + (year.fontes[key] || 0), 0), color]);
  input.push(['outras fontes', others, 'var(--faint)'], ['importação', year.importacao, 'var(--plot-blue)']);
  const output = [...Object.entries(year.consumo), ['perdas', year.perdas], ['exportação', year.exportacao]];
  if (year.diferenca > .5) output.push(['saldo do balanço', year.diferenca]);
  if (year.diferenca < -.5) input.push(['saldo do balanço', -year.diferenca]);
  const total = input.reduce((sum, [, value]) => sum + value, 0);
  const height = 185, unit = height / total;
  const incoming = input.filter(([, value]) => value > 0);
  const outgoing = output.filter(([, value]) => value > 0);
  const gap = 20, mid = 113;
  const nodeLabel = (text, x, y, anchor = 'start') =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}">${names(({ 'setor energético': 'setor energia', 'saldo do balanço': 'saldo' })[text] || text)}</text>`;
  const ribbon = (x1, y1, x2, y2, h, color) => {
    const c = (x1 + x2) / 2;
    return `<path d="M${x1},${y1} C${c},${y1} ${c},${y2} ${x2},${y2} V${y2 + h} C${c},${y2 + h} ${c},${y1 + h} ${x1},${y1 + h} Z" style="fill:${color}" />`;
  };
  let cy = mid, iy = mid - ((incoming.length - 1) * gap) / 2;
  let svg = `<svg class="sankey" viewBox="0 0 680 419" role="img" aria-label="fluxo da eletricidade em GWh em ${year.ano}">`;
  for (const [label, value, color = 'var(--faint)'] of incoming) {
    const h = value * unit;
    svg += ribbon(192, iy, 328, cy, h, color);
    svg += `<rect x="184" y="${iy}" width="8" height="${h}" style="fill:${color}"/>${nodeLabel(label, 177, iy + h / 2 + 4, 'end')}`;
    cy += h;
    iy += h + gap;
  }
  cy = mid;
  let oy = mid - (outgoing.length - 1) * gap / 2;
  for (const [i, [label, value]] of outgoing.entries()) {
    const h = value * unit, color = colors[i % colors.length];
    svg += ribbon(340, cy, 498, oy, h, color);
    svg += `<rect x="498" y="${oy}" width="8" height="${h}" style="fill:${color}"/>${nodeLabel(label, 513, oy + h / 2 + 4)}`;
    cy += h;
    oy += h + gap;
  }
  svg += `<rect x="328" y="${mid}" width="12" height="${height}" class="sankey-center"/><text x="334" y="${mid - 18}" text-anchor="middle">oferta elétrica</text></svg>`;
  container.innerHTML = svg;
  attachTable(container, ['origem ou destino', 'energia (GWh)'], [...input, ...output].map(([k,v]) => [k, number(v, 2)]));
}

export async function initHistorical() {
  const history = await getJSON('./data/historico.json');
  const metric = $('#history-series'), year = $('#sankey-year');
  const byYear = new Map(history.map(row => [row.ano, row]));
  setOptions(metric, [['balanco', 'produção, consumo e perdas'], ['fontes', 'geração por fonte'], ['consumo', 'consumo por setor'], ['intercambio', 'importação e exportação']]);
  year.min = $('#sankey-first').textContent = history[0].ano;
  year.max = $('#sankey-last').textContent = history.at(-1).ano;
  year.value = year.max;
  year.disabled = false;
  const play = $('#sankey-play');
  play.disabled = false;
  let timer;
  const stop = () => {
    clearInterval(timer);
    timer = undefined;
    play.setAttribute('aria-label', 'reproduzir de 1970 a 2025');
    play.title = 'reproduzir de 1970 a 2025';
    play.querySelector('use').setAttribute('href', '#i-play');
  };
  const pick = (name, value) => ({ name, points: history.map(row => [row.ano, value(row) ?? null]) });
  const draw = () => {
    const lines = {
      balanco: [['geração', x => x.geracao], ['consumo final', x => x.consumoTotal], ['perdas', x => x.perdas]],
      fontes: ['hidráulica', 'eólica', 'solar', 'gás natural', 'urânio contido no uo2'].map(id => [id === 'urânio contido no uo2' ? 'nuclear' : id, x => x.fontes[id]]),
      consumo: ['residencial', 'industrial', 'comercial', 'agropecuário', 'público'].map(id => [id, x => x.consumo[id]]),
      intercambio: [['importação', x => x.importacao], ['exportação', x => x.exportacao]]
    };
    lineChart($('#history-chart'), lines[metric.value].map(([name, f]) => pick(name, row => {
      const value = f(row);
      return Number.isFinite(value) ? value / 1000 : null;
    })), { label: 'série histórica da eletricidade', unit: 'TWh' });
  };
  const drawFlow = () => {
    $('#sankey-selection').value = year.value;
    sankey($('#sankey-chart'), byYear.get(year.valueAsNumber));
  };
  metric.addEventListener('change', draw);
  year.addEventListener('input', () => { stop(); drawFlow(); });
  play.addEventListener('click', () => {
    if (timer) { stop(); return; }
    if (year.value === year.max) { year.value = year.min; drawFlow(); }
    play.setAttribute('aria-label', 'pausar reprodução');
    play.title = 'pausar reprodução';
    play.querySelector('use').setAttribute('href', '#i-pause');
    timer = setInterval(() => {
      year.stepUp();
      drawFlow();
      if (year.value === year.max) stop();
    }, 280);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('hashchange', () => { if ($('#view-panorama').hidden) stop(); });
  initFullscreen($('#history-fullscreen'));
  initFullscreen($('#sankey-fullscreen'));
  draw();
  drawFlow();
}

export async function initPlans() {
  const plans = await getJSON('./data/planos.json');
  for (const [title, metrics] of Object.entries(plans)) {
    const card = document.createElement('article');
    card.className = 'panel data-panel plan-card';
    card.innerHTML = `<div class="panel-heading"><h3>${escape(title)}</h3><span class="subtle">cenários da EPE</span></div>
      <div class="plan-controls">
        <label>indicador<select class="plan-metric"></select></label>
        <label>cenário<select class="plan-scenario"></select></label>
        <label>recorte<select class="plan-group"></select></label>
      </div><div class="plan-chart"></div><p class="chart-source"></p>`;
    $('#plan-charts').append(card);
    const metricSelect = card.querySelector('.plan-metric'), scenario = card.querySelector('.plan-scenario');
    const group = card.querySelector('.plan-group'), graph = card.querySelector('.plan-chart');
    setOptions(metricSelect, metrics.map((item, i) => [i, item.name]), 1);
    const getMetric = () => metrics[Number(metricSelect.value)];
    const render = () => {
      const metric = getMetric();
      const chosen = metric.series.find(s => s.scenario === scenario.value && s.group === group.value);
      const comparison = metric.series.find(s => s.scenario.toLocaleLowerCase('pt-BR') === 'base' && s.group === group.value);
      const base = (title === 'PDE 2035' ? chosen : comparison)?.points.find(([year]) => year === 2025);
      const points = chosen?.points.filter(([year]) => year !== 2025 || !base) ?? [];
      // The source labels 2025 as Base in PNE. Keep it a separate series and do not infer observed data.
      const series = [];
      if (points.length) series.push({ name: title === 'PDE 2035' ? 'cenário de referência' : 'cenário · ' + scenario.value, points });
      if (base) series.push({ name: 'ano-base do plano', color: 'var(--plot-orange)', points: [base] });
      lineChart(graph, series, { label: metric.name, unit: metric.unit, decimals: 2 });
      card.querySelector('.chart-source').textContent = editorialCase(`EPE · ${title} · ${metric.source}${title === 'PDE 2035' ? ' · série do plano, 2025 é ano-base quando disponível' : ''}.`);
    };
    const updateGroups = () => {
      const values = getMetric().series.filter(s => s.scenario === scenario.value).map(s => s.group);
      const preferred = values.includes(group.value) ? group.value : values.find(v => /total/i.test(v)) ||
        values.find(v => /hidráulica.*centralizada|centralizada.*eólica/i.test(v));
      setOptions(group, values.map(v => [v, v]), preferred);
      render();
    };
    const updateScenario = () => {
      const values = [...new Set(getMetric().series.map(s => s.scenario))];
      setOptions(scenario, values.map(v => [v, v]), values.includes(scenario.value) ? scenario.value : values.find(v => v.toLowerCase() !== 'base'));
      updateGroups();
    };
    metricSelect.addEventListener('change', updateScenario);
    scenario.addEventListener('change', updateGroups);
    group.addEventListener('change', render);
    updateScenario();
  }
}

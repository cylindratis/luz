import { dateTime, getJSON, number, REGIONS, SOURCES } from './data.js';
import { editorialCase } from './texto.js';
import { corridorKey, locateCorridors } from './corredores.js';
import { buildTransmissionNetwork, isHVDC, matchesLine, targets } from './rede-transmissao.js';
const shortNames = Object.fromEntries(REGIONS.map(region => [region.id, editorialCase(region.short)]));
const asGW = mw => `${number(mw / 1000, 2)} GW`;
const generation = region => Object.values(region.sources).reduce((sum, value) => sum + value, 0);
const balance = region => Math.round((generation(region) - region.load) * 1000) / 1000;

function signed(mw) {
  if (Math.abs(mw) < .001) return { sign: '=', label: 'equilíbrio', type: 'neutral' };
  return mw > 0 ? { sign: '+', label: 'excedente', type: 'positive' } :
    { sign: '−', label: 'déficit', type: 'negative' };
}

function summarizePeriod(reading, corridors, destinations) {
  const regions = REGIONS.map(({ id }) => {
    const area = reading.regions[id];
    const mw = balance(area);
    const state = signed(mw);
    const target = targets[id];
    const routes = destinations.get(id) || [];
    const destination = routes.length ? `<div><dt>destino ilustrativo</dt><dd>${target.city} · ${target.station}</dd></div>` :
      mw < 0 ? `<div><dt>rota para ${target.city}</dt><dd>indisponível neste recorte</dd></div>` : '';
    const sources = SOURCES.filter(source => source.id in area.sources).map(source =>
      `<div><dt>${editorialCase(source.name)}</dt><dd>${asGW(area.sources[source.id])}</dd></div>`).join('');
    return `<details class="exchange-region"><summary><span>${shortNames[id]}</span>
      <strong class="exchange-${state.type}"><span class="sr-only">${state.label}: </span>${state.sign === '=' ? '' : state.sign}${asGW(Math.abs(mw))}</strong></summary>
      <dl><div><dt>geração total</dt><dd>${asGW(generation(area))}</dd></div>
      <div><dt>carga verificada</dt><dd>${asGW(area.load)}</dd></div>${sources}${destination}</dl></details>`;
  }).join('');
  const links = reading.links.filter(link => link.mw > 0).map(link =>
    `<li><span>${shortNames[link.from]} <span aria-label="para">→</span> ${shortNames[link.to]}</span><strong>${asGW(link.mw)}</strong></li>`).join('');
  const circuits = corridors.map(corridor => corridor.traces.map(trace => `<li>${editorialCase(trace.name)}</li>`).join('')).join('');
  return `<p class="exchange-key"><span><b class="exchange-positive">+</b> saída líquida</span><span><b class="exchange-negative">−</b> entrada líquida</span></p>
    ${regions}<details class="exchange-links"><summary>intercâmbios verificados</summary>
    <ul>${links || '<li>sem intercâmbio líquido nas fronteiras</li>'}</ul></details>
    <details class="exchange-circuits"><summary>linhas de fronteira destacadas</summary><ul>${circuits || '<li>sem linhas de fronteira com os filtros atuais</li>'}</ul></details>`;
}

function projectTrace(coordinates, project, backwards) {
  const points = coordinates.map(project);
  if (backwards) points.reverse();
  const path = new Path2D();
  path.moveTo(points[0].x, points[0].y);
  const segments = [];
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const { x, y } = points[i - 1];
    const dx = points[i].x - x, dy = points[i].y - y;
    path.lineTo(points[i].x, points[i].y);
    const span = Math.hypot(dx, dy);
    if (span) segments.push({ x, y, dx, dy, span, start: length });
    length += span;
  }
  const target = length * .64;
  const segment = segments.find(part => part.start + part.span >= target);
  if (length < 14 || !segment) return { path };
  const t = (target - segment.start) / segment.span;
  return { path, marker: { x: segment.x + t * segment.dx, y: segment.y + t * segment.dy,
    angle: Math.atan2(segment.dy, segment.dx) } };
}

export function initMapFlow(panel, onToggle, loadTransmission) {
  const canvas = panel.querySelector('#flow-map');
  const ctx = canvas.getContext('2d');
  const button = panel.querySelector('#map-flow-toggle');
  const controls = panel.querySelector('#map-flow-panel');
  const reference = panel.querySelector('#map-flow-reference');
  const details = panel.querySelector('#map-flow-data');
  const coverage = panel.querySelector('#map-flow-coverage');
  const periodButtons = [...controls.querySelectorAll('[data-flow-period]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let data, camera, palette, frame, period = 'dia', active = false, inView = true;
  let filters = { voltage: 'all', current: 'all' }, corridors = [], traces = [], delivery = [];
  let transmission, stations, network, stationPositions;
  let neutralAC, neutralDC, activeLines = [];
  let borders = [], destinations = new Map();

  function project([x, y]) {
    return { x: camera.left + x * camera.scale, y: camera.top - y * camera.scale };
  }

  function projectPeriod() {
    if (!active || !camera || !data) return;
    traces = borders.map(({ trace, backwards }, i) => ({
      ...projectTrace(trace.coordinates, project, backwards), phase: i * 4 % 18
    }));
    const sections = [...destinations.values()].flatMap(routes => routes.flatMap(route => route.sections));
    const unique = new Map(sections.map(section => [`${section.name}/${section.coordinates[0]}`, section]));
    delivery = [...unique.values()].map(section => projectTrace(section.coordinates, project, false));
  }

  function loadNetwork() {
    activeLines = transmission.filter(item => Number(item.attributes.tensao) >= 500 && matchesLine(item, filters));
    corridors = locateCorridors(activeLines);
    const blocked = new Set(corridors.flatMap(corridor => corridor.traces.map(trace => trace.name)));
    network = buildTransmissionNetwork(activeLines, stations, blocked);
    neutralAC = new Path2D();
    neutralDC = new Path2D();
    for (const line of activeLines) {
      const path = isHVDC(line) ? neutralDC : neutralAC;
      for (const part of line.coords) {
        if (part.length < 2) continue;
        path.moveTo(part[0][0], -part[0][1]);
        for (let i = 1; i < part.length; i++) path.lineTo(part[i][0], -part[i][1]);
      }
    }
  }

  function updateDestinations(reading) {
    const keys = new Map(corridors.map(corridor => [corridor.key, corridor]));
    destinations = new Map();
    borders = [];
    for (const link of reading.links) {
      if (!link.mw) continue;
      const corridor = keys.get(corridorKey(link.from, link.to));
      if (!corridor) continue;
      const backwards = corridor.from !== link.from;
      borders.push(...corridor.traces.map(trace => ({ trace, backwards })));
      if (balance(reading.regions[link.to]) >= 0) continue;
      const entries = corridor.traces.map(trace => backwards ? trace.coordinates[0] : trace.coordinates.at(-1));
      const route = network.findRoute(link.to, entries);
      if (route) destinations.set(link.to, [...(destinations.get(link.to) || []), route]);
    }
  }

  function draw(time = 0) {
    frame = undefined;
    if (!active || !camera || !data) return;
    const { width, height, ratio } = camera;
    const reading = data[period];
    const motion = !reduced.matches;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.save();
    ctx.transform(camera.scale, 0, 0, camera.scale, camera.left, camera.top);
    ctx.globalAlpha = motion ? .35 + .13 * Math.sin(time / 600) : .38;
    ctx.strokeStyle = palette.flow;
    ctx.lineWidth = 1.05 / camera.scale;
    ctx.setLineDash([]);
    ctx.stroke(neutralAC);
    ctx.strokeStyle = palette.delivery;
    ctx.setLineDash([7, 3, 2, 3].map(step => step / camera.scale));
    ctx.stroke(neutralDC);
    ctx.restore();

    ctx.setLineDash([]);
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 4.5;
    for (const { path } of traces) ctx.stroke(path);
    for (const { path } of delivery) ctx.stroke(path);
    ctx.strokeStyle = palette.flow;
    ctx.lineWidth = 2.4;
    ctx.setLineDash([10, 8]);
    for (const { path, phase } of traces) {
      ctx.lineDashOffset = (motion ? -(time * .055 % 18) : 0) + phase;
      ctx.stroke(path);
    }
    ctx.strokeStyle = palette.delivery;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = motion ? -(time * .055 % 10) : 0;
    for (const { path } of delivery) ctx.stroke(path);
    ctx.setLineDash([]);
    for (const { marker } of traces) {
      if (!marker) continue;
      const { x, y, angle } = marker;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, -4);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = palette.outline;
      ctx.stroke();
      ctx.fillStyle = palette.flow;
      ctx.fill();
      ctx.restore();
    }

    for (const { id } of REGIONS) {
      const point = stationPositions.get(targets[id].station);
      if (!point) continue;
      const route = destinations.get(id)?.[0];
      const { x, y } = project(route?.sections.at(-1)?.coordinates.at(-1) || point);
      const state = signed(balance(reading.regions[id]));
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.fillStyle = palette.surface;
      ctx.strokeStyle = palette[state.type];
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = palette[state.type];
      ctx.font = '700 13px Geist, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.sign, x, y + 1);
      const labelX = Math.min(width - 50, Math.max(45, x)), labelY = y + 20;
      ctx.font = '650 12px Geist, sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = palette.surface;
      ctx.strokeText(targets[id].city, labelX, labelY);
      ctx.fillStyle = palette.ink;
      ctx.fillText(targets[id].city, labelX, labelY);
    }
    if (motion && inView && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function redraw() {
    cancelAnimationFrame(frame);
    if (active) draw(performance.now());
  }

  function setPeriod(id) {
    period = id;
    for (const control of periodButtons) control.setAttribute('aria-pressed', String(control.dataset.flowPeriod === id));
    const reading = data?.[period];
    if (!reading) return;
    const overdue = Date.now() - Date.parse(reading.end) > 4 * 86400000;
    reference.textContent = `${dateTime(reading.start)} a ${dateTime(reading.end)} · brasília · médias do ONS${overdue ? ' · última leitura disponível' : ''}`;
    updateDestinations(reading);
    const hvdcCount = activeLines.filter(isHVDC).length;
    coverage.textContent = activeLines.length ?
      `${number(activeLines.length, 0)} traçados de 500 kV ou mais · ${number(hvdcCount, 0)} HVDC. as rotas em roxo ilustram o caminho até a subestação.` :
      'nenhuma linha de 500 kV ou mais com os filtros atuais.';
    details.innerHTML = summarizePeriod(reading, corridors, destinations);
    projectPeriod();
    redraw();
  }

  button.addEventListener('click', async () => {
    active = !active;
    button.setAttribute('aria-pressed', String(active));
    controls.hidden = !active;
    canvas.hidden = !active;
    onToggle(active);
    if (active && !data) {
      button.disabled = true;
      reference.textContent = 'carregando as médias do ONS…';
      try {
        const [published, layers] = await Promise.all([getJSON('./data/intercambios.json'), loadTransmission()]);
        [transmission, stations] = layers;
        stationPositions = new Map(stations.map(station => [station.attributes.nome, station.coords]));
        loadNetwork();
        data = published;
      } catch {
        reference.textContent = 'dados indisponíveis. feche e reabra o painel para tentar novamente.';
      } finally {
        button.disabled = false;
      }
    }
    if (active) setPeriod(period);
    else cancelAnimationFrame(frame);
  });

  for (const control of periodButtons) {
    control.addEventListener('click', () => setPeriod(control.dataset.flowPeriod));
  }
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    redraw();
  });
  observer.observe(panel);
  reduced.addEventListener('change', redraw);
  document.addEventListener('visibilitychange', redraw);
  return {
    get active() { return active; },
    setFilters(next) {
      filters = next;
      if (!data) return;
      loadNetwork();
      if (active) setPeriod(period);
    },
    sync(view, color) {
      camera = view;
      palette = {
        flow: color('--flow-line'), delivery: color('--plot-purple'), outline: color('--flow-shadow'), surface: color('--surface'), ink: color('--ink'),
        positive: color('--plot-green'), negative: color('--plot-orange'), neutral: color('--ink')
      };
      const w = Math.round(view.width * view.ratio), h = Math.round(view.height * view.ratio);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      projectPeriod();
      redraw();
    }
  };
}

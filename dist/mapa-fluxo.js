import { dateTime, getJSON, number, REGIONS, SOURCES } from './data.js';
import { editorialCase } from './texto.js';

const positions = {
  norte: [-57, -5.3],
  nordeste: [-39.6, -8.9],
  sudesteECentroOeste: [-48.3, -19],
  sul: [-51.3, -28.4]
};
const shortNames = Object.fromEntries(REGIONS.map(region => [region.id, editorialCase(region.short)]));
const asGW = mw => `${number(mw / 1000, 2)} GW`;
const generation = region => Object.values(region.sources).reduce((sum, value) => sum + value, 0);
const balance = region => Math.round((generation(region) - region.load) * 1000) / 1000;

function signed(mw) {
  if (Math.abs(mw) < .001) return { sign: '=', label: 'equilíbrio', type: 'neutral' };
  return mw > 0 ? { sign: '+', label: 'excedente', type: 'positive' } :
    { sign: '−', label: 'déficit', type: 'negative' };
}

function summarizePeriod(reading) {
  const regions = REGIONS.map(({ id }) => {
    const area = reading.regions[id];
    const mw = balance(area);
    const state = signed(mw);
    const sources = SOURCES.filter(source => source.id in area.sources).map(source =>
      `<div><dt>${editorialCase(source.name)}</dt><dd>${asGW(area.sources[source.id])}</dd></div>`).join('');
    return `<details class="exchange-region"><summary><span>${shortNames[id]}</span>
      <strong class="exchange-${state.type}"><span class="sr-only">${state.label}: </span>${state.sign === '=' ? '' : state.sign}${asGW(Math.abs(mw))}</strong></summary>
      <dl><div><dt>geração total</dt><dd>${asGW(generation(area))}</dd></div>
      <div><dt>carga verificada</dt><dd>${asGW(area.load)}</dd></div>${sources}</dl></details>`;
  }).join('');
  const links = reading.links.filter(link => link.mw > 0).map(link =>
    `<li><span>${shortNames[link.from]} <span aria-label="para">→</span> ${shortNames[link.to]}</span><strong>${asGW(link.mw)}</strong></li>`).join('');
  return `<p class="exchange-key"><span><b class="exchange-positive">+</b> saída líquida</span><span><b class="exchange-negative">−</b> entrada líquida</span></p>
    ${regions}<details class="exchange-links"><summary>intercâmbios verificados</summary>
    <ul>${links || '<li>sem intercâmbio líquido nas fronteiras</li>'}</ul></details>`;
}

export function initMapFlow(panel, onToggle) {
  const canvas = panel.querySelector('#flow-map');
  const ctx = canvas.getContext('2d');
  const button = panel.querySelector('#map-flow-toggle');
  const controls = panel.querySelector('#map-flow-panel');
  const reference = panel.querySelector('#map-flow-reference');
  const details = panel.querySelector('#map-flow-data');
  const periodButtons = [...controls.querySelectorAll('[data-flow-period]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let data, camera, palette, frame, period = 'dia', active = false, inView = true;

  function draw(time = 0) {
    frame = undefined;
    if (!active || !camera || !data) return;
    const { width, height, ratio, left, top, scale } = camera;
    const reading = data[period];
    const screenPoint = ([x, y]) => ({ x: left + x * scale, y: top - y * scale });
    const motion = !reduced.matches;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const { from, to, mw } of reading.links) {
      if (mw <= 0) continue;
      const start = screenPoint(positions[from]), end = screenPoint(positions[to]);
      const dx = end.x - start.x, dy = end.y - start.y;
      const facingNorth = start.y < end.y || (start.y === end.y && start.x < end.x);
      const bend = facingNorth ? .14 : -.14;
      const middle = { x: (start.x + end.x) / 2 - dy * bend, y: (start.y + end.y) / 2 + dx * bend };
      const line = new Path2D();
      line.moveTo(start.x, start.y);
      line.quadraticCurveTo(middle.x, middle.y, end.x, end.y);
      const lineWidth = Math.min(7, 1.7 + mw / 1500);
      ctx.setLineDash([]);
      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = lineWidth + 3;
      ctx.stroke(line);
      ctx.strokeStyle = palette.flow;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([12, 10]);
      ctx.lineDashOffset = motion ? -(time * .060 % 22) : 0;
      ctx.stroke(line);
      ctx.setLineDash([]);

      const t = .68, u = 1 - t;
      const x = u * u * start.x + 2 * u * t * middle.x + t * t * end.x;
      const y = u * u * start.y + 2 * u * t * middle.y + t * t * end.y;
      const angle = Math.atan2(u * (middle.y - start.y) + t * (end.y - middle.y),
        u * (middle.x - start.x) + t * (end.x - middle.x));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-5, -6);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = palette.outline;
      ctx.stroke();
      ctx.fillStyle = palette.flow;
      ctx.fill();
      ctx.restore();
    }

    for (const { id } of REGIONS) {
      const { x, y } = screenPoint(positions[id]);
      const state = signed(balance(reading.regions[id]));
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.fillStyle = palette.surface;
      ctx.strokeStyle = palette[state.type];
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = palette[state.type];
      ctx.font = '700 17px Geist, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.sign, x, y + 1);
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
    details.innerHTML = summarizePeriod(reading);
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
        data = await getJSON('./data/intercambios.json');
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
    sync(view, color) {
      camera = view;
      palette = {
        flow: color('--flow-line'), outline: color('--flow-shadow'), surface: color('--surface'),
        positive: color('--plot-green'), negative: color('--plot-orange'), neutral: color('--ink')
      };
      const w = Math.round(view.width * view.ratio), h = Math.round(view.height * view.ratio);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      redraw();
    }
  };
}

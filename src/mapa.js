import { getJSON, number, REGIONS } from './data.js';
import { editorialCase } from './texto.js';
import { initFullscreen } from './tela-cheia.js';

const metadataUrl = './data/mapa/camadas.json';
const regionIds = { N: 'norte', NE: 'nordeste', 'SE-CO': 'sudesteECentroOeste', S: 'sul' };
const labels = {
  nome: 'nome', localidade: 'localidade', uf: 'UF', subsistee: 'subsistema',
  municipio: 'município', tensao: 'tensão (kV)', extensao: 'extensão (km)', potencia: 'potência (kW)',
  concession: 'concessionária', ano_opera: 'ano de operação', ano_planej: 'ano planejado',
  ano_prev: 'ano previsto', ini_oper: 'início da operação', rio: 'rio', ceg: 'CEG',
  combust: 'combustível', distribuid: 'distribuidora', reg_geog: 'região geográfica'
};
const layerColors = {
  transmissão: '--map-line', subestações: '--map-station', 'sistemas isolados': '--map-isolated',
  UHE: '--hydro', PCH: '--hydro', CGH: '--hydro', eólicas: '--wind', solares: '--solar',
  biomassa: '--wind', 'térmicas fósseis': '--thermal', nucleares: '--thermal'
};

function makePath(parts) {
  const path = new Path2D();
  for (const part of parts) {
    if (!part.length) continue;
    path.moveTo(part[0][0], -part[0][1]);
    for (const [x, y] of part.slice(1)) path.lineTo(x, -y);
  }
  return path;
}

function bounds(parts) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const part of parts) for (const [x, y] of part) {
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  return { left, right, top, bottom };
}

function hasPoint(parts, x, y) {
  let inside = false;
  for (const part of parts) for (let i = 0, j = part.length - 1; i < part.length; j = i++) {
    const [a, b] = part[i], [c, d] = part[j];
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) inside = !inside;
  }
  return inside;
}

function distanceToLine(parts, x, y, limit) {
  let minimum = limit;
  for (const part of parts) for (let i = 1; i < part.length; i++) {
    const [ax, ay] = part[i - 1], [bx, by] = part[i];
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    minimum = Math.min(minimum, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return minimum;
}

export function initMap(selectRegion) {
  const canvas = document.querySelector('#grid-map');
  const ctx = canvas.getContext('2d');
  const panel = canvas.closest('.map-panel');
  const wrap = canvas.parentElement;
  const feedback = document.querySelector('#map-feedback');
  const mapRegion = document.querySelector('#map-region');
  const mapMode = document.querySelector('#map-mode');
  const menu = document.querySelector('#map-layers');
  const feature = document.querySelector('#map-feature');
  const fullButton = document.querySelector('#map-fullscreen');
  const layersDisclosure = menu.closest('details');
  const selectedLayers = new Set(['transmissão', 'UHE', 'eólicas', 'solares']);
  const requests = new Map();
  const loaded = new Map();
  let regions = [], layers = [], visible = [], region = mapRegion.value;
  let offsetX = 0, offsetY = 0, zoom = 1, frame = 0, revision = 0;
  let camera = { scale: 1, left: 0, top: 0 };
  let drag = null;

  function resetCamera() {
    offsetX = offsetY = 0;
    zoom = 1;
    scheduleDraw();
  }

  function scheduleDraw() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function draw() {
    frame = 0;
    const width = wrap.clientWidth, height = wrap.clientHeight;
    if (!width || !height || !ctx) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const style = getComputedStyle(panel);
    const color = key => style.getPropertyValue(key).trim();
    const scale = Math.min(width / 43, height / 44) * zoom;
    const left = width / 2 + 54.2 * scale + offsetX;
    const top = height / 2 - 14.6 * scale + offsetY;
    camera = { scale, left, top };
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = color('--map-grid');
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 24; i < width; i += 26) { ctx.moveTo(i, 0); ctx.lineTo(i, height); }
    for (let i = 24; i < height; i += 26) { ctx.moveTo(0, i); ctx.lineTo(width, i); }
    ctx.stroke();
    ctx.transform(scale, 0, 0, scale, left, top);
    ctx.lineJoin = 'round';
    for (const area of regions) {
      ctx.fillStyle = area.region === region ? color('--map-selected') : color('--map-land');
      ctx.strokeStyle = color('--map-border');
      ctx.lineWidth = 0.65 / scale;
      ctx.fill(area.path, 'evenodd');
      ctx.stroke(area.path);
    }
    const active = new Path2D();
    if (region !== 'brasil') for (const area of regions) if (area.region === region) active.addPath(area.path);
    const drawFeatures = () => {
      for (const item of visible) {
        ctx.strokeStyle = ctx.fillStyle = color(item.layer.mode === 'planejada' ? '--map-planned' : layerColors[item.layer.name]);
        if (item.layer.kind === 'line') {
          ctx.lineWidth = (item.layer.mode === 'planejada' ? 1.1 : .82) / scale;
          ctx.setLineDash(item.layer.mode === 'planejada' ? [3 / scale, 2 / scale] : []);
          ctx.stroke(item.path);
        } else {
          const radius = (zoom > 2 ? 2.7 : 1.8) / scale;
          ctx.beginPath();
          ctx.arc(item.coords[0], -item.coords[1], radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    ctx.globalAlpha = region === 'brasil' ? .82 : .14;
    drawFeatures();
    if (region !== 'brasil') {
      ctx.save();
      ctx.clip(active, 'evenodd');
      ctx.globalAlpha = 1;
      drawFeatures();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  function loadLayer(layer) {
    if (!requests.has(layer.id)) {
      const task = getJSON(`./data/mapa/${layer.id}.json`).then(rows => {
        const items = rows.map(([coords, attributes]) => ({
          coords, attributes, layer,
          region: regionIds[attributes.subsistee],
          path: layer.kind !== 'point' ? makePath(coords) : null,
          bounds: layer.kind !== 'point' ? bounds(coords) : null
        }));
        loaded.set(layer.id, items);
        return items;
      });
      requests.set(layer.id, task);
      task.catch(() => requests.delete(layer.id));
    }
    return requests.get(layer.id);
  }

  async function renderLayers() {
    if (!layers.length) return;
    const token = ++revision;
    menu.dataset.mode = mapMode.value;
    const chosen = layers.filter(layer => layer.kind !== 'polygon' && selectedLayers.has(layer.name) &&
      (layer.mode === 'neutra' || mapMode.value === 'todas' || layer.mode === mapMode.value));
    panel.setAttribute('aria-busy', 'true');
    feedback.hidden = true;
    const results = await Promise.allSettled(chosen.map(loadLayer));
    if (token !== revision) return;
    visible = chosen.flatMap(layer => loaded.get(layer.id) || []);
    const failures = results.filter(x => x.status === 'rejected').length;
    showFeedback(failures === 1 ? 'uma camada indisponível' : failures ? `${failures} camadas indisponíveis` : '');
    scheduleDraw();
  }

  function showFeedback(message) {
    panel.setAttribute('aria-busy', 'false');
    feedback.textContent = message;
    feedback.hidden = !message;
  }

  function showFeature(item) {
    feature.replaceChildren();
    feature.hidden = !item;
    if (!item) return;
    const title = document.createElement('strong');
    title.textContent = editorialCase(item.attributes.nome || item.attributes.localidade || item.layer.name);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'control';
    close.textContent = 'fechar';
    close.addEventListener('click', () => { feature.hidden = true; canvas.focus(); });
    const heading = document.createElement('div');
    heading.append(title, close);
    const text = document.createElement('p');
    text.textContent = editorialCase(`${item.layer.name} · ${item.layer.mode === 'neutra' ? 'cadastro' : item.layer.mode}`);
    const properties = document.createElement('dl');
    for (const [key, value] of Object.entries(item.attributes)) {
      if (['nome', 'localidade'].includes(key)) continue;
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = labels[key] || key;
      dd.textContent = typeof value === 'number' ? number(value, Number.isInteger(value) ? 0 : 2) : editorialCase(value);
      properties.append(dt, dd);
    }
    feature.append(heading, text, properties);
  }

  function pick(px, py) {
    const { scale, left, top } = camera;
    const x = (px - left) / scale, y = (top - py) / scale;
    let hit = null, distance = 9 / scale;
    for (const item of visible) {
      if (item.layer.kind !== 'point') continue;
      const value = Math.hypot(x - item.coords[0], y - item.coords[1]);
      if (value < distance) { hit = item; distance = value; }
    }
    if (!hit) {
      distance = 6 / scale;
      for (const item of visible) {
        const box = item.bounds;
        if (!box || x < box.left - distance || x > box.right + distance || y < box.top - distance || y > box.bottom + distance) continue;
        const value = distanceToLine(item.coords, x, y, distance);
        if (value < distance) { hit = item; distance = value; }
      }
    }
    if (hit) { showFeature(hit); return; }
    showFeature(null);
    const area = regions.find(({ bounds: b, coords }) => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom && hasPoint(coords, x, y));
    if (area?.region) selectRegion(area.region);
  }

  function changeZoom(factor, x = wrap.clientWidth / 2, y = wrap.clientHeight / 2) {
    const next = Math.min(14, Math.max(.65, zoom * factor));
    const ratio = next / zoom;
    offsetX = (offsetX + wrap.clientWidth / 2 - x) * ratio + x - wrap.clientWidth / 2;
    offsetY = (offsetY + wrap.clientHeight / 2 - y) * ratio + y - wrap.clientHeight / 2;
    zoom = next;
    scheduleDraw();
  }

  let previouslyOpen;
  initFullscreen(fullButton, active => {
    if (active) previouslyOpen = layersDisclosure.open;
    layersDisclosure.open = active || previouslyOpen;
    scheduleDraw();
  });
  for (const [id, factor] of [['map-add', 1.35], ['map-sub', 1 / 1.35]]) {
    document.querySelector('#' + id).addEventListener('click', () => changeZoom(factor));
  }
  document.querySelector('#map-reset').addEventListener('click', resetCamera);
  canvas.addEventListener('keydown', event => {
    const moves = { ArrowUp: [0, 30], ArrowDown: [0, -30], ArrowLeft: [30, 0], ArrowRight: [-30, 0] };
    if (!moves[event.key]) return;
    event.preventDefault();
    offsetX += moves[event.key][0];
    offsetY += moves[event.key][1];
    scheduleDraw();
  });
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: offsetX, dy: offsetY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    offsetX = drag.dx + event.clientX - drag.x;
    offsetY = drag.dy + event.clientY - drag.y;
    scheduleDraw();
  });
  canvas.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId) return;
    const box = canvas.getBoundingClientRect();
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) pick(event.clientX - box.left, event.clientY - box.top);
    drag = null;
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey && fullButton.getAttribute('aria-pressed') !== 'true') return;
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.offsetX, event.offsetY);
  }, { passive: false });
  mapRegion.addEventListener('change', () => selectRegion(mapRegion.value));
  mapMode.addEventListener('change', () => { showFeature(null); renderLayers(); });
  new ResizeObserver(scheduleDraw).observe(wrap);
  document.addEventListener('themechange', scheduleDraw);
  getJSON(metadataUrl).then(async catalog => {
    layers = catalog;
    const layer = layers.find(item => item.kind === 'polygon');
    regions = await loadLayer(layer);
    const categories = new Map(layers.filter(item => item.kind !== 'polygon').map(item => [item.name, item]));
    const planned = document.createElement('p');
    planned.className = 'planned-key';
    planned.innerHTML = '<i aria-hidden="true"></i>expansão planejada';
    menu.append(planned);
    for (const [name, layer] of categories) {
      const label = document.createElement('label'), input = document.createElement('input');
      const swatch = document.createElement('i');
      swatch.style.setProperty('--swatch', `var(${layerColors[name]})`);
      label.dataset.kind = layer.kind;
      label.classList.toggle('legend-neutral', layer.mode === 'neutra');
      input.type = 'checkbox';
      input.checked = selectedLayers.has(name);
      input.addEventListener('change', () => {
        if (input.checked) selectedLayers.add(name); else selectedLayers.delete(name);
        showFeature(null);
        renderLayers();
      });
      label.append(input, swatch, editorialCase(name));
      menu.append(label);
    }
    await renderLayers();
  }).catch(() => showFeedback('mapa indisponível no momento'));

  return {
    setRegion(id) {
      region = id;
      mapRegion.value = id;
      showFeature(null);
      canvas.setAttribute('aria-label', `rede elétrica da EPE · ${editorialCase(REGIONS.find(r => r.id === id)?.name || 'SIN')}. use as setas para deslocar.`);
      scheduleDraw();
    }
  };
}

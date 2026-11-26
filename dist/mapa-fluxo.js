import { getJSON, number } from './data.js';
import { editorialCase } from './texto.js';

export function initMapFlow(panel, onToggle) {
  const canvas = panel.querySelector('#flow-map');
  const ctx = canvas.getContext('2d');
  const button = panel.querySelector('#map-flow-toggle');
  const ranking = panel.querySelector('#flow-ranking');
  const list = panel.querySelector('#flow-plants');
  const feedback = panel.querySelector('#map-feedback');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let plants, camera, palette, frame, selected = -1, active = false, inView = true;

  const draw = (time = 0) => {
    frame = undefined;
    if (!active || !camera) return;
    const { width, height, ratio, left, top, scale } = camera;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const motion = !reduced.matches;
    plants.forEach((plant, i) => {
      if (selected >= 0 && selected !== i) return;
      const tone = plant.source === 'nuclear' ? palette.nuclear : palette.hydro;
      ctx.save();
      ctx.transform(scale, 0, 0, scale, left, top);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = palette.shadow;
      ctx.lineWidth = 4.6 / scale;
      ctx.stroke(plant.path);
      ctx.strokeStyle = tone;
      ctx.lineWidth = 2.2 / scale;
      ctx.setLineDash([8 / scale, 9 / scale]);
      ctx.lineDashOffset = motion ? -(time * .045 % 17) / scale : 0;
      ctx.stroke(plant.path);
      ctx.restore();
    });
    plants.forEach((plant, i) => {
      if (selected >= 0 && selected !== i) return;
      const [x, y] = plant.coordinates;
      const px = left + x * scale, py = top - y * scale;
      ctx.fillStyle = palette.labelSurface;
      ctx.strokeStyle = plant.source === 'nuclear' ? palette.nuclear : palette.hydro;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = palette.ink;
      ctx.font = '700 11px Geist, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), px, py + .5);
    });
    if (motion && inView && !document.hidden) frame = requestAnimationFrame(draw);
  };

  function redraw() {
    cancelAnimationFrame(frame);
    if (active) draw(performance.now());
  }

  async function load() {
    const raw = await getJSON('./data/mapa/geradores-experimento.json');
    const fragment = document.createDocumentFragment();
    const result = raw.map((plant, i) => {
      const path = new Path2D();
      for (const [start, ...points] of plant.paths) {
        path.moveTo(start[0], -start[1]);
        for (const [x, y] of points) path.lineTo(x, -y);
      }
      const item = document.createElement('li'), choice = document.createElement('button');
      choice.type = 'button';
      choice.setAttribute('aria-pressed', 'false');
      const title = document.createElement('span');
      title.textContent = editorialCase(plant.name);
      const kind = document.createElement('small');
      kind.textContent = `${plant.source} · ${plant.uf}`;
      const value = document.createElement('strong');
      value.textContent = `${number(plant.gwh, Number.isInteger(plant.gwh) ? 0 : 1)} GWh`;
      choice.append(title, kind, value);
      choice.addEventListener('click', () => {
        selected = selected === i ? -1 : i;
        [...list.querySelectorAll('button')].forEach((entry, index) => entry.setAttribute('aria-pressed', String(selected === index)));
        redraw();
      });
      item.append(choice);
      fragment.append(item);
      return { ...plant, path };
    });
    list.replaceChildren(fragment);
    return result;
  }

  button.addEventListener('click', async () => {
    if (!plants) {
      button.disabled = true;
      try {
        plants = await load();
      } catch {
        feedback.textContent = 'experimento de fluxo indisponível. tente novamente.';
        feedback.hidden = false;
        return;
      } finally {
        button.disabled = false;
      }
    }
    if (feedback.textContent.startsWith('experimento de fluxo')) feedback.hidden = true;
    active = !active;
    button.setAttribute('aria-pressed', String(active));
    ranking.hidden = !active;
    ranking.open = active;
    canvas.hidden = !active;
    onToggle(active);
    redraw();
  });

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
      palette = { hydro: color('--flow-hydro'), nuclear: color('--flow-nuclear'), shadow: color('--flow-shadow'),
        labelSurface: color('--surface'), ink: color('--ink') };
      const w = Math.round(view.width * view.ratio), h = Math.round(view.height * view.ratio);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      redraw();
    }
  };
}

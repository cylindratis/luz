import { readFile, writeFile } from 'node:fs/promises';

const map = new URL('../src/data/mapa/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name + '.json', map), 'utf8'));
const catalog = await read('camadas');
const layer = (name, mode) => read(catalog.find(item => item.name === name && item.mode === mode).id);
const [states, hydro, nuclear, lines] = await Promise.all([
  layer('limites do SIN', 'neutra'), layer('UHE', 'existente'), layer('nucleares', 'existente'), layer('transmissão', 'existente')
]);
const save = (file, value) => writeFile(new URL(file + '.json', map), JSON.stringify(value) + '\n');

function shape(parts) {
  const flatten = parts.flat();
  const west = Math.min(...flatten.map(p => p[0])), east = Math.max(...flatten.map(p => p[0]));
  const south = Math.min(...flatten.map(p => p[1])), north = Math.max(...flatten.map(p => p[1]));
  const scale = 120 / (north - south);
  const width = 10 + (east - west) * scale;
  const path = parts.map(part => {
    let last = part[0];
    const simplified = [last, ...part.slice(1, -1).filter(point => {
      if (Math.hypot(point[0] - last[0], point[1] - last[1]) < .1) return false;
      last = point;
      return true;
    }), part.at(-1)];
    if (simplified.length < 4) return '';
    return 'M' + simplified.map(([x,y]) => [(5 + (x-west)*scale).toFixed(1), (5 + (north-y)*scale).toFixed(1)].join(',')).join('L') + 'Z';
  }).join('');
  return { width: Number(width.toFixed(1)), path };
}

const subsystems = { norte: 'N', nordeste: 'NE', sudesteECentroOeste: 'SE-CO', sul: 'S' };
await save('medidores-ear', Object.fromEntries(Object.entries(subsystems).map(([id, code]) => [
  id, shape(states.filter(([, fields]) => fields.subsistee === code).flatMap(([parts]) => parts))
])));

const ranking = [
  ['Itaipu (Parte Brasileira)', 'PR', 5128.8],
  ['Tucuruí', 'PA', 1513.7],
  ['Xingó', 'SE', 1119.5],
  ['Ilha Solteira', 'SP', 1056.2],
  ['Almirante Álvaro Alberto - Unidade II (Antiga Angra II)', 'RJ', 1009.4],
  ['Governador Bento Munhoz da Rocha Netto (Foz do Areia)', 'PR', 886],
  ['Itá', 'RS', 878.5],
];

function nearest(coords, points) {
  const longitudeFactor = Math.cos(coords[1] * Math.PI / 180);
  const xy = ([x,y]) => [(x - coords[0]) * 111.2 * longitudeFactor, (y - coords[1]) * 111.2];
  let distance = Infinity, index = 0, point = points[0];
  for (let i = 1; i < points.length; i++) {
    const [x,y] = xy(points[i-1]), [bx,by] = xy(points[i]);
    const dx = bx - x, dy = by - y;
    const span = dx * dx + dy * dy;
    const t = span ? Math.max(0, Math.min(1, -(x * dx + y * dy) / span)) : 0;
    const d = Math.hypot(x + t * dx, y + t * dy);
    if (d >= distance) continue;
    distance = d;
    index = i;
    point = [0,1].map(axis => points[i-1][axis] + t * (points[i][axis] - points[i-1][axis]));
  }
  return { distance, index, point };
}

const generators = ranking.map(([name, uf, gwh]) => {
  const nuclearPlant = nuclear.find(([, fields]) => fields.nome === name);
  const [coordinates] = nuclearPlant || hydro.find(([, fields]) => fields.nome === name);
  const routes = lines.flatMap(([parts, fields]) => parts.filter(p => p.length >= 2)
    .map(points => {
      const { distance, index, point } = nearest(coordinates, points);
      const paths = [[point, ...points.slice(0,index).reverse()], [point, ...points.slice(index)]]
        .filter(path => path.reduce((length, p, i) => i ? length + Math.hypot(p[0] - path[i-1][0], p[1] - path[i-1][1]) : 0, 0) > .12);
      return { name: fields.nome, distance, paths };
    }).filter(route => route.paths.length))
    .filter(route => route.distance <= 35).sort((a,b) => a.distance - b.distance);
  const selected = routes.filter((route, i) => i === routes.findIndex(item => item.name === route.name)).slice(0, 3);
  if (!selected.length) throw new Error('sem linhas próximas de ' + name);
  console.log(name, selected.map(route => route.name + ' (' + route.distance.toFixed(1) + ' km)').join(', '));
  return { name, uf, gwh, source: nuclearPlant ? 'nuclear' : 'hidrelétrica', coordinates, paths: selected.flatMap(route => route.paths) };
});
await save('geradores-experimento', generators);

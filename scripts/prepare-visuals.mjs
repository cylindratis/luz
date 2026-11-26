import { readFile, writeFile } from 'node:fs/promises';

const map = new URL('../src/data/mapa/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name + '.json', map), 'utf8'));
const catalog = await read('camadas');
const layer = (name, mode) => read(catalog.find(item => item.name === name && item.mode === mode).id);
const states = await layer('limites do SIN', 'neutra');
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

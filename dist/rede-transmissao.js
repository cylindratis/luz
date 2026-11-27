export const isHVDC = ({ attributes }) => /\b(CC|HVDC|BIPOLO)\b|±/i.test(attributes.nome || '');

export function matchesLineClass(kv, hvdc, { voltage = 'all', current = 'all' } = {}) {
  return (voltage === 'all' || (voltage === '500+' ? kv >= 500 : kv === Number(voltage))) &&
    (current === 'all' || hvdc === (current === 'hvdc'));
}

export function matchesLine(item, filters) {
  return matchesLineClass(Number(item.attributes.tensao) || 0, isHVDC(item), filters);
}

export const targets = {
  norte: { city: 'manaus', station: 'SE Lechuga' },
  nordeste: { city: 'recife', station: 'SE Recife II' },
  sudesteECentroOeste: { city: 'são paulo', station: 'SE Tijuco Preto' },
  sul: { city: 'porto alegre', station: 'SE Gravataí' }
};

const distance = ([x, y], [a, b]) => 111.2 * Math.hypot((x - a) * Math.cos((y + b) * Math.PI / 360), y - b);

function nearest(nodes, point, maximum) {
  let best;
  for (const node of nodes) {
    const km = distance(node.coordinates, point);
    if (km > maximum) continue;
    maximum = km;
    best = node;
  }
  return best;
}

export function buildTransmissionNetwork(lines, stations, blocked = new Set()) {
  const nodes = [];
  function nodeAt(point) {
    const existing = nearest(nodes, point, 1.15);
    if (existing) return existing;
    const node = { coordinates: point, edges: [] };
    nodes.push(node);
    return node;
  }
  for (const line of lines) {
    if (isHVDC(line) || blocked.has(line.attributes.nome)) continue;
    for (const coordinates of line.coords) {
      if (coordinates.length < 2) continue;
      const start = nodeAt(coordinates[0]), end = nodeAt(coordinates.at(-1));
      if (start === end) continue;
      const length = coordinates.reduce((sum, point, i) => sum + (i ? distance(coordinates[i - 1], point) : 0), 0);
      start.edges.push({ to: end, name: line.attributes.nome, coordinates, length });
      end.edges.push({ to: start, name: line.attributes.nome, coordinates: [...coordinates].reverse(), length });
    }
  }
  const byName = new Map(stations.map(station => [station.attributes.nome, station.coords]));
  return {
    findRoute(region, entries) {
      const target = targets[region], station = byName.get(target.station);
      if (!station) return null;
      const destination = nearest(nodes, station, 1.5);
      const starts = new Set(entries.map(point => nearest(nodes, point, 1.15)).filter(Boolean));
      if (!destination || !starts.size) return null;
      const scores = new Map([...starts].map(node => [node, 0])), pending = new Set(starts), previous = new Map();
      while (pending.size) {
        const node = [...pending].reduce((best, current) => scores.get(current) < scores.get(best) ? current : best);
        pending.delete(node);
        if (node === destination) {
          const sections = [];
          for (let current = node; previous.has(current); ) {
            const { from, edge } = previous.get(current);
            sections.unshift(edge);
            current = from;
          }
          return { sections, station, target };
        }
        for (const edge of node.edges) {
          const score = scores.get(node) + edge.length;
          if (score >= (scores.get(edge.to) ?? Infinity)) continue;
          scores.set(edge.to, score);
          previous.set(edge.to, { from: node, edge });
          pending.add(edge.to);
        }
      }
      return null;
    }
  };
}

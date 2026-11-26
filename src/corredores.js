// Circuitos da camada existente da EPE identificados nas instruções IO-ON do ONS.
// reverse indica que a ordem dos vértices da EPE é oposta ao sentido from → to.
export const corridors = [
  {
    from: 'norte', to: 'nordeste', lines: [
      ['LT 500 kV Presidente Dutra - Boa Esperança, C1'],
      ['LT 500 kV Teresina II - Presidente Dutra, C1', true],
      ['LT 500 kV Teresina II - Presidente Dutra, C2', true],
      ['LT 500 kV Colinas - Ribeiro Gonçalves, C1'],
      ['LT 500 kV Colinas - Ribeiro Gonçalves, C2'],
      ['LT 500 kV Bacabeira - Parnaíba III, C1'],
      ['LT 500 kV Bacabeira - Parnaíba III, C2'],
      ['LT 500 kV Gilbués II - Miracema, C3', true],
    ]
  },
  {
    from: 'norte', to: 'sudesteECentroOeste', lines: [
      ['LT 500 kV Serra da Mesa - Gurupi, C1', true],
      ['LT 500 kV Serra da Mesa - Gurupi, C2', true],
      ['LT 500 kV Peixe 2 - Serra da Mesa 2, C1'],
    ]
  },
  {
    from: 'sudesteECentroOeste', to: 'nordeste', lines: [
      ['LT 500 kV Luziânia - Rio das Éguas, C1'],
      ['LT 500 kV Serra da Mesa 2 - Rio das Éguas, C1'],
      ['LT 500 kV Arinos 2 - Rio das Éguas, C1'],
      ['LT 500 kV Padre Paraíso 2 - Poções III, C1'],
      ['LT 500 kV Padre Paraíso 2 - Poções III, C2'],
      ['LT 500 kV Bom Jesus da Lapa II - Janaúba 3, C1', true],
      ['LT 500 kV Igaporã III - Janaúba 3, C2', true],
      ['LT 500 kV Igaporã III - Serra das Almas II, C1', true],
    ]
  },
  {
    from: 'sul', to: 'sudesteECentroOeste', lines: [
      ['LT 500 kV Ibiúna - Bateias, C1', true],
      ['LT 500 kV Ibiúna - Bateias, C2', true],
      ['LT 500 kV Itatiba - Bateias, C1', true],
      ['LT 765 kV Itaberá - Ivaiporã, C1', true],
      ['LT 765 kV Itaberá - Ivaiporã, C2', true],
      ['LT 765 kV Itaberá - Ivaiporã, C3', true],
      ['LT 525 kV Londrina (ESU) - Assis, C1'],
      ['LT 525 kV Londrina (ESU) - Assis, C2'],
      ['LT 230 kV Assis - Londrina (Copel), C1', true],
      ['LT 230 kV Assis - Londrina (Copel), C2', true],
    ]
  },
];

export const corridorKey = (from, to) => [from, to].sort().join('/');

export function locateCorridors(transmission) {
  const byName = new Map(transmission.map(item => [item.attributes.nome, item.coords]));
  return corridors.map(corridor => ({
    from: corridor.from,
    key: corridorKey(corridor.from, corridor.to),
    traces: corridor.lines.flatMap(([name, reverse]) => {
      const parts = byName.get(name);
      if (parts?.length !== 1 || parts[0].length < 2) return [];
      return [{ name, coordinates: reverse ? [...parts[0]].reverse() : parts[0] }];
    }),
  }));
}

export const BALANCE_URL = 'https://tr.ons.org.br/Content/GetBalancoEnergetico/null';
export const RESERVOIR_URL = 'https://tr.ons.org.br/Content/Get/SituacaoDosReservatorios';
export const REGIONS = [
  { id: 'norte', name: 'Norte', short: 'Norte' },
  { id: 'nordeste', name: 'Nordeste', short: 'Nordeste' },
  { id: 'sudesteECentroOeste', name: 'Sudeste/Centro-Oeste', short: 'Sudeste/CO' },
  { id: 'sul', name: 'Sul', short: 'Sul' }
];
export const SOURCES = [
  { id: 'hidraulica', name: 'Hidráulica', color: '#339bd6', gradient: 'var(--water-gradient)' },
  { id: 'eolica', name: 'Eólica', color: '#00bb31', gradient: 'var(--green-gradient)' },
  { id: 'solar', name: 'Solar', color: '#ffc915', gradient: 'var(--solar-gradient)' },
  { id: 'termica', name: 'Térmica', color: '#e4002b', gradient: 'var(--red-gradient)' },
  { id: 'nuclear', name: 'Nuclear', color: '#a4b5c7', gradient: '#a4b5c7' },
  { id: 'mmgd', name: 'MMGD estimada', color: '#ff9d3d', gradient: '#ff9d3d' }
];
const numeric = (value, name) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Medida inválida: ${name}`);
  return value;
};
export function validateBalance(raw) {
  if (!raw || !Number.isFinite(Date.parse(raw.Data)) || !/[Zz]|[+-]\d{2}:\d{2}$/.test(raw.Data)) throw new Error('Balanço sem horário válido');
  for (const { id } of REGIONS) {
    const region = raw[id];
    numeric(region?.cargaVerificada, `${id}.cargaVerificada`);
    numeric(region?.geracao?.total, `${id}.total`);
    for (const source of SOURCES) numeric(region?.geracao?.[source.id], `${id}.${source.id}`);
    if (region.geracao.total < 0 || region.cargaVerificada < 0) throw new Error('Balanço agregado negativo');
  }
  return raw;
}
export function selectBalance(raw, selection = 'brasil') {
  validateBalance(raw);
  if (selection !== 'brasil' && !REGIONS.some(r => r.id === selection)) throw new Error('Subsistema desconhecido');
  const ids = selection === 'brasil' ? REGIONS.map(r => r.id) : [selection];
  const total = ids.reduce((sum, id) => sum + raw[id].geracao.total, 0);
  const load = ids.reduce((sum, id) => sum + raw[id].cargaVerificada, 0);
  const sources = SOURCES.map(source => ({ ...source, mw: ids.reduce((sum, id) => {
    const g = raw[id].geracao;
    return sum + g[source.id] + (source.id === 'hidraulica' ? (g.itaipu50HzBrasil || 0) + (g.itaipu60Hz || 0) : 0);
  }, 0) }));
  const positive = sources.reduce((sum, s) => sum + Math.max(s.mw, 0), 0);
  for (const source of sources) { source.share = total > 0 ? source.mw / total * 100 : 0; source.barShare = positive > 0 ? Math.max(source.mw, 0) / positive * 100 : 0; }
  return { total, load, sources, date: raw.Data, name: selection === 'brasil' ? 'Brasil' : REGIONS.find(r => r.id === selection).name };
}
export function normalizeReservoirs(raw) {
  if (!Array.isArray(raw) || !raw.length) throw new Error('Reservatórios indisponíveis');
  const byRegion = {};
  for (const row of raw) {
    const name = String(row.Subsistema || '').toLowerCase();
    const id = name.includes('sudeste') ? 'sudesteECentroOeste' : name.includes('nordeste') ? 'nordeste' : name.includes('norte') ? 'norte' : name === 'sul' ? 'sul' : null;
    if (!id || byRegion[id]) continue;
    const percent = numeric(row.SubsistemaValorUtil, 'EAR');
    const sinFraction = numeric(row.SINEARPorcentagem, 'EAR SIN');
    if (percent < 0 || percent > 100 || sinFraction < 0 || sinFraction > 1) throw new Error('EAR fora da escala');
    const date = String(row.Data || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) throw new Error('EAR sem data');
    byRegion[id] = { percent, date, sinPercent: sinFraction * 100 };
  }
  if (REGIONS.some(r => !byRegion[r.id])) throw new Error('Falta um subsistema na EAR');
  const reference = byRegion.norte;
  if (Object.values(byRegion).some(r => r.date !== reference.date)) throw new Error('EAR com datas incompatíveis');
  return { regions: byRegion, sinPercent: reference.sinPercent, date: reference.date };
}
export function freshness(iso, now = Date.now()) {
  const age = now - Date.parse(iso);
  return { age, stale: !Number.isFinite(age) || age > 15 * 60 * 1000 || age < -5 * 60 * 1000 };
}
export async function getJSON(url, timeout = 12000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), cache: 'no-store' });
  if (!response.ok) throw new Error(`Fonte respondeu ${response.status}`);
  return response.json();
}
export const number = (n, digits = 1) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
export function sourcePower(mw) {
  const small = mw !== 0 && Math.abs(mw) < 50;
  return { value: number(small ? mw : mw / 1000, small ? 2 : 1), unit: small ? 'MW' : 'GW' };
}
export const dateTime = iso => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
export const civilDate = iso => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(iso.slice(0, 10) + 'T12:00:00Z'));

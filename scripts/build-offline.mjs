import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BALANCE_URL, RESERVOIR_URL, normalizeReservoirs, validateBalance } from '../src/data.js';

const root = resolve('dist');
const read = (path, encoding) => readFile(resolve(root, path), encoding);
const serialize = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const dataURL = (data, type) => `data:${type};base64,${Buffer.from(data).toString('base64')}`;
const settings = new Set(process.argv.slice(2));
const snapshotKey = './data/curvas-offline.json';

async function embeddedData(directory) {
  const values = {};
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) Object.assign(values, await embeddedData(path));
    else if (path.endsWith('.json')) values['./' + path] = JSON.parse(await read(path, 'utf8'));
  }
  return values;
}

async function capture() {
  const fetchJSON = async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`ONS respondeu HTTP ${response.status}`);
    return response.json();
  };
  const [balance, reservoirs] = await Promise.all([fetchJSON(BALANCE_URL).then(validateBalance), fetchJSON(RESERVOIR_URL)]);
  normalizeReservoirs(reservoirs);
  const period = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const inBrasilia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' });
  const date = new Date(balance.Data);
  if (inBrasilia.format(date) !== inBrasilia.format(new Date())) throw new Error('o balanço ainda não é do dia');
  const [hour, minute] = period.format(date).split(':').map(Number);
  const limit = hour * 60 + minute;
  const allSources = ['Hidraulica', 'Termica', 'Eolica', 'Solar', 'Mmgd', 'Nuclear'];
  const areas = ['SIN', 'Norte', 'Nordeste', 'SudesteECentroOeste', 'Sul'];
  const urls = areas.flatMap(area => allSources.filter(source => source !== 'Nuclear' || ['SIN', 'SudesteECentroOeste'].includes(area))
    .map(source => `https://tr.ons.org.br/Content/Get/Geracao_${area}_${source}`));
  const entries = await Promise.allSettled(urls.map(async url => {
    const reading = await fetchJSON(url);
    const rows = reading.rows?.filter(row => Number.isInteger(row.c?.[0]?.v) && Number.isFinite(row.c?.[1]?.v)) ?? [];
    if (!rows.length || rows.at(-1).c[0].v > limit + 10) throw new Error('série fora da janela da captura');
    // Keep all measured minutes so all source totals use the same time resolution.
    return [url, { rows: rows.filter(row => row.c[0].v <= limit) }];
  }));
  const series = Object.fromEntries(entries.filter(result => result.status === 'fulfilled').map(result => result.value));
  if (urls.some(url => url.includes('Geracao_SIN_') && !series[url]?.rows.length)) throw new Error('séries do SIN incompletas');
  return { curveDate: balance.Data, series, balance, reservoirs };
}

let data = await embeddedData('data');
let snapshot = data[snapshotKey];
delete data[snapshotKey];
if (settings.has('--refresh') || settings.has('--snapshot')) {
  try {
    snapshot = await capture();
    console.log(`captura operacional: ${snapshot.curveDate}, ${Object.keys(snapshot.series).length} séries`);
    if (settings.has('--snapshot')) await writeFile('src/data/curvas-offline.json', JSON.stringify(snapshot) + '\n');
  } catch (error) {
    if (settings.has('--snapshot')) throw error;
    console.warn(`ONS indisponível (${error.message}). Usando a captura embutida.`);
  }
}
if (snapshot) data = {
  ...data, './data/balance.json': snapshot.balance, './data/reservoirs.json': snapshot.reservoirs, ...snapshot.series
};

const fileNames = (await readdir(root)).filter(name => name.endsWith('.js'));
const imports = Object.fromEntries(await Promise.all(fileNames.map(async name => {
  const code = (await read(name, 'utf8')).replace(/(\b(?:from|import)\s+)(['"])\.\/([^'"]+\.js)\2/g, '$1$2luz/$3$2');
  return ['luz/' + name, dataURL(code, 'text/javascript')];
})));

const styles = Object.fromEntries(await Promise.all(['ui.css', 'style.css', 'observatorio.css'].map(async name =>
  [name, await read(name, 'utf8')])));
for (const font of ['geist-sans.woff2', 'geist-mono.woff2', 'geist-pixel.woff2']) {
  styles['style.css'] = styles['style.css'].replace('./assets/' + font, dataURL(await read('assets/' + font), 'font/woff2'));
}
const favicon = dataURL(await read('assets/favicon.svg'), 'image/svg+xml');
const pdfNames = ['ecoind-1.pdf', 'trabalho.pdf'];
const pdf = Object.fromEntries(await Promise.all(pdfNames.map(async name => [
  './assets/' + name, (await read('assets/' + name)).toString('base64')
])));

const bootstrap = `<script type="application/json" id="luz-offline-data">${serialize({ data, curveDate: snapshot?.curveDate, pdf })}</script>
<script>
  const embedded = JSON.parse(document.querySelector('#luz-offline-data').textContent);
  for (const [path, bytes] of Object.entries(embedded.pdf)) {
    const view = Uint8Array.from(atob(bytes), character => character.charCodeAt(0));
    embedded.pdf[path] = URL.createObjectURL(new Blob([view], { type: 'application/pdf' }));
  }
  document.querySelector('#luz-offline-data').remove();
  globalThis.luzOffline = embedded;
</script>
<script type="importmap">${serialize({ imports })}</script>
<script type="module">import "luz/app.js";</script>`;
const html = (await read('index.html', 'utf8'))
  .replace('./assets/favicon.svg', favicon)
  .replace(/\s*<link rel="preload"[^>]*>/g, '')
  .replace(/<link rel="stylesheet" href="\.\/([^"]+)">/g, (_, name) => '<style>' + styles[name] + '</style>')
  .replace('<script type="module" src="./app.js"></script>', () => bootstrap);
await writeFile(resolve(root, 'luz-offline.html'), html);
console.log('Versão autocontida gerada em dist/luz-offline.html');

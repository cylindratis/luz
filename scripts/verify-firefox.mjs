import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firefox } from '../.firefox-qa/node_modules/playwright/index.mjs';
import { corridors, locateCorridors } from '../dist/corredores.js';
import { buildTransmissionNetwork, isHVDC, targets } from '../dist/rede-transmissao.js';

const root = fileURLToPath(new URL('../dist', import.meta.url));
const pictures = new URL('../.firefox-qa/screenshots/', import.meta.url);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(root, path === '/luz/' ? 'index.html' : path.slice(5));
  try {
    if (!path.startsWith('/luz/') || !file.startsWith(root + sep)) throw new Error('invalid path');
    const info = await stat(file);
    if (!info.isFile()) throw new Error('missing file');
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/luz/`;
const fixture = async name => JSON.parse(await readFile(resolve(root, 'data', name), 'utf8'));
const balance = await fixture('balance.json'), reservoirs = await fixture('reservoirs.json');
const cut = await fixture('curtailment.json');
const exchanges = await fixture('intercambios.json');
const layers = await fixture('mapa/camadas.json');
const transmission = layers.find(item => item.kind === 'line' && item.mode === 'existente');
const segments = (await fixture(`mapa/${transmission.id}.json`)).map(([coords, attributes]) => ({ coords, attributes }));
const stationsLayer = layers.find(item => item.name === 'subestações' && item.mode === 'existente');
const stations = (await fixture(`mapa/${stationsLayer.id}.json`)).map(([coords, attributes]) => ({ coords, attributes }));
const highVoltage = segments.filter(item => item.attributes.tensao >= 500);
const matches = locateCorridors(segments);
const byName = new Map(segments.map(segment => [segment.attributes.nome, segment.coords[0]]));
assert.equal(matches.length, 4);
matches.forEach((corridor, i) => {
  assert.equal(corridor.traces.length, corridors[i].lines.length);
  corridor.traces.forEach((trace, j) => {
    const [name, reverse] = corridors[i].lines[j];
    assert.equal(trace.name, name);
    assert.deepEqual(trace.coordinates, reverse ? [...byName.get(name)].reverse() : byName.get(name));
  });
});
const routingCorridors = locateCorridors(highVoltage);
const wantedCircuits = routingCorridors.reduce((count, corridor) => count + corridor.traces.length, 0);
const network = buildTransmissionNetwork(highVoltage, stations, new Set(routingCorridors.flatMap(corridor => corridor.traces.map(trace => trace.name))));
for (const [region, target] of Object.entries(targets)) {
  for (const corridor of routingCorridors.filter(item => item.key.split('/').includes(region))) {
    const entries = corridor.traces.map(trace => corridor.from === region ? trace.coordinates[0] : trace.coordinates.at(-1));
    const path = network.findRoute(region, entries);
    assert.equal(path?.target.station, target.station);
    assert.ok(path.sections.length);
    assert.ok(path.sections.every(part => highVoltage.some(line => line.attributes.nome === part.name && !isHVDC(line))));
  }
}
const day = [cut.reference, balance.Data.slice(0, 10)].sort().at(-1);
const instant = new Date(new Date(`${day}T18:00:00Z`).getTime() + 86400000);
const rows = Array.from({ length: 901 }, (_, minute) => ({ c: [{ v: minute }, { v: 1000 + minute }] }));
const errors = [];

async function openPage(browser, width, height, fallback = false) {
  const page = await browser.newPage({ viewport: { width, height }, locale: 'pt-BR', reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  if (fallback) await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined });
  });
  await page.clock.setFixedTime(instant);
  await page.route('https://tr.ons.org.br/**', route => {
    const endpoint = route.request().url();
    const json = endpoint.includes('GetBalanco') ? { ...balance, Data: instant.toISOString() }
      : endpoint.includes('SituacaoDosReservatorios') ? reservoirs : { rows };
    return route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  const ready = await page.goto(url, { waitUntil: 'domcontentloaded' });
  assert.equal(ready.status(), 200);
  try {
    await page.waitForFunction(() => document.querySelector('.map-panel').getAttribute('aria-busy') === 'false' &&
      document.querySelector('#map-feedback').hidden && document.querySelectorAll('#reservoirs [role="meter"]').length === 4 &&
      document.querySelector('#curve-chart svg') && document.querySelector('#cut-chart .cut-total') &&
      document.querySelector('#plan-charts').children.length === 2 && !document.querySelector('#present').disabled);
  } catch (error) {
    const state = await page.locator('#map-feedback, #curve-chart, #curve-status, #cut-status, #present').allTextContents();
    throw new Error(`painéis não carregaram: ${state.join(' / ')}. erros: ${errors.join(' / ')}`, { cause: error });
  }
  await page.evaluate(() => document.fonts.ready.then(() => true));
  return page;
}

async function capture(page, filename) {
  await page.screenshot({ path: fileURLToPath(new URL(filename, pictures)), animations: 'disabled' });
}

async function checkWidth(page) {
  const widths = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, expected: innerWidth }));
  assert.ok(widths.actual <= widths.expected + 1, `${widths.actual}px de largura em uma janela de ${widths.expected}px`);
}

let browser;
try {
  await mkdir(pictures, { recursive: true });
  browser = await firefox.launch();
  console.log(`Firefox ${browser.version()} · ${process.platform}`);
  const page = await openPage(browser, 1366, 768);
  assert.equal(await page.locator('h1:visible').textContent(), 'setor elétrico brasileiro');
  assert.equal(await page.locator('.panorama-actions a, #refresh').count(), 0);
  assert.equal(await page.locator('.panorama-byline').textContent(), 'por guilherme v. borges e thales c. pahim');
  assert.equal(await page.locator('#map-title').textContent(), 'sistema interligado nacional');
  assert.equal(await page.locator('#theme-toggle use').getAttribute('href'), '#i-sun');
  assert.equal(await page.locator('.cut-panel #live-flows').count(), 1);
  assert.equal(await page.getByRole('combobox', { name: 'subsistema', exact: true }).count(), 1);
  assert.equal(await page.locator('.hero-heading, .site-header, .region-controls, .map-foot, #connection-status, #balance-reference, #reservoir-reference, #sankey-status').count(), 0);
  const meter = page.locator('[data-ear="nordeste"] [role="meter"]');
  const measured = Number(await meter.getAttribute('aria-valuenow'));
  const displayed = await meter.evaluate(el => (125 - el.querySelector('.ear-level').transform.baseVal.getItem(0).matrix.f) / 1.2);
  assert.ok(Math.abs(displayed - measured) < 1.5);
  assert.equal(await meter.locator('.ear-wave').evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.match(await page.locator('#curve-status').textContent(), /SIN.*15:00/);
  assert.match(await page.locator('#curve-chart output').textContent(), /11\.400 MW/);
  assert.match(await page.locator('#cut-status').textContent(), /ONS.+[0-9]+\/7 dias publicados/);
  await checkWidth(page);
  await capture(page, 'panorama-escuro.png');

  const map = page.locator('#grid-map');
  const imageBefore = await map.evaluate(canvas => canvas.toDataURL());
  await page.locator('#map-region').selectOption('nordeste');
  await page.waitForFunction(before => document.querySelector('#grid-map').toDataURL() !== before, imageBefore);
  assert.ok(await page.locator('[data-ear="nordeste"]').evaluate(el => el.classList.contains('selected')));
  await page.locator('[data-ear="sul"] .ear-select').press('Enter');
  assert.equal(await page.locator('#map-region').inputValue(), 'sul');
  assert.equal(await page.locator('[data-ear="sul"] .ear-select').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-ear="nordeste"] .ear-select').click();
  assert.equal(await page.locator('#map-region').inputValue(), 'nordeste');
  await page.waitForFunction(() => document.querySelector('#curve-status').textContent.includes('nordeste'));
  const wind = page.getByRole('button', { name: 'eólica', exact: true });
  await wind.click();
  assert.equal(await wind.getAttribute('aria-pressed'), 'true');
  assert.equal(await wind.locator('use').getAttribute('href'), '#i-wind');
  assert.equal(await page.getByRole('button', { name: 'nuclear', exact: true }).count(), 0);
  assert.match(await page.locator('#curve-chart output').textContent(), /1\.900 MW/);
  await page.locator('#cut-period').selectOption('30');
  assert.match(await page.locator('#cut-status').textContent(), /\/30 dias publicados/);
  const beforeMode = await map.evaluate(canvas => canvas.toDataURL());
  await page.locator('#map-mode').selectOption('planejada');
  await page.waitForFunction(previous => {
    const canvas = document.querySelector('#grid-map');
    return canvas.closest('article').getAttribute('aria-busy') === 'false' && canvas.toDataURL() !== previous;
  }, beforeMode);
  await page.locator('.layer-menu > summary').click();
  assert.ok(await page.locator('#map-layers input').count() > 8);
  assert.match(await page.locator('#map-layers').textContent(), /usinas hidrelétricas/);
  assert.match(await page.locator('.voltage-key').textContent(), /500 kV ou mais/);
  const lengths = page.locator('.voltage-lengths');
  assert.equal(await lengths.locator('tbody tr').count(), 8);
  assert.equal(await lengths.locator('tfoot td').textContent(), '196.933,1');
  await page.locator('.layer-menu > summary').click();
  await page.locator('#map-fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement?.contains(document.querySelector('#grid-map')));
  assert.ok(await page.locator('#map-layers').isVisible());
  assert.ok((await page.locator('.map-controls').boundingBox()).x < (await map.boundingBox()).x);
  assert.ok((await page.locator('.map-sidebar').boundingBox()).x >= 8);
  const highlight = page.locator('#voltage-highlight');
  const voltage = page.locator('#map-voltage');
  await voltage.selectOption('500');
  await highlight.waitFor();
  assert.equal(await highlight.evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.equal(await lengths.locator('tr.voltage-match td').textContent(), '70.756,2');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => document.querySelector('#voltage-highlight').getAnimations().some(a => a.animationName === 'voltage-breath'));
  await lengths.scrollIntoViewIfNeeded();
  await capture(page, 'legenda-tensao.png');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await voltage.selectOption('all');
  await highlight.waitFor({ state: 'hidden' });
  await page.locator('#map-flow-toggle').click();
  await page.locator('.exchange-region').first().waitFor();
  const circuits = page.locator('.exchange-circuits li');
  assert.equal(await circuits.count(), wantedCircuits);
  assert.match(await circuits.allTextContents().then(names => names.join(' ')), /colinas.*ribeiro gonçalves.*ibiúna.*bateias/);
  assert.equal(await page.locator('.exchange-region').count(), 4);
  const coverage = page.locator('#map-flow-coverage');
  assert.match(await coverage.textContent(), new RegExp(`${highVoltage.length} traçados.*${highVoltage.filter(isHVDC).length} HVDC`));
  const reference = page.locator('#map-flow-reference');
  assert.match(await reference.textContent(), /06:00.*18:00/);
  const names = { norte: 'norte', nordeste: 'nordeste', sudesteECentroOeste: 'sudeste/CO', sul: 'sul' };
  const rowsByPeriod = async period => {
    const expected = exchanges[period].links.filter(link => link.mw > 0)
      .map(link => `${names[link.from]} → ${names[link.to]}`);
    assert.deepEqual(await page.locator('.exchange-links li > span').allTextContents(), expected);
  };
  await rowsByPeriod('dia');
  await page.locator('.exchange-region summary').first().click();
  assert.match(await page.locator('.exchange-region[open] dl').textContent(), /geração total.*carga verificada.*hidráulica.*manaus.*SE Lechuga/s);
  const routes = page.locator('#flow-map');
  assert.ok(await routes.isVisible());
  const beforeNight = await routes.evaluate(el => el.toDataURL());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(initial => document.querySelector('#flow-map').toDataURL() !== initial, beforeNight);
  assert.equal(await meter.locator('.ear-wave').evaluate(el => getComputedStyle(el).animationName), 'ear-wave');
  assert.ok(await page.locator('#generation-fill').evaluate(el => el.getAnimations().some(a => a.effect.getTiming().duration === 60000)));
  await capture(page, 'intercambios-dia.png');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const night = page.locator('[data-flow-period="noite"]');
  await night.press('Enter');
  assert.equal(await night.getAttribute('aria-pressed'), 'true');
  assert.match(await reference.textContent(), /18:00.*06:00/);
  assert.notEqual(await routes.evaluate(el => el.toDataURL()), beforeNight);
  await rowsByPeriod('noite');
  await capture(page, 'intercambios-noite.png');
  const current = page.locator('#map-current');
  await current.selectOption('hvdc');
  assert.match(await coverage.textContent(), new RegExp(`${highVoltage.filter(isHVDC).length} traçados`));
  assert.match(await page.locator('.voltage-length-status').textContent(), /21\.972,0 km/);
  await voltage.selectOption('600');
  assert.match(await coverage.textContent(), new RegExp(`${highVoltage.filter(item => isHVDC(item) && item.attributes.tensao === 600).length} traçados`));
  await voltage.selectOption('230');
  assert.match(await coverage.textContent(), /nenhuma linha de 500 kV/);
  await current.selectOption('all');
  await voltage.selectOption('all');
  await page.locator('#map-flow-toggle').click();
  await page.locator('#map-fullscreen').click();
  await page.waitForFunction(() => document.querySelector('#map-fullscreen').getAttribute('aria-pressed') === 'false');

  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'claro');
  assert.equal(await page.locator('#theme-toggle use').getAttribute('href'), '#i-moon');
  await capture(page, 'panorama-claro.png');
  await page.locator('#sankey-year').press('Home');
  assert.equal(await page.locator('#sankey-selection').textContent(), '1970');
  await page.locator('#sankey-year').press('ArrowRight');
  assert.equal(await page.locator('#sankey-selection').textContent(), '1971');
  assert.match(await page.locator('#sankey-chart svg').textContent(), /hidrelétrica.*carvão/);
  await page.locator('#sankey-year').press('End');
  await page.locator('#sankey-play').click();
  await page.waitForFunction(() => Number(document.querySelector('#sankey-year').value) < 2025);
  await page.waitForFunction(() => Number(document.querySelector('#sankey-year').value) > 1970);
  await page.locator('#sankey-year').evaluate(el => { el.value = 2024; });
  await page.waitForFunction(() => document.querySelector('#sankey-year').value === '2025');
  assert.equal(await page.locator('#sankey-play use').getAttribute('href'), '#i-play');
  await page.locator('#history-series').selectOption('fontes');
  assert.equal(await page.locator('#history-chart .chart-legend li').count(), 5);
  await page.locator('#sankey-chart summary').click();
  await page.locator('#sankey-chart tbody').waitFor();
  await page.locator('#sankey-chart summary').click();
  await page.locator('#historico').scrollIntoViewIfNeeded();
  await capture(page, 'historico.png');
  for (const id of ['history', 'sankey']) {
    const button = page.locator(`#${id}-fullscreen`);
    await button.click();
    await page.waitForFunction(id => document.fullscreenElement?.querySelector(`#${id}-chart svg`), id);
    await capture(page, `${id}-tela-cheia.png`);
    await button.click();
    await page.waitForFunction(() => !document.fullscreenElement);
  }
  await page.locator('#reservoir-fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement?.querySelector('#reservoirs svg'));
  await page.locator('.reservoir-panel').screenshot({ path: fileURLToPath(new URL('reservatorios-tela-cheia.png', pictures)), animations: 'disabled' });
  await page.locator('#reservoir-fullscreen').click();
  await page.waitForFunction(() => !document.fullscreenElement);
  const forecast = page.locator('.plan-card').last();
  await forecast.locator('.plan-metric').selectOption({ index: 3 });
  assert.ok(await forecast.locator('.plan-chart svg').isVisible());
  await page.locator('#planejamento').scrollIntoViewIfNeeded();
  await capture(page, 'planejamento.png');

  await page.locator('#present').focus();
  await page.keyboard.press('p');
  assert.equal(await page.locator('#slide-counter').textContent(), '1 / 35');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#slide-counter').textContent(), '2 / 35');
  await capture(page, 'madrid.png');
  await page.keyboard.press('End');
  assert.equal(await page.locator('#slide-counter').textContent(), '35 / 35');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#presentation').evaluate(dialog => dialog.open), false);
  await page.locator('#data-notes').click();
  assert.match(await page.locator('#reading-balance').textContent(), /medição ONS/);
  assert.match(await page.locator('#reading-reservoirs').textContent(), /referência diária/);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { location.hash = '#trabalho'; });
  await page.locator('#chapter-content h2').waitFor();
  await page.evaluate(() => { location.hash = '#fontes'; });
  await page.waitForFunction(() => document.querySelector('#fontes').open);
  assert.match(await page.locator('#fontes').textContent(), /família de modelos 6 sol/);
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'claro');
  await page.close();

  const mobile = await openPage(browser, 390, 844, true);
  await checkWidth(mobile);
  await capture(mobile, 'celular.png');
  await mobile.locator('#map-fullscreen').click();
  await mobile.locator('.map-panel.panel-expanded').waitFor();
  await capture(mobile, 'celular-mapa-tela-cheia.png');
  await checkWidth(mobile);
  await mobile.keyboard.press('Escape');
  assert.equal(await mobile.locator('#map-fullscreen').getAttribute('aria-pressed'), 'false');
  const deficit = structuredClone(exchanges);
  const northeast = 'nordeste';
  deficit.noite.regions[northeast].load = Object.values(deficit.noite.regions[northeast].sources).reduce((sum, value) => sum + value, 3000);
  deficit.noite.links = deficit.noite.links.map(link => link.from === northeast ? { ...link, from: link.to, to: northeast } : link);
  await mobile.route('**/data/intercambios.json', route => route.fulfill({ json: deficit }));
  await mobile.locator('#map-flow-toggle').click();
  await mobile.locator('[data-flow-period="noite"]').click();
  await mobile.waitForFunction(() => document.querySelector('#map-flow-reference').textContent.includes('18:00'));
  await mobile.locator('.exchange-region').filter({ has: mobile.locator('summary', { hasText: 'nordeste' }) }).locator('summary').click();
  assert.match(await mobile.locator('.exchange-region[open] dl').textContent(), /recife · SE Recife II/);
  await checkWidth(mobile);
  await capture(mobile, 'intercambios-celular.png');
  await mobile.locator('#map-flow-toggle').click();
  await mobile.locator('#sankey-fullscreen').click();
  await mobile.locator('.historical-panel.panel-expanded').waitFor();
  await mobile.keyboard.press('Escape');
  assert.equal(await mobile.locator('#sankey-fullscreen').getAttribute('aria-pressed'), 'false');
  await mobile.locator('#sankey-chart').scrollIntoViewIfNeeded();
  await capture(mobile, 'celular-historico.png');
  await mobile.setViewportSize({ width: 320, height: 680 });
  await checkWidth(mobile);
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log('Mapa, dados, temas, apresentação, rodapé e larguras verificados.');
} finally {
  await browser?.close();
  server.close();
}

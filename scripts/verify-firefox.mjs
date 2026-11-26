import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firefox } from '../.firefox-qa/node_modules/playwright/index.mjs';

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
  const page = await openPage(browser, 1440, 980);
  assert.equal(await page.locator('h1:visible').textContent(), 'setor elétrico brasileiro');
  assert.equal(await page.locator('.hero-heading, .site-header, .region-controls, .map-foot, #connection-status, #balance-reference, #reservoir-reference, #sankey-status').count(), 0);
  const meter = page.locator('[data-ear="nordeste"] [role="meter"]');
  const measured = Number(await meter.getAttribute('aria-valuenow'));
  const displayed = await meter.evaluate(el => el.querySelector('.ear-water').offsetHeight / el.clientHeight * 100);
  assert.ok(Math.abs(displayed - measured) < 1.5);
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
  await page.locator('.layer-menu > summary').click();
  await page.locator('#map-fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement?.contains(document.querySelector('#grid-map')));
  assert.ok(await page.locator('#map-layers').isVisible());
  assert.ok((await page.locator('.map-controls').boundingBox()).x < (await map.boundingBox()).x);
  await capture(page, 'mapa-tela-cheia.png');
  await page.locator('#map-fullscreen').click();
  await page.waitForFunction(() => document.querySelector('#map-fullscreen').getAttribute('aria-pressed') === 'false');

  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'claro');
  await capture(page, 'panorama-claro.png');
  await page.locator('#sankey-year').press('Home');
  assert.equal(await page.locator('#sankey-selection').textContent(), '1970');
  await page.locator('#sankey-year').press('ArrowRight');
  assert.equal(await page.locator('#sankey-selection').textContent(), '1971');
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
  await page.locator('nav [data-route="trabalho"]').click();
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

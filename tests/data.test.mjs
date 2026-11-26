import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectBalance, normalizeReservoirs, validateBalance, freshness, sourcePower, REGIONS } from '../src/data.js';
const raw = JSON.parse(await readFile(new URL('../src/data/balance.json', import.meta.url), 'utf8'));
const reservoirRaw = JSON.parse(await readFile(new URL('../src/data/reservoirs.json', import.meta.url), 'utf8'));
test('Total nacional inclui os quatro subsistemas, Itaipu e MMGD uma única vez', () => {
  const result=selectBalance(raw);
  assert.equal(result.total,REGIONS.reduce((s,r)=>s+raw[r.id].geracao.total,0));
  assert.ok(Math.abs(result.sources.reduce((s,r)=>s+r.mw,0)-result.total)<.02);
  const se=selectBalance(raw,'sudesteECentroOeste');
  const g=raw.sudesteECentroOeste.geracao;
  assert.equal(se.sources[0].mw,g.hidraulica+g.itaipu50HzBrasil+g.itaipu60Hz);
});
test('Preserva resíduos negativos da medição; barras visuais totalizam 100%',()=>{
  const result=selectBalance(raw,'nordeste');
  assert.equal(result.sources.find(s=>s.id==='solar').mw,raw.nordeste.geracao.solar);
  assert.ok(Math.abs(result.sources.reduce((s,r)=>s+r.barShare,0)-100)<1e-8);
});
test('Dados ausentes são rejeitados, sem serem convertidos em zeros',()=>{
  const bad=structuredClone(raw);delete bad.norte.geracao.termica;
  assert.throws(()=>validateBalance(bad));
  assert.throws(()=>selectBalance(raw,'inventado'));
});
test('EAR deduplica reservatórios, converte fração do SIN e preserva data civil',()=>{
  const ear=normalizeReservoirs(reservoirRaw);
  assert.equal(Object.keys(ear.regions).length,4);
  assert.ok(Math.abs(ear.sinPercent-reservoirRaw[0].SINEARPorcentagem*100)<1e-7);
  assert.equal(ear.date,'2026-11-24');
  assert.throws(()=>normalizeReservoirs([]));
});
test('Defasagem depende da medição e não do sucesso HTTP',()=>{
  const measured=Date.parse(raw.Data);
  assert.equal(freshness(raw.Data,measured+1000).stale,false);
  assert.equal(freshness(raw.Data,measured+16*60*1000).stale,true);
  assert.equal(freshness(raw.Data,measured-6*60*1000).stale,true);
});
test('Pequena geração usa MW visíveis; resíduo negativo e zero permanecem distintos',()=>{
  assert.deepEqual(sourcePower(6.27),{value:'6,27',unit:'MW'});
  assert.deepEqual(sourcePower(-.57),{value:'-0,57',unit:'MW'});
  assert.deepEqual(sourcePower(0),{value:'0,0',unit:'GW'});
  assert.deepEqual(sourcePower(19471.293),{value:'19,5',unit:'GW'});
});

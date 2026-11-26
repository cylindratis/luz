import { readFile, writeFile, mkdir, cp, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
await mkdir('src/assets', { recursive: true });
await mkdir('src/data', { recursive: true });
await cp('../Setor_eletrico_brasileiro.pdf', 'src/assets/trabalho.pdf');
await cp('../ons-balanco-snapshot.json', 'src/data/balance.json');
await cp('../research-editorial.json', 'src/data/editorial.json');
const research = JSON.parse(await readFile('../research-ons.json', 'utf8'));
await writeFile('src/data/reservoirs.json', JSON.stringify(research.reservoirs.snapshot));
await writeFile('src/data/capacity.json', JSON.stringify(research.installedCapacity));
const geo = JSON.parse(await readFile('brazil-ibge.geojson', 'utf8'));
const polygons = geo.features.flatMap(f => f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]);
const project = ([lng,lat]) => [((lng+74)/40)*470+55, ((6-lat)/40)*470+10];
const paths = polygons.map(poly => poly.map(ring => ring.map((p,i) => (i ? 'L':'M') + project(p).map(v=>v.toFixed(1)).join(',')).join('')+'Z').join('')).join('');
function inside(point, ring) { let result=false; for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>point[1])!==(yj>point[1])&&point[0]<(xj-xi)*(point[1]-yi)/(yj-yi)+xi)result=!result;}return result; }
let dots=''; for(let x=-74;x<-34;x+=.52)for(let y=-34;y<6;y+=.52){if(polygons.some(p=>inside([x,y],p[0])&&!p.slice(1).some(h=>inside([x,y],h)))){const [cx,cy]=project([x,y]);dots+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.3"/>`;}}
const svg=`<svg viewBox="0 0 600 510" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="map-gradient" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#339bd6"/><stop offset="1" stop-color="#005ab2"/></linearGradient><linearGradient id="beam-gradient"><stop stop-color="#339bd6" stop-opacity="0"/><stop offset=".6" stop-color="#72cdff"/><stop offset="1" stop-color="#339bd6" stop-opacity="0"/></linearGradient></defs><path d="M35 160H570M35 315H570M35 470H570M140 15V495M295 15V495M450 15V495" class="map-graticule"/><path d="${paths}" fill="#173044" opacity=".3"/><g fill="url(#map-gradient)">${dots}</g><path class="map-line" d="M230 155Q350 115 420 235L325 355 265 450M230 155 325 355M230 155Q280 240 420 235"/><g><path class="map-beam" d="M230 155Q350 115 420 235L325 355 265 450"/><path class="map-beam" d="M265 450 325 355 230 155"/><path class="map-beam" d="M230 155Q280 240 420 235"/></g></svg>`;
await writeFile('src/assets/brasil.svg',svg);
await writeFile('src/assets/favicon.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#080b10"/><path d="M23 4 7 23h13l-2 13 16-21H21Z" fill="#339bd6"/></svg>');
const fontRoot = resolve('node_modules/geist/dist/fonts');
async function walk(path){let result=[];for(const e of await readdir(path,{withFileTypes:true})){if(e.isDirectory())result.push(...await walk(resolve(path,e.name)));else result.push(resolve(path,e.name));}return result;}
const fonts = await walk(fontRoot);
for(const [find,dest] of [[/geist-sans[\\/](?:Geist\[wght\]|Geist-Variable)\.woff2$/i,'geist-sans.woff2'],[/geist-mono[\\/](?:GeistMono\[wght\]|GeistMono-Variable)\.woff2$/i,'geist-mono.woff2'],[/GeistPixel-Square\.woff2$/i,'geist-pixel.woff2']]){const file=fonts.find(p=>find.test(p));if(!file)throw new Error('Fonte não encontrada: '+dest+' '+fonts.join('\n'));await cp(file,'src/assets/'+dest);}
console.log('Fontes, PDF, mapa IBGE e leituras salvas preparados.');

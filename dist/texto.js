const abbreviations = /(?<![\p{L}\p{N}])(?:ENBPar|GNRa|[A-ZÁÉÍÓÚÃÕÇ]{2,}[a-z]?[0-9]*|[kMGT]?(?:Wh|Wmed|W|V|A|J)|Hz|MtCO₂e|ktCO₂e|R(?=\$)|US)(?![\p{L}\p{N}])/gu;
const siglas = new Set(('AC ACL ACR APE AL AM AMFORP ANEEL AP BA BEN BR CA CB CE CCEE CCEAR CDE CEG CGH CNF CNPE CO CV DEC DF DOI EIA ENBPar ENE EOL EPE ESS FEC GD GO GNRa GT HHI HVDC IAG IBGE ICMS IEA IPCA ISO ITA J KMA LT LTS MA MG MMGD MME MPO MS MT NE ODS ONS ONU P PAR PCH PDE PE PI PLD PNAD PNE PR PROINFA RAP REL REN RJ RN RO RR RS S SA SC SCADA SE SES SIGA SIN SP TA TC TNZ TO TSEE TUSD TUST UFRGS UF UFV UHE UO2 UTE UTEs US UTE CUSE IV VI VII VIII IX SIL CC BY CSS HTML PDF API ECO ABC').split(' '));
const units = /^(?:[kMGT](?:Wh|Wmed|W|V|A|J)|Wh|Wmed|Hz|MtCO₂e|ktCO₂e)$/u;

export function editorialCase(value) {
  const text = String(value ?? '');
  let start = 0, result = '';
  for (const match of text.matchAll(abbreviations)) {
    const token = match[0];
    const plainUnit = /^[AWVJ]$/.test(token) && /\d\s*$/.test(text.slice(0, match.index));
    result += text.slice(start, match.index).toLocaleLowerCase('pt-BR') +
      (siglas.has(token) || units.test(token) || plainUnit || token === 'R' || /^CR\d+$/.test(token) ? token : token.toLocaleLowerCase('pt-BR'));
    start = match.index + match[0].length;
  }
  return result + text.slice(start).toLocaleLowerCase('pt-BR');
}

export function normalizeText(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement.closest('script,style,svg,[data-preserve-case]')) continue;
    const value = editorialCase(node.textContent);
    if (node.data !== value) node.data = value;
  }
  for (const element of root.querySelectorAll('[aria-label],[title]')) {
    for (const attribute of ['aria-label', 'title']) {
      if (element.hasAttribute(attribute)) element.setAttribute(attribute, editorialCase(element.getAttribute(attribute)));
    }
  }
}

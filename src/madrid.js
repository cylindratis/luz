import { getJSON } from './data.js';
import { editorialCase } from './texto.js';

const blocks = [
  [3, 4, 'panorama do setor', 4],
  [5, 8, 'teoria e história', 6],
  [9, 13, 'estrutura do setor', 7],
  [14, 20, 'SIN e regulação', 9],
  [21, 23, 'itaipu e integração', 4],
  [24, 28, 'temas contemporâneos', 8],
  [29, 30, 'fechamento', 2]
];

const mainPoints = [
  ['regulação, desenho de mercado e coordenação do suprimento', ['guilherme v. borges e thales c. pahim', 'economia industrial · UFRGS · novembro de 2026']],
  ['40 minutos em sete blocos', blocks.map(([, , title, duration]) => `${title} · ${duration} min`)],
  ['quatro elos levam a eletricidade da usina ao consumidor.', ['geração produz eletricidade. transmissão transporta em alta tensão. distribuição faz a entrega local.', 'ONS opera o SIN, a ANEEL regula o serviço e os contratos definem o fornecimento.']],
  ['acesso, renováveis, eficiência, infraestrutura e clima orientam a avaliação do setor.', ['99,8% da população com acesso à eletricidade em 2024.', 'os indicadores têm universos diferentes. compare período, unidade e população de referência.']],
  ['o monopólio natural das redes exige regulação de tarifa, acesso e qualidade.', ['custos fixos e duplicação onerosa sustentam a concessão de rede.', 'o regulador precisa lidar com assimetria de informação e incentivos de manutenção.']],
  ['o desenho do leilão muda a competição e a exposição ao risco.', ['energia, potência e concessões de rede são objetos distintos.', 'habilitação, garantias e penalidades moldam propostas e execução.']],
  ['as redes locais deram lugar à expansão coordenada em escala nacional.', ['light e AMFORP organizaram concessões urbanas.', 'o código de águas de 1934, o plano de metas e a eletrobras mudaram a escala do investimento.']],
  ['crises de financiamento e suprimento reorganizaram o setor.', ['ANEEL em 1996 e ONS em 1998.', 'racionamento de 2001, novo modelo em 2004 e abertura do mercado livre.']],
  ['a estrutura econômica varia entre os elos da cadeia.', ['geração compete por projetos e contratos.', 'transmissão e distribuição operam redes sob concessão.', 'comercialização conecta carteiras, fornecedores e consumidores.']],
  ['86,6% da oferta interna de eletricidade veio de renováveis em 2025.', ['fonte: BEN 2026, edição final.', 'portfólios combinam fontes, bacias e perfis de geração para administrar risco.']],
  ['transmissão e distribuição são remuneradas conforme suas funções.', ['na transmissão, RAP, TUST e parcela variável tratam de disponibilidade e uso.', 'na distribuição, a tarifa incorpora energia, rede, encargos e metas de qualidade.']],
  ['a comercialização combina negociação de energia e gestão de exposição.', ['preço, prazo, indexação, garantias e perfil de entrega distribuem riscos.', 'crédito, dados e integração com a CCEE influenciam a entrada no varejo.']],
  ['a comparação de concentração depende do universo observado.', ['geração no SIN: CR4 de 34,0%, setembro de 2026.', 'transmissão: CR4 de 64,7% da RAP publicada, ciclo 2024/2025.', 'distribuição: CR4 de 31,27% das unidades consumidoras, dezembro de 2025.']],
  ['planejamento, regulação, operação e liquidação têm responsáveis distintos.', ['MME e EPE planejam, ANEEL regula, ONS opera, CCEE contabiliza e liquida.']],
  ['despachar água agora muda o valor da energia armazenada para depois.', ['afluências, estoques, carga, vento, sol e rede entram na otimização.', 'o resultado orienta despacho, intercâmbio e reservas.']],
  ['o PLD valora a diferença entre posições contratada e contabilizada.', ['o custo marginal de operação serve de referência por hora e submercado.', 'contratos definem exposição financeira e o ONS coordena o despacho físico.']],
  ['racionamento e blecautes ajudam a distinguir escassez de energia e falhas na rede.', ['2001: estoques sob pressão e expansão insuficiente.', '2009 e 2023: eventos elétricos na rede. confira o recorte de cada episódio nas notas.']],
  ['ACR e ACL organizam a contratação para públicos diferentes.', ['no ACR, distribuidoras compram para o mercado cativo.', 'no ACL, consumidores elegíveis negociam contratos e administram exposição.']],
  ['os leilões compram entregas diferentes.', ['energia nova remunera energia contratada.', 'reserva de capacidade remunera disponibilidade.', 'a concessão de transmissão remunera a infraestrutura pela RAP.']],
  ['R$ 52,660 bilhões no orçamento aprovado da CDE em 2026.', ['R$ 47,793 bilhões em cotas CDE-uso, 90,8% do total.', 'a incidência dos encargos depende do consumo, do perfil tarifário e das isenções.']],
  ['itaipu tem 14.000 MW de potência instalada.', ['o tratado de 1973 organiza direitos binacionais.', '64,43% do suprimento contabilizado em 2025 foi entregue à ENBPar.']],
  ['o CUSE e a tarifa brasileira de repasse medem valores distintos.', ['US$ 19,28/kW-mês para o CUSE binacional, 2024–2026.', 'US$ 17,66/kW-mês para o repasse às cotistas no brasil em 2026.']],
  ['conversoras e regras comerciais condicionam o intercâmbio internacional.', ['em 2025, exportação comercial média de 342 MW para a argentina e 25 MW para o uruguai.', 'itaipu e as demais interconexões seguem arranjos próprios.']],
  ['o curtailment pode decorrer de três razões operacionais.', ['indisponibilidade externa, confiabilidade e razão energética exigem respostas diferentes.', 'o gráfico do ONS permite acompanhar energia cortada e os motivos registrados.']],
  ['compensação retrospectiva e rateio futuro distribuem custos em momentos diferentes.', ['elegibilidade depende de motivo, período e termo de compromisso.', 'a apresentação registra as regras e o cronograma examinados no trabalho.']],
  ['26,3 GW em processos de conexão de datacenters até 2038.', ['são pedidos protocolados no MME.', 'perfil da carga, local da conexão e flexibilidade determinam o impacto no sistema.']],
  ['baterias e geração distribuída mudam quando e onde a energia chega à rede.', ['MW mede potência disponível. MWh mede energia armazenável.', 'os cenários do PDE 2035 e do PNE 2055 ajudam a explorar essas trajetórias.']],
  ['a abertura da baixa tensão combina escolha, proteção e ajuste dos contratos.', ['o calendário citado no trabalho prevê 2027 para indústria e comércio e 2028 para os demais consumidores elegíveis.', 'produto padrão, referência de preço e suprimento de última instância compõem a proteção.']],
  ['tarifa, segurança e transição dependem da coordenação das decisões.', ['universalização, estabilidade da rede e integração renovável exigem instrumentos diferentes.', 'a comparação da fatura precisa considerar energia, rede, encargos e risco.']],
  ['o perfil de geração e consumo muda ao longo do dia.', ['ao meio-dia, a oferta solar cresce e a flexibilidade pode absorver excedentes.', 'à noite, a demanda e a geração de outras fontes mudam o despacho.']],
  ['os indicadores respondem a perguntas diferentes.', ['99,8% de acesso à eletricidade na população em 2024.', '50,2% de renováveis no consumo final de energia em 2023 e 86,6% na oferta interna de eletricidade em 2025.']],
  ['benefícios e cotas da CDE afetam a fatura por canais distintos.', ['a tarifa social citada cobre a tarifa dos primeiros 80 kWh/mês para a subclasse elegível.', 'os valores orçados e o efeito líquido por classe precisam de recortes próprios.']],
  ['a análise documental delimita evidências e questões em aberto.', ['concentração, incidência tarifária, cortes de geração, interrupções e fluxos internacionais requerem séries comparáveis.']],
  ['as referências teóricas tratam de regulação, concorrência e desenho de mercados.', ['laffont e tirole, joskow e a legislação setorial. referências completas nas notas e no trabalho.']],
  ['as evidências setoriais vêm de fontes primárias.', ['EPE, ONS, ANEEL, MME, CCEE e itaipu binacional. confira as referências completas nas notas e no trabalho.']]
];

const jumps = new Map([
  [3, ['panorama', 'ver mapa do SIN']], [10, ['historico','ver geração histórica']],
  [14, ['panorama','ver mapa do SIN']], [21, ['panorama','ver mapa do SIN']],
  [24, ['cut-title','ver curtailment']], [26, ['planejamento','ver cenários da EPE']],
  [27, ['planejamento','ver cenários da EPE']], [30, ['curve-title','ver curva de geração']]
]);

export async function loadMadrid() {
  const raw = await getJSON('./data/madrid.json');
  if (raw.length !== mainPoints.length) throw new Error('apresentação Madrid incompleta');
  return raw.map((record, i) => {
    const [lead, points] = mainPoints[i];
    const block = blocks.find(([from,to]) => record.page >= from && record.page <= to);
    return {
      ...record, lead, points, jump: jumps.get(record.page),
      block: block ? `${block[2]} · ${block[3]} min` : record.page > 30 ? 'apoio e referências' : 'roteiro de 40 min'
    };
  });
}

const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = editorialCase(text);
  return element;
};

export function renderMadrid(stage, slide, close) {
  const article = document.createElement('article');
  article.className = 'madrid-slide';
  const title = node('h2', slide.title);
  title.id = 'slide-title';
  title.tabIndex = -1;
  article.append(title, node('p', slide.lead, 'slide-lead'));
  const list = document.createElement('ul');
  list.className = 'madrid-points';
  for (const item of slide.points) list.append(node('li', item));
  article.append(list);
  const actions = document.createElement('div');
  actions.className = 'slide-jump';
  const original = node('a', 'conferir esta página no PDF');
  original.href = `./assets/madrid-40min.pdf#page=${slide.page}`;
  original.target = '_blank';
  original.rel = 'noopener';
  actions.append(original);
  if (slide.jump) {
    const [hash, label] = slide.jump;
    const anchor = node('a', label);
    anchor.href = '#' + hash;
    anchor.addEventListener('click', () => {
      close();
      if (location.hash === anchor.hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
    });
    actions.append(anchor);
  }
  article.append(actions);
  const notes = document.createElement('details');
  notes.className = 'slide-notes';
  notes.append(node('summary', 'notas e referências da página'), node('pre', slide.notes));
  article.append(notes, node('p', `apresentação madrid · página ${slide.page} · ${slide.block}`, 'slide-source'));
  stage.replaceChildren(article);
}

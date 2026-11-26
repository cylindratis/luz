---
name: "Elétrica.br · Setor elétrico brasileiro"
description: "Leitura técnica do setor elétrico brasileiro em uma interface cybercore."
colors:
  light-ground: "#edf3f7"
  light-surface: "#ffffff"
  light-ink: "#142332"
  light-muted: "#465b70"
  light-line: "#c5d4e0"
  ground: "#080b10"
  surface: "#10161e"
  raised: "#17212b"
  ink: "#f4f7fb"
  muted: "#abb8c7"
  faint: "#8f9dad"
  line: "#24313e"
  blue: "#339bd6"
  blue-deep: "#005ab2"
  green: "#00bb31"
  green-deep: "#027223"
  red: "#e4002b"
  red-deep: "#a60a3d"
  yellow: "#ffc915"
  orange: "#ff7500"
  nuclear: "#a4b5c7"
  mmgd: "#ff9d3d"
typography:
  display:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "clamp(44px, 4.6vw, 66px)"
    fontWeight: 550
    lineHeight: 0.99
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "42px"
    fontWeight: 550
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  measurement:
    fontFamily: "Geist Mono, monospace"
    fontSize: "46px"
    fontWeight: 450
    lineHeight: 1.15
    letterSpacing: "-0.04em"
  unit:
    fontFamily: "Geist Mono, monospace"
    fontSize: "17px"
    fontWeight: 400
    letterSpacing: "-0.03em"
  identity:
    fontFamily: "Geist Pixel, monospace"
    fontWeight: 400
    letterSpacing: "0"
rounded:
  panel: "12px"
  inset: "8px"
  button: "7px"
  control: "6px"
  nav: "5px"
  track: "3px"
spacing:
  micro: "5px"
  compact: "8px"
  control-gap: "9px"
  mobile-grid: "12px"
  grid: "14px"
  control-padding: "17px"
  compact-panel: "20px"
  panel: "25px"
  section: "40px"
components:
  button:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 17px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 17px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.raised}"
  region-control:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "7px 15px"
  region-control-selected:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  chapter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "35px 42px 32px"
  chapter-link:
    textColor: "{colors.muted}"
    rounded: "{rounded.nav}"
    padding: "11px 14px"
  chapter-link-selected:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
  flow-disclosure:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.inset}"
    padding: "0 22px"
  map-node:
    backgroundColor: "#0c141df2"
    textColor: "#eaf4fc"
    rounded: "{rounded.control}"
    padding: "7px 10px"
---

# Design System: Elétrica.br

## Overview

**Creative North Star: "Um país interligado"**

A identidade cybercore trata a rede elétrica como um sistema legível: fundo quase preto, superfícies técnicas, dados monoespaçados e acentos de energia. A densidade serve à leitura acadêmica e à exploração de dados, com uma hierarquia clara entre argumento, medição e metadado.

O bento é a estrutura informacional confirmada pelo usuário. Geist sustenta a leitura; Geist Mono distingue medições; Geist Pixel intervém na identidade. A mudança de família em elétrica.br é deliberada. Esta documentação registra o sistema implementado; o plano inicial em `../design.md` guarda a pesquisa e as decisões anteriores. Contexto do produto e regras de dados pertencem a `PRODUCT.md` e `surface-brief.md`.

**Key Characteristics:**
- Cybercore escuro com bordas sutis e painéis de densidade controlada.
- Quatro pares de gradientes semânticos preservados do brief.
- Leitura em Geist, medições em Geist Mono e identidade em Geist Pixel.
- Seleção, estado e período comunicados por texto além de cor.
- Movimento localizado na rede, com alternativa de movimento reduzido.

## Colors

A paleta combina carvão azulado e texto frio com acentos elétricos de função explícita; o frontmatter é a referência normativa dos valores.

### Primary
- **Azul da rede (`blue`, `blue-deep`):** identidade, foco, seleção, água e sistema; o gradiente de água segue um ângulo de 110 graus.

### Secondary
- **Verde de geração (`green`, `green-deep`):** eólica e participação renovável nos gráficos existentes.
- **Vermelho térmico (`red`, `red-deep`):** geração térmica e acentos de risco definidos no brief.
- **Amarelo solar e laranja (`yellow`, `orange`):** solar e demanda. O estado salvo ou defasado também usa amarelo acompanhado de texto.
- **Laranja MMGD (`mmgd`):** identificação específica da MMGD estimada na composição da geração.

### Neutral
- **Carvão (`ground`):** fundo contínuo da aplicação.
- **Painel (`surface`) e plano elevado (`raised`):** agrupamento e seleção sem depender de sombra.
- **Branco frio (`ink`):** títulos, números e ações principais.
- **Cinza de leitura (`muted`) e metadado (`faint`):** explicações, horários e fontes; a hierarquia não depende de reduzir a opacidade do texto.
- **Divisória (`line`):** separação estrutural de conteúdos.
- **Cinza nuclear (`nuclear`):** marcador da fonte nuclear.

**The Semantic Gradient Rule.** Preserve os quatro pares em faixas, barras e superfícies de contexto; mantenha títulos e texto corrido em cor sólida. Cada fonte mantém nome e valor visíveis.

## Typography

**Display Font:** Geist, com Arial e sans-serif como alternativas.
**Body Font:** Geist, com Arial e sans-serif como alternativas.
**Label/Mono Font:** Geist Mono, com monospace; Geist Pixel fica na identidade e nas intervenções curtas existentes.

As três famílias são um compromisso explícito do usuário e são distribuídas em arquivos locais. O caráter técnico vem de medidas estáveis e contraste de função, com leitura contínua em sans-serif.

### Hierarchy
- **Display:** abertura do panorama, com escala fluida do frontmatter; no celular passa a 48 px e entrelinha de 1.02.
- **Headline:** título de capítulo; reduz a 35 px até 1100 px e a 31 px até 600 px. Títulos de vista usam 56 px, reduzidos a 44 px até 800 px.
- **Title:** cabeçalhos de painéis pequenos, com peso moderado e espaçamento discreto.
- **Body:** capítulos com largura máxima de 70ch; introdução de capítulo em 21 px, entrelinha de 1.5 e até 64ch. No celular o corpo passa a 15 px.
- **Label:** metadados e descrições compactas. Os metadados cobertos pela regra final do CSS têm piso de 11 px.
- **Measurement / Unit:** números monoespaçados com algarismos tabulares; unidade menor na mesma linha de base. Fontes da composição podem exibir MW ou GW em texto pequeno.
- **Identity:** Pixel no sufixo da marca e nos motivos curtos; não substituir parágrafos por Pixel.

**The Measurement Rule.** Use Geist Mono e algarismos tabulares para medições. Preserve a unidade próxima ao valor, em tamanho menor.

**The Tracking Floor Rule.** Não aperte o espaçamento entre letras além de -0.04em; essa é a maior compressão presente no sistema final.

## Layout

O contêiner principal tem largura máxima de 1280 px. Até 1370 px, usa largura disponível menos 80 px; até 1100 px, menos 48 px; até 600 px, menos 36 px. A barra superior tem 80 px no desktop e 72 px na faixa intermediária; no celular a navegação forma uma segunda linha.

O bento desktop usa 14 colunas com intervalo de 14 px: mapa ocupa oito colunas e duas linhas, geração seis e métricas três cada. Até 1100 px passa a 12 colunas. Até 800 px, reservatórios e painel editorial ocupam a largura inteira. Até 600 px usa duas colunas com intervalo de 12 px; mapa, geração e contexto ocupam ambas, enquanto as duas métricas ficam lado a lado. Não aplique uma regra genérica de uma coluna que elimine essa relação.

A leitura tem trilho de capítulos de 230 px e conteúdo flexível, com intervalo de 65 px no desktop. Até 800 px o trilho vira uma faixa horizontal rolável; a navegação mantém o capítulo ativo visível. O cartão de leitura reduz o preenchimento até 25 px por 20 px no celular. Fontes e comparações passam de duas para uma coluna na menor faixa.

O modo de apresentação ocupa a janela inteira e amplia a escala de leitura; seus três blocos se empilham no celular. O espaçamento usa pequenos intervalos de 5–14 px para dados e respiros maiores entre argumentos, sem impor uma escala artificial de múltiplos de oito.

## Elevation & Depth

Os painéis são planos: fundo, tonalidade e contorno constroem profundidade. Botões não têm sombra. O mapa usa um fundo próprio, nós sobrepostos e linhas discretas para separar geografia, interação e conexão esquemática. Apenas o diálogo informativo usa sombra difusa; o modo de apresentação é uma superfície inteira.

**The Flat Panel Rule.** Preserve painéis sem sombra; reserve a sombra modal e o escurecimento de fundo para conteúdo sobreposto.

## Shapes

Painéis e diálogos compartilham cantos moderados; controles têm raios menores e barras usam pequenos arredondamentos. Bordas de 1 px separam planos. Marcadores de fonte são pequenos quadrados suavizados, pontos de estado são circulares e os ícones são SVG de traço fino. A silhueta do Brasil é SVG geométrico; as interligações são esquemáticas, conforme a legenda do mapa.

## Components

### Buttons

Ações compactas e legíveis: altura comum de 44 px, borda de 1 px, preenchimento horizontal do frontmatter e peso 500. O botão de apresentação tem tonalidade azulada própria. Hover clareia a superfície e a borda; active desloca 1 px para baixo. O foco visível usa contorno azul de 2 px com afastamento de 5 px. Desabilitado fica com opacidade de 0.4.

O botão ghost é transparente e ganha o plano elevado no hover. O botão textual mantém área de interação vertical e sublinhado. Preserve o comportamento nativo de Espaço e Enter em botões.

### Chips

Os controles de subsistema são botões de seleção: texto secundário e fundo transparente em repouso; fundo elevado, contorno e texto claro quando selecionados. Eles se organizam em linha e, no celular, em cinco posições compactas. O estado é expresso por `aria-pressed` além da cor.

### Cards / Containers

Os painéis usam superfície escura, borda sutil e raio comum; o preenchimento varia conforme a densidade, de 20–25 px nos painéis principais. O cartão editorial tem um gradiente azul mais escuro, independente dos quatro pares semânticos. Não aplicar esse gradiente automaticamente a todo painel.

O cartão de leitura oferece maior respiro e largura de linha limitada. Avisos usam fundo âmbar escuro e texto claro com mensagem explícita. Estados de consulta e falha preservam lugar para nome, referência e fonte.

### Navigation

A navegação principal usa Geist, texto secundário em repouso e texto claro com traço azul no estado ativo. O trilho de capítulos usa uma superfície elevada no capítulo atual. Links de prévia têm uma divisória superior e um ícone de avanço, sem embalagem de cartão adicional. A navegação móvel pode rolar horizontalmente, mantendo o item atual revelado.

### Mapa interativo do SIN

Nós são botões com título, ponto e leitura monoespaçada. Hover e seleção reforçam fundo e contorno. O SVG combina a geometria do Brasil, linhas de referência e feixes animados; a inspiração AnimatedBeam foi traduzida em SVG/CSS nativo, sem runtime Magic UI.

O feixe tem ciclo linear de 9 s; a chegada do mapa dura 1.2 s e a troca de vista 0.45 s, com a curva registrada no sidecar. `prefers-reduced-motion` remove animações e transições e usa rolagem imediata.

### Disclosure de intercâmbios

Um contorno discreto e resumo de 60 px abrem a tabela sob demanda. O sinal de expansão muda entre aberto e fechado. Dados ficam alinhados à direita em mono; o texto auxiliar do resumo é ocultado no celular para preservar a leitura do controle.

### Diálogos e apresentação

O diálogo informativo tem largura máxima de 560 px, superfície elevada pelo backdrop e fechamento visível. A apresentação usa progresso segmentado, contador mono, controles anterior/próximo e título amplo; os estados de limite desabilitam o controle correspondente. Preserve foco e navegação de teclado.

## Do's and Don'ts

### Do:
- **Do** preservar os quatro pares semânticos de gradiente e a base escura do frontmatter.
- **Do** manter medidas em mono, com unidade menor e fonte/período legíveis.
- **Do** distinguir seleção e estado por texto e atributos acessíveis além da cor.
- **Do** preservar foco visível, controles nativos e movimento reduzido.
- **Do** adaptar densidade, escala e trilho de capítulos às faixas responsivas implementadas.

### Don't:
- **Don't** usar gradiente no texto de leitura ou trocar o papel das três famílias.
- **Don't** comprimir tracking além do piso de -0.04em.
- **Don't** acrescentar sombras aos painéis planos.
- **Don't** transformar interligações esquemáticas em uma alegação de rotas físicas exatas.
- **Don't** eliminar unidades, fonte ou período para tornar o painel mais limpo.

## Atualização do panorama

O bento centralizado abre com a cartografia da EPE: os traçados têm geometria real, a seleção do SIN atenua as demais regiões e a legenda distingue cadastro existente de expansão. O mapa oferece controles nativos, ampliação progressiva e tela cheia. Nas duas paletas, mapas e gráficos usam a mesma semântica de cor, com contraste ajustado ao fundo. Séries têm rótulo, unidade e uma alternativa em tabela. O histórico e os cenários ficam após o painel operacional, seguidos do rodapé expansível. Os slides Madrid mantêm a ordem original, com texto refluível e notas de consulta.

O panorama abre sem cabeçalho global. Tema, apresentação e atualização ficam junto ao título. A navegação entre o panorama e o trabalho fica no rodapé, com retorno ao panorama no próprio trabalho. O seletor do mapa controla o recorte dos indicadores. Em tela cheia, a legenda e os filtros com ícones ocupam a esquerda, com o mapa à direita em telas largas e abaixo dos filtros no celular. O EAR de cada subsistema usa uma coluna de água proporcional, com o gradiente hidráulico e transição desativada na preferência de movimento reduzido. A curva diária usa botões com ícones e rótulos persistentes. O Sankey usa uma barra de anos e ambos os gráficos históricos mantêm seus controles em tela cheia. As referências de leitura ficam nas notas acessíveis sob demanda.

# Setor elétrico brasileiro

Apresentação interativa de Economia Industrial da UFRGS baseada no PDF fornecido. Implementada em HTML, CSS e JavaScript, com Tailwind CSS e DaisyUI compilados localmente. O site publicado não depende de um framework de aplicação nem de CDN para fontes ou estilos.

## Executar

```powershell
pnpm install
pnpm build
pnpm dev
```

Abra `http://127.0.0.1:4173`. A pasta `dist/` está pronta para hospedagem estática. É necessário servir por HTTP; abrir `index.html` por `file://` não permite os módulos e as consultas locais de JSON.

## Usar na apresentação

- Clique em **Apresentar** ou pressione **P**.
- Use as setas esquerda/direita, Page Up/Page Down ou os botões para navegar pelos 35 slides do roteiro Madrid de 40 minutos.
- **Home** e **End** vão ao primeiro e último slide. **Esc** sai.
- No panorama, escolha um subsistema para realçar sua infraestrutura e consultar geração, carga, energia armazenada e curtailment. O mapa tem filtros, zoom, detalhes por feição e tela cheia.
- No mapa, o botão com pulso abre os intercâmbios entre regiões, com recortes de dia e noite. As setas seguem os vértices da camada de linhas existentes da EPE, no sentido líquido medido pelo ONS para cada corredor. Abra cada região para ver a geração por fonte, a carga e o saldo. Os circuitos exibidos estão no próprio painel e no cadastro em `src/corredores.js`. Na camada cartográfica, a largura das linhas indica classes de tensão nominal em kV.
- A série histórica e o sankey cobrem 1970 a 2025. Os cards de planejamento permitem trocar indicadores, cenários e recortes do PDE 2035 e do PNE 2055.
- O botão de reprodução no sankey percorre os anos por fonte. Os medidores de energia armazenada usam os contornos dos subsistemas e têm tela cheia própria.
- **O trabalho** reúne a pergunta, a hipótese e os nove capítulos de desenvolvimento e conclusão.

## Atualização dos dados

O navegador consulta diretamente os serviços públicos do ONS:

- Balanço: `https://tr.ons.org.br/Content/GetBalancoEnergetico/null`, a cada 60 segundos com a página visível.
- Curva de geração do dia: séries intradiárias de geração por fonte do ONS, consultadas junto ao balanço.
- Reservatórios: `https://tr.ons.org.br/Content/Get/SituacaoDosReservatorios`, consulta horária; referência diária.

Em falha de consulta, os painéis usam a última leitura disponível e indicam a referência. O mapa exibe 22 camadas da EPE com geometrias simplificadas. A rede local de distribuição não está no material fornecido.

O curtailment usa a geração não realizada apurada nas bases oficiais de eólica e fotovoltaica do ONS. O GitHub Pages atualiza a série de referência diariamente e usa a cópia incluída no repositório quando a consulta falha. A capacidade do SIGA/ANEEL é uma leitura salva de 25/11/2026. A metodologia completa está no rodapé em **fontes e notas**.

## Conteúdo e manutenção

- `src/index.html`: estrutura e textos da interface.
- `src/style.css` e `src/observatorio.css`: identidade visual e responsividade.
- `src/app.js`, `src/mapa.js`, `src/graficos.js`, `src/madrid.js` e `src/operacao.js`: navegação, mapa, gráficos, apresentação e consultas.
- `src/data.js`: validação, agregação, unidades e datas.
- `src/data/editorial.json`: síntese do PDF com páginas e ressalvas.
- `src/assets/trabalho.pdf` e `src/assets/madrid-40min.pdf`: trabalho original e roteiro de apresentação.
- `design.md`: plano inicial e sistema visual documentado.
- `surface-brief.md`: contrato desta apresentação.

`scripts/prepare-assets.mjs` registra a preparação inicial usando os arquivos de pesquisa na pasta superior e a malha `brazil-ibge.geojson`. Ele não precisa ser executado para compilar ou hospedar o site existente. As fontes e os dados necessários já estão em `src/`.

Para regenerar as bases da atualização com os insumos originais em `../proximo passo/`, use `python scripts/prepare-observatorio.py` com `openpyxl`, `pyshp` e `pypdf`. `python scripts/prepare-curtailment.py` atualiza a cópia local dos cortes de geração.

Após atualizar as camadas da EPE, execute `node scripts/prepare-visuals.mjs` para refazer as silhuetas de EAR. `python scripts/prepare-intercambios.py` cruza as duas bases horárias do ONS e atualiza o último par completo de 12 horas. O fluxo do GitHub Pages repete a atualização diária e usa a leitura salva quando a consulta falha.

## Validação

```powershell
pnpm check
pnpm build
```

Os testes verificam agregações e defasagem dos dados. Antes de publicar, o fluxo do GitHub Pages testa a interface no Firefox em Linux, sob `/luz/`, e salva capturas como artefato da execução.

## Créditos

Fontes Geist, Geist Mono e Geist Pixel da Vercel, SIL Open Font License, cópia em `src/assets/FONT-LICENSE.txt`. Cartografia e planejamento da EPE. Dados operacionais do ONS e leitura cadastral do SIGA/ANEEL. A interface usa Tailwind CSS e DaisyUI e tem referências visuais do Magic UI.

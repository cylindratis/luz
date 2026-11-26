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
- Use as setas esquerda/direita, Page Up/Page Down ou os botões para navegar pelos 13 slides.
- **Home** e **End** vão ao primeiro e último slide. **Esc** sai.
- Em **Panorama**, selecione Brasil ou um subsistema para atualizar geração, carga e energia armazenada.
- **O trabalho** reúne a pergunta, a hipótese e os nove capítulos de desenvolvimento e conclusão.

## Atualização dos dados

O navegador consulta diretamente os serviços públicos do ONS:

- Balanço: `https://tr.ons.org.br/Content/GetBalancoEnergetico/null`, a cada 60 segundos com a página visível.
- Reservatórios: `https://tr.ons.org.br/Content/Get/SituacaoDosReservatorios`, consulta horária; referência diária.

Em falha de consulta, mantém a leitura válida em memória ou usa o arquivo salvo em `src/data/`, sempre identificado. A classificação de defasagem usa o horário da medição, com limite de 15 minutos para o balanço. O mapa é uma malha geográfica do IBGE com conexões esquemáticas.

A capacidade do SIGA/ANEEL é uma leitura salva de 25/11/2026. Não tem atualização automática: o endpoint consultado da ANEEL não ofereceu CORS. Não se deve chamar esse número de tempo real. A metodologia completa está na tela **Fontes e notas**.

## Conteúdo e manutenção

- `src/index.html`: estrutura e textos da interface.
- `src/style.css`: identidade visual e responsividade.
- `src/app.js`: navegação, interações, apresentação e consultas.
- `src/data.js`: validação, agregação, unidades e datas.
- `src/data/editorial.json`: síntese do PDF com páginas e ressalvas.
- `src/assets/trabalho.pdf`: documento original integral.
- `design.md`: plano inicial e sistema visual documentado.
- `surface-brief.md`: contrato desta apresentação.

`scripts/prepare-assets.mjs` registra a preparação inicial usando os arquivos de pesquisa na pasta superior e a malha `brazil-ibge.geojson`. Ele não precisa ser executado para compilar ou hospedar o site existente. As fontes e os dados necessários já estão em `src/`.

## Validação

```powershell
pnpm check
pnpm build
```

Os testes verificam soma dos subsistemas, agregação de Itaipu sem duplicidade, preservação de resíduos negativos, deduplicação da EAR e aviso de medição defasada. As evidências visuais e a revisão ficam em `.taste-skill/` e `.impeccable/` no ambiente de autoria.

## Créditos

Fontes Geist, Geist Mono e Geist Pixel da Vercel, SIL Open Font License, cópia em `src/assets/FONT-LICENSE.txt`. Malha geográfica pública do IBGE. Dados operacionais ONS e leitura cadastral SIGA/ANEEL. Conexões animadas em SVG nativo inspiradas no Animated Beam do Magic UI. Tailwind CSS, DaisyUI e Magic UI são projetos de código aberto; links de origem estão na tela de créditos. O mapa é uma visualização geométrica; não foram usadas fotografias substitutas nem números simulados.

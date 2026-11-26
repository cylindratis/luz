# plano de atualização do site do setor elétrico brasileiro

## 1. preparação dos dados e do design

- inventariar as 22 camadas geográficas da pasta `proximo passo/dados EPE`. validar projeção cartográfica, atributos, datas, cobertura e condições de republicação. confirmar se há camada específica de distribuição e registrar a cobertura encontrada.
- normalizar as planilhas do PDE 2035, os arquivos do PNE 2055 e `historico de producao.xlsx`. documentar a origem, as unidades, os anos, os cenários e as lacunas. manter scripts de preparação reproduzíveis.
- atualizar `site/design.md` antes do código com as regras do mapa, dos gráficos e dos dois temas.

## 2. abertura e mapa

- remover `section.hero-heading` e iniciar pelo bento grid centralizado, com título semântico integrado ao painel.
- incorporar as camadas da EPE para transmissão, subestações, usinas por fonte, sistemas isolados e subsistemas do SIN. incluir distribuição se houver uma camada verificada. oferecer legenda, filtros, zoom e detalhes dos elementos, com carregamento sob demanda.
- distinguir instalações existentes e expansão planejada. preservar a atualização do ONS e os carimbos de medição.
- adicionar botão de tela cheia, saída por Esc e alternativa dentro da janela quando a API de tela cheia estiver indisponível. destacar pontos e linhas da região escolhida e atenuar as demais. validar os limites dos subsistemas.
- incluir no bento a **curva de geração do dia (MW)**, em horário de Brasília, com seleção de subsistema e total do SIN quando comparável. usar as séries intradiárias de geração por fonte da página [carga e geração do ONS](https://www.ons.org.br/paginas/energia-agora/carga-e-geracao). verificar o acesso programático e a cadência antes de configurar a atualização. mostrar o último ponto publicado, identificar eventuais lacunas e manter importação e carga fora da soma da geração.
- incluir no bento **curtailment de eólica e solar**, com energia cortada em MWh ou GWh, período e última referência publicada. priorizar as bases abertas de constrained-off do ONS para [eólica](https://dados.ons.org.br/dataset/restricao_coff_eolica_detail) e [solar](https://dados.ons.org.br/dataset/restricao_coff_fotovoltaica_detail). validar o cálculo por intervalo e a cobertura antes de agregar por fonte, região e motivo. usar [malha brasil](https://malhabrasil.com/estatisticas?tab=curtailment) como referência comparativa ou alternativa identificada se a integração direta for inviável. sinalizar defasagem e revisões da fonte.

## 3. histórico, sankey e planejamento

- remover “três tempos. um só sistema.” e “do fio às regras.”. ocupar esse espaço com série histórica em linhas, sankey e painéis do PDE 2035 e do PNE 2055.
- usar o histórico de eletricidade a partir de 1970 até o último ano validado, conforme a cobertura da planilha. oferecer seleção de ano e séries. mostrar produção, importação, exportação, perdas e consumo por setor no sankey quando houver dados. conferir os balanços e sinalizar lacunas.
- integrar capacidade, geração, demanda e transmissão dos planos, além de MMGD, baterias, eficiência e emissões quando houver cobertura. exibir cenário, unidade e fonte. identificar valores observados e projeções nos gráficos.

## 4. apresentação e acabamento

- adaptar as 35 páginas de `Setor_eletrico_brasileiro_Madrid_40min.pdf` ao modo de apresentação, preservando os sete blocos e o roteiro de 40 minutos. oferecer navegação por teclado, notas de apoio e acesso ao mapa ou aos gráficos quando pertinente.
- usar minúsculas nos textos da interface e da apresentação, preservando siglas e símbolos de unidade cuja capitalização tem significado.
- adicionar modo claro e escuro com preferência persistida. conferir o contraste dos controles, das legendas e dos gráficos nos dois temas.
- remover “construção e créditos” e mover “fontes e notas” para um menu expansível no rodapé. incluir referências, metodologia dos dados e nota sobre o auxílio de IAG do ChatGPT, família 6 Sol, na elaboração do site.
- inserir no rodapé, seguindo a regra de minúsculas:

> trabalho desenvolvido na cadeira economia industrial (ECO-02003), ministrada pela profª. drª. ana lúcia tatsch para o curso de ciências econômicas da universidade federal do rio grande do sul.
>
> por guilherme v. borges e thales c. pahim

## 5. validação e publicação

- executar o build e os testes existentes. verificar a renderização no Firefox em Linux real ou ambiente equivalente, registrando a versão e o ambiente. se não houver acesso ao ambiente, registrar a verificação que ficou pendente.
- testar mapa, filtros, tela cheia e Esc, gráficos, temas, rodapé e apresentação em larguras de computador e celular. conferir fontes, contraste, navegação por teclado e URLs com o prefixo `/luz/`.
- conferir a curva intradiária contra horários e valores do ONS, inclusive na virada do dia. conferir a soma de energia cortada em amostras das bases oficiais, a unidade exibida e o aviso de dados defasados.
- publicar no GitHub Pages de `cylindratis/luz` após a validação e conferir o deploy.

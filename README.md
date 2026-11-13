# Projetos do campus por algoritmo genético

Simulador de algoritmo genético (AG) que escolhe projetos de melhoria de um campus com orçamento limitado: maximiza a soma dos benefícios sem ultrapassar o orçamento. Atividade prática da disciplina de Inteligência Artificial, UFPI, período 2026.2.

- **Aplicação publicada:** https://SEU-USUARIO.github.io/ag-projetos-campus/
- **Repositório:** https://github.com/SEU-USUARIO/ag-projetos-campus

## Autores

- Nome completo 1 (matrícula)
- Nome completo 2 (matrícula)
- Nome completo 3 (matrícula)

## Como usar

Abra o link da aplicação; não há login nem instalação. Para rodar localmente, basta abrir `index.html` no navegador.

1. A tela já abre com os dados da seção 6.1 (quatro projetos, orçamento de R$ 7.000) e a configuração da seção 6.5. A geração 0 é criada automaticamente.
2. Edite, adicione ou remova projetos (entre 4 e 15) e ajuste os parâmetros. Qualquer alteração bloqueia Executar e Avançar até que você clique em **Reiniciar**.
3. **Executar** roda as gerações em sequência; **Pausar** interrompe preservando o estado, e Executar retoma de onde parou. **Avançar uma geração** produz exatamente uma geração e mantém a execução pausada. **Reiniciar** limpa o histórico e recria a geração 0 com a semente configurada. A execução encerra ao atingir o número de gerações.
4. A **Bancada** anima as operações reais de cada geração: elitismo, torneios, ponto de corte, troca de segmentos, bits mutados e remoções da reparação (com a barra de custo frente ao orçamento). Você escolhe animar o primeiro par de cada geração, todos os pares, ou nada, e ajusta a velocidade. No registro, o botão “Animar este par” reproduz qualquer par de qualquer geração.
5. O **Registro das operações** mostra, por geração, os candidatos e vencedores de cada torneio, o sorteio e o ponto de corte do cruzamento, os filhos, os genes invertidos, cada passo da reparação, a avaliação e a posição de cada filho na nova população. Cada par termina com um resumo no formato do enunciado. Clicar numa linha do histórico abre o registro daquela geração.
6. **Testes de validação** executa na própria página todos os testes da seção 6, e “Animar o teste 6.4” mostra na bancada o cruzamento e a mutação controlados.
7. Ao clicar em Reiniciar, a configuração aplicada vai para o endereço da página (`?cfg=…`). Copiar esse link reabre exatamente os mesmos dados, parâmetros e semente, o que facilita reproduzir uma execução.
8. Remover um projeto ou restaurar o exemplo pode ser desfeito pelo botão **Desfazer**, que aparece por 10 segundos. Se houver alterações ainda não aplicadas, o navegador pede confirmação antes de sair da página.

Para rodar os testes no terminal: `node tests/run-tests.js`.

## Campos e validação

| Campo | Valor inicial | Regra |
|---|---|---|
| Projetos | dados da seção 6.1 | de 4 a 15 projetos; nome não vazio; custo positivo em reais com até duas casas decimais; benefício não negativo com até duas casas decimais |
| Orçamento disponível (R$) | 7000 | não negativo, até duas casas decimais |
| Tamanho da população | 20 | inteiro ≥ 2 |
| Número de gerações | 50 | inteiro ≥ 1 (a população inicial é a geração 0) |
| Taxa de cruzamento (%) | 80 | entre 0 e 100, aplicada por par de pais |
| Taxa de mutação (%) | 5 | entre 0 e 100, aplicada por gene dos filhos |
| Tamanho do torneio | 2 | inteiro entre 2 e o tamanho da população |
| Indivíduos de elite | 1 | inteiro entre 0 e o tamanho da população menos 1 |
| Semente aleatória | 42 | inteiro |

Valores em reais aceitam vírgula ou ponto para os centavos (`4000,50` ou `4000.50`), sem separador de milhar. Campos vazios ou inválidos ficam destacados com a mensagem do problema, e Reiniciar fica bloqueado até a correção.

## Descrição da solução

**Representação.** Cada indivíduo é um cromossomo binário com um gene por projeto, na ordem da tabela (A, B, C…): 1 seleciona o projeto, 0 o exclui. Internamente, custos são guardados em centavos e benefícios em centésimos de ponto, como inteiros, para evitar erros de arredondamento de ponto flutuante.

**Avaliação.** Soma custo e benefício dos genes 1. A aptidão é o benefício total da solução já reparada; a seleção vazia é válida e tem aptidão 0.

**Reparação.** Enquanto o custo passa do orçamento, remove o projeto selecionado com a menor razão benefício/custo; em empate, o de menor índice. É aplicada à população inicial e a cada filho antes da avaliação.

**Geração 0.** Cada gene de cada indivíduo é sorteado de forma independente, com probabilidade 1/2 de ser 1.

**Seleção por torneio.** Cada pai vem de um torneio independente: sorteiam-se k candidatos distintos (Fisher-Yates parcial) e vence o de maior aptidão; em empate, o de menor índice na população.

**Cruzamento de um ponto.** Para cada par, um sorteio decide se há cruzamento (sorteio < taxa). Se houver, o corte é sorteado entre o primeiro e o penúltimo gene (após o gene 1 até após o gene n−1) e os segmentos finais são trocados. Sem cruzamento, os filhos copiam os pais.

**Mutação por inversão de bits.** Cada gene de cada filho é invertido se o sorteio for menor que a taxa de mutação.

**Elitismo.** Os E melhores da geração anterior (empate pelo menor índice) são copiados sem alterações para as primeiras posições. As vagas restantes recebem filhos, e os pais são sempre selecionados na população anterior. Se sobrar uma única vaga, só o primeiro filho do último par é mantido. O tamanho da população é constante e repetições são permitidas.

**Encerramento.** Após o número configurado de gerações, a aplicação mostra a melhor solução encontrada em toda a execução, incluindo a geração 0, com cromossomo, projetos, custo total, benefício total e saldo.

**Gerador com semente e ordem dos sorteios.** Usamos o gerador mulberry32, implementado em `js/ga.js`. Para sementes entre 0 e 2³²−1 o estado inicial é a própria semente. A ordem dos sorteios é fixa, o que torna cada execução reproduzível:

1. geração 0: indivíduo por indivíduo, gene por gene;
2. em cada par: candidatos do torneio do pai 1, candidatos do torneio do pai 2, sorteio do cruzamento, ponto de corte (só se houver cruzamento), mutação gene a gene do filho 1 e, se houver vaga para ele, do filho 2.

## Estrutura

```
index.html            interface
css/style.css         estilos (tema claro e escuro)
js/ga.js              núcleo do AG: gerador com semente, avaliação, reparação, operadores e motor
js/validation.js      testes da seção 6, usados pela página e pelo Node
js/app.js             interface, controles, histórico, gráfico, registro e animações
tests/run-tests.js    executa os testes no terminal
```

## Bibliotecas

Nenhuma biblioteca de JavaScript foi usada. O algoritmo genético, o gerador pseudoaleatório com semente, o gráfico (canvas) e as animações (CSS e JavaScript) foram escritos para este trabalho. A página carrega apenas as fontes Geist e Geist Mono do Google Fonts, só para a aparência; sem conexão, o navegador usa fontes do sistema.

## Interface e acessibilidade

O visual segue referências de design usadas como orientação; nenhum código delas faz parte do projeto:

- [awesome-design-md](https://github.com/voltagent/awesome-design-md), arquivo `design-md/vercel/DESIGN.md`: fontes Geist e Geist Mono, escala de cinzas, cartões brancos com sombra em camadas e anel interno, botão primário em tinta escura, raio de 6px nos controles, rótulos técnicos em fonte monoespaçada e a malha de gradiente da marca só no topo. A bancada usa o “painel de código” escuro do sistema, nos dois temas, para as animações se destacarem.
- [taste-skill](https://github.com/leonxlnx/taste-skill): camada de movimento (o título entra uma vez ao carregar; botões sobem 1px no hover e afundam no clique; links desenham a linha; anel de foco de 2px). As regras pensadas para sites de empresa, como fotos e uma seção por tela, não se aplicam a um simulador.
- [Web Interface Guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines), da Vercel: link para pular à simulação, foco visível, erro ao lado do campo e foco no primeiro erro ao clicar em Reiniciar, alvos de toque de 44px no celular, `prefers-reduced-motion` respeitado, animações só com `transform` e `opacity`, algarismos tabulares, formatação por `Intl`, cromossomos marcados para não serem traduzidos automaticamente, `theme-color` e estado da configuração no endereço.
- [playwright-cli](https://github.com/microsoft/playwright-cli): usado durante o desenvolvimento para abrir a página num navegador sem interface e capturar telas do topo, da bancada durante a animação, do tema escuro e do celular.

## Resultados dos testes

Todos os testes abaixo foram executados com `node tests/run-tests.js` (os mesmos resultados aparecem no botão “Executar testes” da página). Os testes com operações controladas usam as funções do núcleo diretamente; os testes de taxas e de orçamento rodam o motor completo.

| Seção | Teste | Entrada e parâmetros | Esperado | Obtido | Resultado |
|---|---|---|---|---|---|
| 6.2 | Avaliação de uma solução | cromossomo 1100; orçamento R$ 7.000 | projetos A e B; custo R$ 7.000; benefício 12; saldo R$ 0; viável; aptidão 12 | projetos A e B; custo R$ 7.000; benefício 12; saldo R$ 0; viável; aptidão 12 | ✅ passou |
| 6.2 | Lista das soluções viáveis (16 cromossomos avaliados) | todas as combinações de 0000 a 1111; orçamento R$ 7.000 | 9 viáveis: 0000, 1000, 0100, 0010, 0001, 1100, 1010, 0110, 0011, com os custos e benefícios do enunciado | 0000 (R$ 0; 0), 0001 (R$ 5.000; 8), 0010 (R$ 2.000; 3), 0011 (R$ 7.000; 11), 0100 (R$ 3.000; 5), 0110 (R$ 5.000; 8), 1000 (R$ 4.000; 7), 1010 (R$ 6.000; 10), 1100 (R$ 7.000; 12) | ✅ passou |
| 6.3 | Reparação de uma solução inviável | cromossomo 1111; orçamento R$ 7.000 | 1111 (R$ 14.000; 23) remove C → 1101 (R$ 12.000; 20) remove D → 1100 (R$ 7.000; 12; viável) | 1111 (R$ 14.000; 23) remove C → 1101 (R$ 12.000; 20) remove D → 1100 (R$ 7.000; 12; viável) | ✅ passou |
| 6.4 | Cruzamento forçado com corte após o 2º gene | pai 1 = 1100; pai 2 = 0011; corte = 2 | 11|00 + 00|11 → filho 1 = 1111; filho 2 = 0000 | filho 1 = 1111; filho 2 = 0000 | ✅ passou |
| 6.4 | Mutação controlada (só o 1º gene do filho 1) | filho 1 = 1111, máscara 1000; filho 2 = 0000, sem mutação | filho 1 = 0111; filho 2 = 0000 | filho 1 = 0111 (genes invertidos: A); filho 2 = 0000 | ✅ passou |
| 6.4 | Reparação e avaliação dos filhos | filho 1 = 0111; filho 2 = 0000; orçamento R$ 7.000 | filho 1: 0111 → 0101 → 0100 (remove C, depois D), custo R$ 3.000, aptidão 5; filho 2: 0000, custo R$ 0, aptidão 0 | filho 1: 0111 → 0101 → 0100 (remove C, depois D), custo R$ 3.000, aptidão 5; filho 2: 0000, custo R$ 0, aptidão 0 | ✅ passou |
| 6.4 | Mutação 0% | dados 6.1; população 20; 10 gerações; mutação 0%; semente 42 | nenhum gene invertido pela mutação | 190 descendentes, 0 genes invertidos | ✅ passou |
| 6.4 | Mutação 100% | dados 6.1; população 20; 10 gerações; mutação 100%; semente 42 | todos os genes de todos os descendentes invertidos antes da reparação | 190 descendentes; todos com os 4 genes invertidos | ✅ passou |
| 6.4 | Cruzamento 0% | dados 6.1; população 20; 10 gerações; cruzamento 0%; mutação 0%; semente 42 | nenhum cruzamento; filhos idênticos aos pais antes da mutação | 100 pares; todos os filhos copiam os pais | ✅ passou |
| 6.4 | Cruzamento 100% e faixa do corte | dados 6.1; população 20; 10 gerações; cruzamento 100%; semente 42 | todos os pares cruzam; corte sempre entre o 1º e o penúltimo gene (após o gene 1, 2 ou 3) | todos os pares cruzaram; cortes dentro da faixa | ✅ passou |
| 6.4 | Torneio | candidatos #0 = 1000 (7), #1 = 0011 (11), #2 = 1100 (12) | vence 1100 | vence #2 = 1100 | ✅ passou |
| 6.4 | Torneio com empate | população #0 = 0110 (8), #1 = 0001 (8), #2 = 1000 (7); candidatos sorteados na ordem #1, #0, #2 | empate em 8; vence o menor índice, #0 = 0110 | vence #0 = 0110 | ✅ passou |
| 6.4 | Candidatos distintos no torneio | 2.000 sorteios de 5 candidatos numa população de 20 | nenhum candidato repetido no mesmo torneio | todos os sorteios com candidatos distintos | ✅ passou |
| 6.6 | Orçamento R$ 0 | dados 6.1; orçamento R$ 0; demais parâmetros da 6.5 | toda a população reparada para 0000; custo, benefício e aptidão iguais a zero | todos os indivíduos de todas as 51 gerações são 0000, aptidão 0 | ✅ passou |
| 6.6 | Orçamento R$ 14.000 | cromossomo 1111; orçamento R$ 14.000 | viável; custo R$ 14.000; benefício 23; saldo R$ 0 | viável; custo R$ 14.000; benefício 23; saldo R$ 0 | ✅ passou |
| 6.5 | Execução completa (semente 42) | dados 6.1; população 20; 50 gerações; cruzamento 80%; mutação 5%; torneio 2; elite 1; semente 42 | 51 registros; melhor acumulado nunca diminui; melhor da população nunca diminui (elite 1); totais coerentes, custo ≤ R$ 7.000, benefício ≤ 12 | 51 registros; acumulado não diminui; melhor da população não diminui; melhor solução 1100 (projetos A e B; custo R$ 7.000; benefício 12; saldo R$ 0), encontrada na geração 0; totais coerentes | ✅ passou |
| 6.5 | Reprodutibilidade e elitismo | mesma configuração executada duas vezes | históricos idênticos; o elite de cada geração é o melhor da anterior, sem alterações | históricos idênticos; elite sempre copiado sem alterações | ✅ passou |

**Conclusão dos testes controlados (6.2, 6.3, 6.4 e 6.6).** Todos coincidem com os valores de referência do enunciado: a avaliação de 1100 retorna A e B, R$ 7.000, benefício 12 e saldo zero; as nove soluções viáveis têm os custos e benefícios listados; a reparação de 1111 segue exatamente 1111 → 1101 → 1100; o cruzamento e a mutação controlados geram 0111 e 0000, que viram 0100 (aptidão 5) e 0000 (aptidão 0). As taxas de 0% e 100% se comportam como especificado, o torneio escolhe 1100 e, no empate, o menor índice. Com orçamento zero, toda a população é 0000 em todas as gerações; com R$ 14.000, 1111 é viável com benefício 23 e saldo zero.

### 6.5 Execução completa (semente 42)

Parâmetros: dados da seção 6.1; população 20; 50 gerações; cruzamento 80%; mutação 5% por gene; torneio de tamanho 2; 1 indivíduo de elite; semente 42.

Resultado final: cromossomo **1100**, projetos A (Melhoria da iluminação) e B (Instalação de bicicletários), custo R$ 7.000, benefício 12, saldo R$ 0. É o ótimo global, e ele já estava presente na geração 0 (posição #6).

Verificações: o histórico tem 51 registros (geração 0 e mais 50); o melhor acumulado nunca diminui; com 1 elite, a melhor aptidão da população também nunca diminui; os totais são coerentes com o cromossomo. Duas execuções com a mesma semente produzem históricos idênticos.

<details>
<summary>Histórico completo das 51 gerações</summary>

| Geração | Melhor | Cromossomo | Média | Acumulado |
|---|---|---|---|---|
| 0 | 12 | 1100 | 7,60 | 12 (1100) |
| 1 | 12 | 1100 | 9,45 | 12 (1100) |
| 2 | 12 | 1100 | 9,95 | 12 (1100) |
| 3 | 12 | 1100 | 10,50 | 12 (1100) |
| 4 | 12 | 1100 | 11,65 | 12 (1100) |
| 5 | 12 | 1100 | 11,10 | 12 (1100) |
| 6 | 12 | 1100 | 11,15 | 12 (1100) |
| 7 | 12 | 1100 | 12,00 | 12 (1100) |
| 8 | 12 | 1100 | 12,00 | 12 (1100) |
| 9 | 12 | 1100 | 10,90 | 12 (1100) |
| 10 | 12 | 1100 | 10,75 | 12 (1100) |
| 11 | 12 | 1100 | 11,05 | 12 (1100) |
| 12 | 12 | 1100 | 11,05 | 12 (1100) |
| 13 | 12 | 1100 | 11,15 | 12 (1100) |
| 14 | 12 | 1100 | 10,95 | 12 (1100) |
| 15 | 12 | 1100 | 10,90 | 12 (1100) |
| 16 | 12 | 1100 | 11,75 | 12 (1100) |
| 17 | 12 | 1100 | 11,75 | 12 (1100) |
| 18 | 12 | 1100 | 11,65 | 12 (1100) |
| 19 | 12 | 1100 | 10,80 | 12 (1100) |
| 20 | 12 | 1100 | 11,40 | 12 (1100) |
| 21 | 12 | 1100 | 11,75 | 12 (1100) |
| 22 | 12 | 1100 | 12,00 | 12 (1100) |
| 23 | 12 | 1100 | 11,40 | 12 (1100) |
| 24 | 12 | 1100 | 11,65 | 12 (1100) |
| 25 | 12 | 1100 | 11,15 | 12 (1100) |
| 26 | 12 | 1100 | 11,00 | 12 (1100) |
| 27 | 12 | 1100 | 12,00 | 12 (1100) |
| 28 | 12 | 1100 | 11,75 | 12 (1100) |
| 29 | 12 | 1100 | 11,15 | 12 (1100) |
| 30 | 12 | 1100 | 10,65 | 12 (1100) |
| 31 | 12 | 1100 | 11,50 | 12 (1100) |
| 32 | 12 | 1100 | 11,40 | 12 (1100) |
| 33 | 12 | 1100 | 11,75 | 12 (1100) |
| 34 | 12 | 1100 | 12,00 | 12 (1100) |
| 35 | 12 | 1100 | 11,75 | 12 (1100) |
| 36 | 12 | 1100 | 11,50 | 12 (1100) |
| 37 | 12 | 1100 | 10,80 | 12 (1100) |
| 38 | 12 | 1100 | 11,40 | 12 (1100) |
| 39 | 12 | 1100 | 12,00 | 12 (1100) |
| 40 | 12 | 1100 | 11,30 | 12 (1100) |
| 41 | 12 | 1100 | 11,75 | 12 (1100) |
| 42 | 12 | 1100 | 11,40 | 12 (1100) |
| 43 | 12 | 1100 | 10,80 | 12 (1100) |
| 44 | 12 | 1100 | 11,40 | 12 (1100) |
| 45 | 12 | 1100 | 11,65 | 12 (1100) |
| 46 | 12 | 1100 | 11,55 | 12 (1100) |
| 47 | 12 | 1100 | 11,65 | 12 (1100) |
| 48 | 12 | 1100 | 11,65 | 12 (1100) |
| 49 | 12 | 1100 | 11,40 | 12 (1100) |
| 50 | 12 | 1100 | 11,20 | 12 (1100) |

</details>

Observe que a média da população oscila (por exemplo, cai de 12,00 na geração 8 para 10,90 na 9): a mutação e o cruzamento criam filhos piores que os pais, o que é esperado. O elitismo garante apenas que o melhor indivíduo não se perde.

### Efeito da taxa de mutação: 1% e 20%

Mesmos parâmetros da seção 6.5, trocando só a taxa de mutação; sementes 1 a 5.

| Mutação | Semente | Melhor benefício final | Cromossomo | Geração em que surgiu | Média da população na geração 50 |
|---|---|---|---|---|---|
| 1% | 1 | 12 | 1100 | 0 | 12,00 |
| 1% | 2 | 12 | 1100 | 0 | 11,75 |
| 1% | 3 | 12 | 1100 | 2 | 12,00 |
| 1% | 4 | 12 | 1100 | 0 | 11,30 |
| 1% | 5 | 12 | 1100 | 0 | 12,00 |
| 20% | 1 | 12 | 1100 | 0 | 8,60 |
| 20% | 2 | 12 | 1100 | 0 | 9,50 |
| 20% | 3 | 12 | 1100 | 1 | 9,15 |
| 20% | 4 | 12 | 1100 | 0 | 9,30 |
| 20% | 5 | 12 | 1100 | 0 | 8,10 |

| Mutação | Média do melhor benefício final | Execuções que atingiram 12 | Média da população na geração 50 |
|---|---|---|---|
| 1% | 12,00 | 5 de 5 | 11,81 |
| 20% | 12,00 | 5 de 5 | 8,93 |

**Análise.** As duas taxas atingiram o ótimo (12) nas cinco execuções, com média do melhor benefício final igual a 12 em ambos os casos. Isso se explica pelo tamanho da instância: com quatro projetos existem apenas 16 cromossomos, e 4 deles (1100, 1101, 1110 e 1111) são reparados para 1100. Cada indivíduo da geração 0 tem, portanto, 1/4 de chance de já ser o ótimo, e a chance de nenhum dos 20 sê-lo é 0,75²⁰ ≈ 0,3%. Por isso o ótimo apareceu na geração 0 em quase todas as execuções (a exceção foi a semente 3, em que ele surgiu na geração 2 com mutação de 1% e na geração 1 com 20%), e o elitismo o preservou até o fim.

A diferença entre as taxas aparece na população, não no melhor indivíduo. Com 1%, a população converge: na geração 50 a média ficou em 11,81, com três execuções em que todos os indivíduos eram 1100. Com 20%, cada filho de 4 genes sofre em média 0,8 inversão, muitos bons indivíduos são destruídos e a média final cai para 8,93. Uma taxa alta mantém mais diversidade, o que ajuda a escapar de ótimos locais em instâncias maiores, mas atrapalha a exploração das boas soluções já encontradas; uma taxa baixa explora bem, mas pode estagnar se a população convergir cedo para uma solução subótima. Nesta instância pequena a exploração quase não é necessária, então a taxa baixa resultou em populações melhores sem perder o ótimo. Com mais projetos (por exemplo, 15, com 32.768 combinações), o resultado poderia ser diferente, e nenhuma das duas taxas é superior em todos os casos.

## Publicação no GitHub Pages

1. Crie um repositório público e envie todos os arquivos deste projeto para a raiz.
2. Em *Settings → Pages*, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. Troque `SEU-USUARIO/ag-projetos-campus` pelo endereço real no link “Código no GitHub” do `index.html` e no topo deste README.

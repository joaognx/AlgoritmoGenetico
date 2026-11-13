# Projetos do campus por algoritmo genético

Simulador de algoritmo genético que escolhe projetos de melhoria de um campus com orçamento limitado: maximiza a soma dos benefícios sem ultrapassar o orçamento. Atividade prática da disciplina de Inteligência Artificial, UFPI, período 2026.2.

- **Aplicação:** https://joaognx.github.io/AlgoritmoGenetico/
- **Repositório:** https://github.com/joaognx/AlgoritmoGenetico

## Autores

- João Gabriel Nunes Oliveira Lima
- Mayra Gabriela Sousa da Silva
- Arthur Sobreira Alexandrino

## Como usar

Abra o link da aplicação; não há login nem instalação. Para rodar no computador, abra o `index.html` no navegador ou, dentro da pasta do projeto, rode `python -m http.server 8000` e acesse `http://localhost:8000`.

1. A tela abre com os quatro projetos de exemplo (orçamento de R$ 7.000) e a configuração padrão. A geração 0 já é criada.
2. Edite, adicione ou remova projetos (entre 4 e 15) e ajuste os parâmetros. Depois de qualquer alteração, clique em **Reiniciar** para aplicá-la.
3. **Executar** roda as gerações em sequência. **Pausar** interrompe e guarda o estado, e Executar continua de onde parou. **Avançar uma geração** produz uma única geração e mantém a execução pausada. **Reiniciar** limpa o histórico e recria a geração 0 com a semente configurada.
4. A **Bancada** anima as operações reais de cada geração: elitismo, torneios, ponto de corte, troca de segmentos, bits mutados e remoções da reparação. Escolha animar o primeiro par de cada geração, todos os pares ou nada, e ajuste a velocidade.
5. O **Registro das operações** mostra, geração por geração, os candidatos de cada torneio, o sorteio e o corte do cruzamento, os filhos, os genes invertidos, cada passo da reparação e a posição de cada filho na nova população. O botão “Animar este par” reproduz qualquer par na bancada, e clicar numa geração do histórico abre o registro dela.
6. **Executar testes**, no fim da página, roda os testes de validação. **Animar o teste 6.4** mostra na bancada o cruzamento e a mutação controlados do enunciado.
7. Ao clicar em Reiniciar, a configuração vai para o endereço da página. Copiar esse link reabre os mesmos dados, parâmetros e semente.

Para rodar os testes no terminal (precisa do Node.js): `node tests/run-tests.js`.

## Parâmetros

| Campo | Valor inicial | Regra |
|---|---|---|
| Projetos | 4 projetos de exemplo | de 4 a 15; nome não vazio; custo positivo em reais com até duas casas decimais; benefício não negativo com até duas casas decimais |
| Orçamento disponível (R$) | 7000 | não negativo, até duas casas decimais |
| Tamanho da população | 20 | inteiro ≥ 2 |
| Número de gerações | 50 | inteiro ≥ 1 (a população inicial é a geração 0) |
| Taxa de cruzamento (%) | 80 | entre 0 e 100, aplicada por par de pais |
| Taxa de mutação (%) | 5 | entre 0 e 100, aplicada por gene dos filhos |
| Tamanho do torneio | 2 | inteiro entre 2 e o tamanho da população |
| Indivíduos de elite | 1 | inteiro entre 0 e o tamanho da população menos 1 |
| Semente aleatória | 42 | inteiro |

Valores em reais aceitam vírgula ou ponto para os centavos (`4000,50` ou `4000.50`), sem separador de milhar. Campos inválidos ficam destacados com a mensagem do problema, e a execução fica bloqueada até a correção.

## Como foi feito

**Representação.** Cada solução é um cromossomo binário com um gene por projeto, na ordem da tabela (A, B, C…): 1 seleciona o projeto e 0 o exclui. Custos são guardados em centavos e benefícios em centésimos de ponto, como inteiros, para evitar erros de arredondamento.

**Avaliação.** Soma o custo e o benefício dos projetos selecionados. A aptidão é o benefício total da solução já reparada; a seleção vazia é válida e tem aptidão 0.

**Reparação.** Enquanto o custo passa do orçamento, remove o projeto selecionado com a menor razão benefício/custo; em empate, o de menor índice. Vale para a população inicial e para cada filho, antes da avaliação.

**População inicial.** Cada gene é sorteado de forma independente, com probabilidade 1/2 de ser 1.

**Seleção por torneio.** Cada pai vem de um torneio independente: sorteiam-se candidatos distintos e vence o de maior aptidão; em empate, o de menor índice na população.

**Cruzamento de um ponto.** Para cada par, um sorteio decide se há cruzamento. Se houver, o corte é sorteado entre o primeiro e o penúltimo gene e os segmentos finais são trocados; se não houver, os filhos copiam os pais.

**Mutação.** Cada gene de cada filho é invertido com a probabilidade da taxa de mutação.

**Elitismo.** Os melhores da geração anterior são copiados sem alterações para as primeiras posições. As vagas restantes recebem filhos, sempre com pais escolhidos na população anterior. Se sobrar uma única vaga, só o primeiro filho do último par é mantido. O tamanho da população é constante.

**Encerramento.** Após o número de gerações configurado, a aplicação mostra a melhor solução encontrada em toda a execução, incluindo a geração 0: cromossomo, projetos, custo total, benefício total e saldo.

**Semente e reprodutibilidade.** O gerador pseudoaleatório (mulberry32) foi implementado no próprio projeto. A ordem dos sorteios é fixa, então a mesma semente com os mesmos dados repete a execução: primeiro a geração 0, indivíduo por indivíduo e gene por gene; depois, em cada par, os candidatos dos dois torneios, o sorteio do cruzamento, o ponto de corte (se houver cruzamento) e a mutação gene a gene de cada filho.

### Estrutura dos arquivos

```
index.html            interface
css/style.css         estilos (tema claro e escuro)
js/ga.js              núcleo do algoritmo: gerador com semente, avaliação, reparação, operadores e motor
js/validation.js      testes de validação, usados pela página e pelo Node
js/app.js             controles, histórico, gráfico, registro e animações
tests/run-tests.js    executa os testes no terminal
```

### Tecnologias e bibliotecas

HTML, CSS e JavaScript puros, executados no navegador, sem servidor de aplicação. Nenhuma biblioteca foi usada: o algoritmo genético, o gerador com semente, o gráfico (canvas) e as animações foram escritos para este trabalho. A página carrega apenas as fontes Geist e Geist Mono do Google Fonts; sem conexão, o navegador usa fontes do sistema.

O visual segue o sistema de design da Vercel publicado no repositório [awesome-design-md](https://github.com/voltagent/awesome-design-md), a camada de movimento da [taste-skill](https://github.com/leonxlnx/taste-skill) e as [Web Interface Guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) da Vercel. As telas foram conferidas com o [playwright-cli](https://github.com/microsoft/playwright-cli). Nenhum código dessas referências faz parte do projeto.

## Resultados dos testes

Os testes foram executados com `node tests/run-tests.js`; os mesmos resultados aparecem no botão “Executar testes” da página. Todos usam os dados da seção 6.1 do enunciado: A. Melhoria da iluminação (R$ 4.000; 7), B. Instalação de bicicletários (R$ 3.000; 5), C. Aquisição de bancos (R$ 2.000; 3), D. Reforma de espaço de convivência (R$ 5.000; 8), orçamento de R$ 7.000. Os testes de operações controladas chamam as funções do núcleo diretamente; os de taxas e de orçamento rodam o motor completo.

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

**Conclusão.** Os 17 testes passaram e os testes controlados coincidem com os valores de referência do enunciado: a avaliação de 1100 retorna A e B, R$ 7.000, benefício 12 e saldo zero; a reparação de 1111 segue 1111 → 1101 → 1100; o cruzamento e a mutação controlados geram 0111 e 0000, reparados para 0100 (aptidão 5) e 0000 (aptidão 0). As taxas de 0% e 100% se comportam como especificado, o torneio escolhe 1100 e, no empate, o menor índice. Com orçamento zero, toda a população é 0000; com R$ 14.000, 1111 é viável, com benefício 23 e saldo zero.

### Execução completa (6.5)

Parâmetros: população 20; 50 gerações; cruzamento 80%; mutação 5% por gene; torneio de tamanho 2; 1 indivíduo de elite; semente 42.

Resultado: cromossomo **1100**, projetos A e B, custo R$ 7.000, benefício 12, saldo R$ 0. É o ótimo global, já presente na geração 0 (posição #6). O histórico tem 51 registros (geração 0 e mais 50); o melhor acumulado e, com 1 elite, a melhor aptidão da população nunca diminuem; os totais são coerentes com o cromossomo; duas execuções com a mesma semente geram históricos idênticos. A média da população oscila (por exemplo, de 12,00 na geração 8 para 10,90 na 9), porque cruzamento e mutação criam filhos piores que os pais; o elitismo garante apenas que o melhor não se perde.

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

### Efeito da taxa de mutação: 1% e 20%

Mesmos parâmetros da execução completa, mudando só a taxa de mutação; sementes 1 a 5.

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

**Análise.** As duas taxas atingiram o ótimo (12) nas cinco execuções. Isso se explica pelo tamanho da instância: com quatro projetos há só 16 cromossomos, e 4 deles (1100, 1101, 1110 e 1111) são reparados para 1100. Cada indivíduo da geração 0 tem, portanto, 1/4 de chance de já ser o ótimo, e a chance de nenhum dos 20 sê-lo é 0,75²⁰ ≈ 0,3%. Por isso o ótimo apareceu na geração 0 em quase todas as execuções (a exceção foi a semente 3, em que surgiu na geração 2 com 1% e na geração 1 com 20%), e o elitismo o preservou.

A diferença aparece na população. Com 1%, ela converge: a média final foi 11,81, e em três execuções todos os indivíduos eram 1100. Com 20%, cada filho de 4 genes sofre em média 0,8 inversão, muitas boas soluções são destruídas e a média final cai para 8,93. Uma taxa alta mantém diversidade, o que ajuda a escapar de ótimos locais em instâncias maiores, mas atrapalha o aproveitamento das boas soluções; uma taxa baixa aproveita bem, mas pode estagnar se a população convergir cedo numa solução pior. Nesta instância pequena, a taxa baixa deu populações melhores sem perder o ótimo; com mais projetos, o resultado poderia ser outro, e nenhuma das duas taxas é superior em todos os casos.

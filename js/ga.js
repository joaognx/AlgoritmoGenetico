
/*
 * Algoritmo genético para escolha de projetos (mochila 0/1).
 */

(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica();
  } else {
    raiz.GA = fabrica();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Converte a semente para um número que será usado no sorteio.
  function converterSemente(semente) {
    const numero = Math.trunc(Number(semente));
    const parteBaixa = numero >>> 0;
    const parteAlta = Math.floor(numero / 4294967296) >>> 0;

    return (parteBaixa ^ Math.imul(parteAlta, 0x9E3779B1)) >>> 0;
  }

  // Gerador de números aleatórios.
  function criarAleatorio(semente) {
    let estado = converterSemente(semente);

    const aleatorio = function () {
      estado = (estado + 0x6D2B79F5) >>> 0;

      let valor = estado;
      valor = Math.imul(valor ^ (valor >>> 15), valor | 1);
      valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61);

      return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296;
    };

    aleatorio.obterEstado = () => estado;
    aleatorio.definirEstado = (valor) => {
      estado = valor >>> 0;
    };

    return aleatorio;
  }

  function sortearInteiro(aleatorio, minimo, maximo) {
    return minimo + Math.floor(aleatorio() * (maximo - minimo + 1));
  }

  // Funções para trabalhar com os cromossomos.
  const letraGene = (indice) => String.fromCharCode(65 + indice);
  const transformarEmTexto = (genes) => genes.join('');
  const transformarEmGenes = (texto) => texto.split('').map(Number);

  // Calcula o custo e o benefício dos projetos selecionados.
  function avaliar(genes, projetos, orcamentoCentavos) {
    let custoCentavos = 0;
    let beneficioCent = 0;
    const selecionados = [];

    for (let i = 0; i < genes.length; i++) {
      if (genes[i] === 1) {
        custoCentavos += projetos[i].costCents;
        beneficioCent += projetos[i].benefitHund;
        selecionados.push(i);
      }
    }

    return {
      chromosome: transformarEmTexto(genes),
      selected: selecionados,
      costCents: custoCentavos,
      benefitHund: beneficioCent,
      balanceCents: orcamentoCentavos - custoCentavos,
      feasible: custoCentavos <= orcamentoCentavos
    };
  }

  // Remove projetos até que o orçamento seja respeitado.
  function reparar(genes, projetos, orcamentoCentavos) {
    const novosGenes = genes.slice();
    const etapas = [];

    let resultado = avaliar(novosGenes, projetos, orcamentoCentavos);

    while (resultado.costCents > orcamentoCentavos) {
      let piorProjeto = -1;
      let piorRazao = Infinity;

      for (let i = 0; i < novosGenes.length; i++) {
        if (novosGenes[i] === 1) {
          const razao = projetos[i].benefitHund / projetos[i].costCents;

          if (razao < piorRazao) {
            piorRazao = razao;
            piorProjeto = i;
          }
        }
      }

      const resultadoAnterior = resultado;

      novosGenes[piorProjeto] = 0;

      resultado = avaliar(novosGenes, projetos, orcamentoCentavos);

      etapas.push({
        removed: piorProjeto,
        ratio: piorRazao,
        before: resultadoAnterior.chromosome,
        beforeCostCents: resultadoAnterior.costCents,
        beforeBenefitHund: resultadoAnterior.benefitHund,
        after: resultado.chromosome,
        afterCostCents: resultado.costCents,
        afterBenefitHund: resultado.benefitHund
      });
    }

    return {
      genes: novosGenes,
      steps: etapas,
      evaluation: resultado
    };
  }

  // Cruzamento de dois indivíduos.
  function cruzar(pai1, pai2, corte) {
    const filho1 = pai1.slice(0, corte).concat(pai2.slice(corte));
    const filho2 = pai2.slice(0, corte).concat(pai1.slice(corte));

    return [filho1, filho2];
  }

  // Altera os genes indicados pela máscara.
  function mutar(genes, mascara) {
    const novosGenes = genes.slice();
    const alterados = [];

    for (let i = 0; i < novosGenes.length; i++) {
      if (mascara[i]) {
        novosGenes[i] = 1 - novosGenes[i];
        alterados.push(i);
      }
    }

    return {
      genes: novosGenes,
      flipped: alterados
    };
  }

  // Sorteia índices sem repetir.
  function sortearIndices(aleatorio, quantidade, total) {
    const indices = Array.from({ length: quantidade }, (_, i) => i);

    for (let i = 0; i < total; i++) {
      const sorteado = sortearInteiro(aleatorio, i, quantidade - 1);

      const temporario = indices[i];
      indices[i] = indices[sorteado];
      indices[sorteado] = temporario;
    }

    return indices.slice(0, total);
  }

  // Escolhe o indivíduo com maior aptidão.
  function vencedorTorneio(candidatos, aptidoes) {
    let melhor = candidatos[0];

    for (const candidato of candidatos) {
      if (
        aptidoes[candidato] > aptidoes[melhor] ||
        (aptidoes[candidato] === aptidoes[melhor] && candidato < melhor)
      ) {
        melhor = candidato;
      }
    }

    return melhor;
  }

  // Separa os melhores indivíduos da população.
  function obterMelhores(aptidoes, quantidade) {
    const ordem = aptidoes.map((_, indice) => indice);

    ordem.sort((a, b) => {
      if (aptidoes[a] === aptidoes[b]) {
        return a - b;
      }

      return aptidoes[b] - aptidoes[a];
    });

    return ordem.slice(0, quantidade);
  }

  // Classe principal do algoritmo genético.
  class AlgoritmoGenetico {
    constructor(configuracao) {
      this.config = Object.assign({}, configuracao);
      this.quantidadeGenes = configuracao.projects.length;

      this.aleatorio = criarAleatorio(configuracao.seed);

      this.geracao = 0;
      this.historico = [];
      this.registros = [];
      this.melhor = null;

      this.iniciar();
    }

    get finalizado() {
      return this.geracao >= this.config.generations;
    }

    criarIndividuo(reparacao) {
      return {
        genes: reparacao.genes,
        ev: reparacao.evaluation
      };
    }

    // Monta a população inicial.
    iniciar() {
      const { projects, budgetCents, popSize } = this.config;

      const populacao = [];
      const eventos = [];

      for (let i = 0; i < popSize; i++) {
        const genes = [];

        for (let j = 0; j < this.quantidadeGenes; j++) {
          genes.push(this.aleatorio() < 0.5 ? 1 : 0);
        }

        const reparacao = reparar(genes, projects, budgetCents);

        populacao.push(this.criarIndividuo(reparacao));

        eventos.push({
          index: i,
          raw: transformarEmTexto(genes),
          repair: reparacao.steps,
          final: reparacao.evaluation
        });
      }

      this.populacao = populacao;

      this.registros.push({
        generation: 0,
        type: 'init',
        individuals: eventos
      });

      this.registrar();
    }

    // Guarda os resultados de cada geração.
    registrar() {
      const aptidoes = this.populacao.map(
        (individuo) => individuo.ev.benefitHund
      );

      let indiceMelhor = 0;

      for (let i = 1; i < aptidoes.length; i++) {
        if (aptidoes[i] > aptidoes[indiceMelhor]) {
          indiceMelhor = i;
        }
      }

      const media =
        aptidoes.reduce((soma, valor) => soma + valor, 0) / aptidoes.length;

      const melhorGeracao = this.populacao[indiceMelhor];

      if (
        this.melhor === null ||
        melhorGeracao.ev.benefitHund > this.melhor.ev.benefitHund
      ) {
        this.melhor = {
          genes: melhorGeracao.genes.slice(),
          ev: melhorGeracao.ev,
          generation: this.geracao,
          index: indiceMelhor
        };
      }

      this.historico.push({
        generation: this.geracao,
        bestHund: melhorGeracao.ev.benefitHund,
        bestChromosome: melhorGeracao.ev.chromosome,
        bestIndex: indiceMelhor,
        meanHund: media,
        bestSoFarHund: this.melhor.ev.benefitHund,
        bestSoFarChromosome: this.melhor.ev.chromosome,
        bestSoFarGeneration: this.melhor.generation
      });
    }

    // Faz a seleção por torneio.
    torneio(aptidoes) {
      const candidatos = sortearIndices(
        this.aleatorio,
        this.config.popSize,
        this.config.tournamentSize
      );

      const vencedor = vencedorTorneio(candidatos, aptidoes);
      const maiorAptidao = Math.max(
        ...candidatos.map((indice) => aptidoes[indice])
      );

      return {
        candidates: candidatos.map((indice) => ({
          index: indice,
          chromosome: this.populacao[indice].ev.chromosome,
          fitnessHund: aptidoes[indice]
        })),

        winner: vencedor,

        tie: candidatos.filter(
          (indice) => aptidoes[indice] === maiorAptidao
        ).length > 1
      };
    }

    // Cria uma nova geração.
    proximaGeracao() {
      if (this.finalizado) {
        return null;
      }

      const {
        projects,
        budgetCents,
        popSize,
        eliteCount,
        crossoverRate,
        mutationRate
      } = this.config;

      const populacaoAnterior = this.populacao;
      const aptidoes = populacaoAnterior.map(
        (individuo) => individuo.ev.benefitHund
      );

      const novaPopulacao = [];

      const registro = {
        generation: this.geracao + 1,
        type: 'gen',
        elite: [],
        pairs: []
      };

      // Os melhores são mantidos na nova população.
      const melhores = obterMelhores(aptidoes, eliteCount);

      for (const indice of melhores) {
        novaPopulacao.push({
          genes: populacaoAnterior[indice].genes.slice(),
          ev: populacaoAnterior[indice].ev
        });

        registro.elite.push({
          from: indice,
          to: novaPopulacao.length - 1,
          chromosome: populacaoAnterior[indice].ev.chromosome,
          fitnessHund: aptidoes[indice]
        });
      }

      let numeroPar = 0;

      while (novaPopulacao.length < popSize) {
        const torneio1 = this.torneio(aptidoes);
        const torneio2 = this.torneio(aptidoes);

        const pai1 = populacaoAnterior[torneio1.winner].genes;
        const pai2 = populacaoAnterior[torneio2.winner].genes;

        const sorteio = this.aleatorio();
        const houveCruzamento = sorteio < crossoverRate;

        let corte = null;
        let filho1;
        let filho2;

        if (houveCruzamento) {
          corte = sortearInteiro(
            this.aleatorio,
            1,
            this.quantidadeGenes - 1
          );

          [filho1, filho2] = cruzar(pai1, pai2, corte);
        } else {
          filho1 = pai1.slice();
          filho2 = pai2.slice();
        }

        const manterDois = popSize - novaPopulacao.length >= 2;

        const filhos = manterDois ? [filho1, filho2] : [filho1];
        const resultadosFilhos = [];

        // Aplica mutação e verifica o orçamento dos filhos.
        for (const filho of filhos) {
          const mascara = [];

          for (let j = 0; j < this.quantidadeGenes; j++) {
            mascara.push(this.aleatorio() < mutationRate);
          }

          const mutacao = mutar(filho, mascara);

          const reparacao = reparar(
            mutacao.genes,
            projects,
            budgetCents
          );

          novaPopulacao.push(this.criarIndividuo(reparacao));

          resultadosFilhos.push({
            beforeMutation: transformarEmTexto(filho),
            flipped: mutacao.flipped,
            afterMutation: transformarEmTexto(mutacao.genes),
            repair: reparacao.steps,
            final: reparacao.evaluation,
            placedAt: novaPopulacao.length - 1
          });
        }

        registro.pairs.push({
          pair: ++numeroPar,

          tournaments: [torneio1, torneio2],

          parents: [
            {
              index: torneio1.winner,
              chromosome: transformarEmTexto(pai1),
              fitnessHund: aptidoes[torneio1.winner]
            },
            {
              index: torneio2.winner,
              chromosome: transformarEmTexto(pai2),
              fitnessHund: aptidoes[torneio2.winner]
            }
          ],

          crossover: {
            draw: sorteio,
            rate: crossoverRate,
            happened: houveCruzamento,
            cut: corte
          },

          offspring: [
            transformarEmTexto(filho1),
            transformarEmTexto(filho2)
          ],

          discardedSecond: !manterDois,
          children: resultadosFilhos
        });
      }

      this.populacao = novaPopulacao;
      this.geracao++;

      this.registros.push(registro);

      this.registrar();

      return registro;
    }

    // Executa até chegar à última geração.
    executarAteOFim() {
      while (!this.finalizado) {
        this.proximaGeracao();
      }

      return this;
    }
  }

  return {
    criarAleatorio,
    sortearInteiro,
    converterSemente,

    letraGene,
    transformarEmTexto,
    transformarEmGenes,

    avaliar,
    reparar,
    cruzar,
    mutar,

    sortearIndices,
    vencedorTorneio,
    obterMelhores,

    AlgoritmoGenetico
  };
});

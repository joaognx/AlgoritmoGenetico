
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ga.js'));
  else root.Validation = factory(root.GA);
})(typeof self !== 'undefined' ? self : this, function (GA) {
  'use strict';

  const PROJECTS = [
    { name: 'Melhoria da iluminação', costCents: 400000, benefitHund: 700 },
    { name: 'Instalação de bicicletários', costCents: 300000, benefitHund: 500 },
    { name: 'Aquisição de bancos', costCents: 200000, benefitHund: 300 },
    { name: 'Reforma de espaço de convivência', costCents: 500000, benefitHund: 800 },
  ];
  const BUDGET = 700000;

  const brl = (c) => (c / 100).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: c % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
  }).replace(/\u00a0/g, ' ');
  const pts = (h) => (h / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const L = GA.letraGene;
  const names = (sel) => sel.length ? sel.map(L).join(' e ') : 'nenhum';
  const repairPath = (start, steps) => [start].concat(steps.map((s) => s.after)).join(' → ');

  function baseConfig(over) {
    return Object.assign({
      projects: PROJECTS, budgetCents: BUDGET, popSize: 20, generations: 50,
      crossoverRate: 0.8, mutationRate: 0.05, tournamentSize: 2, eliteCount: 1, seed: 42,
    }, over || {});
  }

  function runValidation() {
    const tests = [];
    const add = (t) => tests.push(t);

    /* 6.2 Avaliação de uma solução */
    {
      const ev = GA.avaliar(GA.transformarEmGenes('1100'), PROJECTS, BUDGET);
      const obtained = `projetos ${names(ev.selected)}; custo ${brl(ev.costCents)}; benefício ${pts(ev.benefitHund)}; saldo ${brl(ev.balanceCents)}; ${ev.feasible ? 'viável' : 'inviável'}; aptidão ${pts(ev.benefitHund)}`;
      add({
        id: '6.2', title: 'Avaliação de uma solução',
        input: 'cromossomo 1100; orçamento R$ 7.000',
        expected: 'projetos A e B; custo R$ 7.000; benefício 12; saldo R$ 0; viável; aptidão 12',
        obtained,
        pass: ev.selected.join() === '0,1' && ev.costCents === 700000 && ev.benefitHund === 1200 && ev.balanceCents === 0 && ev.feasible,
      });

      const expectedFeasible = {
        '0000': [0, 0], '1000': [400000, 700], '0100': [300000, 500], '0010': [200000, 300],
        '0001': [500000, 800], '1100': [700000, 1200], '1010': [600000, 1000],
        '0110': [500000, 800], '0011': [700000, 1100],
      };
      const found = {};
      for (let m = 0; m < 16; m++) {
        const s = m.toString(2).padStart(4, '0');
        const ev2 = GA.avaliar(GA.transformarEmGenes(s), PROJECTS, BUDGET);
        if (ev2.feasible) found[s] = [ev2.costCents, ev2.benefitHund];
      }
      const ok = Object.keys(found).length === 9 &&
        Object.keys(expectedFeasible).every((k) => found[k] && found[k][0] === expectedFeasible[k][0] && found[k][1] === expectedFeasible[k][1]);
      add({
        id: '6.2', title: 'Lista das soluções viáveis (16 cromossomos avaliados)',
        input: 'todas as combinações de 0000 a 1111; orçamento R$ 7.000',
        expected: '9 viáveis: 0000, 1000, 0100, 0010, 0001, 1100, 1010, 0110, 0011, com os custos e benefícios do enunciado',
        obtained: Object.keys(found).sort().map((k) => `${k} (${brl(found[k][0])}; ${pts(found[k][1])})`).join(', '),
        pass: ok,
      });
    }

    /* 6.3 Reparação */
    {
      const rep = GA.reparar(GA.transformarEmGenes('1111'), PROJECTS, BUDGET);
      const desc = rep.steps.map((s) => `${s.before} (${brl(s.beforeCostCents)}; ${pts(s.beforeBenefitHund)}) remove ${L(s.removed)}`).join(' → ');
      const ev = rep.evaluation;
      add({
        id: '6.3', title: 'Reparação de uma solução inviável',
        input: 'cromossomo 1111; orçamento R$ 7.000',
        expected: '1111 (R$ 14.000; 23) remove C → 1101 (R$ 12.000; 20) remove D → 1100 (R$ 7.000; 12; viável)',
        obtained: `${desc} → ${ev.chromosome} (${brl(ev.costCents)}; ${pts(ev.benefitHund)}; ${ev.feasible ? 'viável' : 'inviável'})`,
        pass: rep.steps.length === 2 &&
          rep.steps[0].before === '1111' && rep.steps[0].beforeCostCents === 1400000 && rep.steps[0].beforeBenefitHund === 2300 && rep.steps[0].removed === 2 &&
          rep.steps[1].before === '1101' && rep.steps[1].beforeCostCents === 1200000 && rep.steps[1].beforeBenefitHund === 2000 && rep.steps[1].removed === 3 &&
          ev.chromosome === '1100' && ev.costCents === 700000 && ev.benefitHund === 1200 && ev.feasible,
      });
    }

    /* 6.4 Cruzamento e mutação controlados */
    {
      const [c1, c2] = GA.cruzar(GA.transformarEmGenes('1100'), GA.transformarEmGenes('0011'), 2);
      const m1 = GA.mutar(c1, [true, false, false, false]);
      const m2 = GA.mutar(c2, [false, false, false, false]);
      const r1 = GA.reparar(m1.genes, PROJECTS, BUDGET);
      const r2 = GA.reparar(m2.genes, PROJECTS, BUDGET);
      add({
        id: '6.4', title: 'Cruzamento forçado com corte após o 2º gene',
        input: 'pai 1 = 1100; pai 2 = 0011; corte = 2',
        expected: '11|00 + 00|11 → filho 1 = 1111; filho 2 = 0000',
        obtained: `filho 1 = ${GA.transformarEmTexto(c1)}; filho 2 = ${GA.transformarEmTexto(c2)}`,
        pass: GA.transformarEmTexto(c1) === '1111' && GA.transformarEmTexto(c2) === '0000',
      });
      add({
        id: '6.4', title: 'Mutação controlada (só o 1º gene do filho 1)',
        input: 'filho 1 = 1111, máscara 1000; filho 2 = 0000, sem mutação',
        expected: 'filho 1 = 0111; filho 2 = 0000',
        obtained: `filho 1 = ${GA.transformarEmTexto(m1.genes)} (genes invertidos: ${m1.flipped.map(L).join(', ') || 'nenhum'}); filho 2 = ${GA.transformarEmTexto(m2.genes)}`,
        pass: GA.transformarEmTexto(m1.genes) === '0111' && GA.transformarEmTexto(m2.genes) === '0000',
      });
      add({
        id: '6.4', title: 'Reparação e avaliação dos filhos',
        input: 'filho 1 = 0111; filho 2 = 0000; orçamento R$ 7.000',
        expected: 'filho 1: 0111 → 0101 → 0100 (remove C, depois D), custo R$ 3.000, aptidão 5; filho 2: 0000, custo R$ 0, aptidão 0',
        obtained: `filho 1: ${repairPath('0111', r1.steps)} (remove ${r1.steps.map((s) => L(s.removed)).join(', depois ')}), custo ${brl(r1.evaluation.costCents)}, aptidão ${pts(r1.evaluation.benefitHund)}; filho 2: ${repairPath('0000', r2.steps)}, custo ${brl(r2.evaluation.costCents)}, aptidão ${pts(r2.evaluation.benefitHund)}`,
        pass: repairPath('0111', r1.steps) === '0111 → 0101 → 0100' && r1.evaluation.costCents === 300000 && r1.evaluation.benefitHund === 500 &&
          r2.steps.length === 0 && r2.evaluation.chromosome === '0000' && r2.evaluation.benefitHund === 0,
      });
    }

    /* 6.4 Limites das taxas, no motor real */
    {
      const e0 = new GA.AlgoritmoGenetico(baseConfig({ mutationRate: 0, generations: 10 })).executarAteOFim();
      let flips = 0, kids = 0;
      e0.registros.slice(1).forEach((l) => l.pairs.forEach((p) => p.children.forEach((c) => { kids++; flips += c.flipped.length; })));
      add({
        id: '6.4', title: 'Mutação 0%',
        input: 'dados 6.1; população 20; 10 gerações; mutação 0%; semente 42',
        expected: 'nenhum gene invertido pela mutação',
        obtained: `${kids} descendentes, ${flips} genes invertidos`,
        pass: kids > 0 && flips === 0,
      });

      const e1 = new GA.AlgoritmoGenetico(baseConfig({ mutationRate: 1, generations: 10 })).executarAteOFim();
      let allFlipped = true; kids = 0;
      e1.registros.slice(1).forEach((l) => l.pairs.forEach((p) => p.children.forEach((c) => {
        kids++;
        const comp = c.beforeMutation.split('').map((b) => (b === '1' ? '0' : '1')).join('');
        if (c.afterMutation !== comp || c.flipped.length !== 4) allFlipped = false;
      })));
      add({
        id: '6.4', title: 'Mutação 100%',
        input: 'dados 6.1; população 20; 10 gerações; mutação 100%; semente 42',
        expected: 'todos os genes de todos os descendentes invertidos antes da reparação',
        obtained: `${kids} descendentes; ${allFlipped ? 'todos com os 4 genes invertidos' : 'há descendente com gene não invertido'}`,
        pass: kids > 0 && allFlipped,
      });

      const ec = new GA.AlgoritmoGenetico(baseConfig({ crossoverRate: 0, mutationRate: 0, generations: 10 })).executarAteOFim();
      let copies = true, pairs = 0;
      ec.registros.slice(1).forEach((l) => l.pairs.forEach((p) => {
        pairs++;
        if (p.crossover.happened || p.offspring[0] !== p.parents[0].chromosome || p.offspring[1] !== p.parents[1].chromosome) copies = false;
      }));
      add({
        id: '6.4', title: 'Cruzamento 0%',
        input: 'dados 6.1; população 20; 10 gerações; cruzamento 0%; mutação 0%; semente 42',
        expected: 'nenhum cruzamento; filhos idênticos aos pais antes da mutação',
        obtained: `${pairs} pares; ${copies ? 'todos os filhos copiam os pais' : 'há filho diferente dos pais'}`,
        pass: pairs > 0 && copies,
      });

      const e100 = new GA.AlgoritmoGenetico(baseConfig({ crossoverRate: 1, generations: 10 })).executarAteOFim();
      let allCross = true, cutsOk = true;
      e100.registros.slice(1).forEach((l) => l.pairs.forEach((p) => {
        if (!p.crossover.happened) allCross = false;
        if (!(p.crossover.cut >= 1 && p.crossover.cut <= 3)) cutsOk = false;
      }));
      add({
        id: '6.4', title: 'Cruzamento 100% e faixa do corte',
        input: 'dados 6.1; população 20; 10 gerações; cruzamento 100%; semente 42',
        expected: 'todos os pares cruzam; corte sempre entre o 1º e o penúltimo gene (após o gene 1, 2 ou 3)',
        obtained: `${allCross ? 'todos os pares cruzaram' : 'algum par não cruzou'}; ${cutsOk ? 'cortes dentro da faixa' : 'corte fora da faixa'}`,
        pass: allCross && cutsOk,
      });
    }

    /* 6.4 Seleção por torneio isolada */
    {
      const fit = [700, 1100, 1200];
      const w = GA.vencedorTorneio([0, 1, 2], fit);
      add({
        id: '6.4', title: 'Torneio',
        input: 'candidatos #0 = 1000 (7), #1 = 0011 (11), #2 = 1100 (12)',
        expected: 'vence 1100',
        obtained: `vence #${w} = ${['1000', '0011', '1100'][w]}`,
        pass: w === 2,
      });
      const fitTie = [800, 800, 700];
      const wt = GA.vencedorTorneio([1, 0, 2], fitTie);
      add({
        id: '6.4', title: 'Torneio com empate',
        input: 'população #0 = 0110 (8), #1 = 0001 (8), #2 = 1000 (7); candidatos sorteados na ordem #1, #0, #2',
        expected: 'empate em 8; vence o menor índice, #0 = 0110',
        obtained: `vence #${wt} = ${['0110', '0001', '1000'][wt]}`,
        pass: wt === 0,
      });
      const rng = GA.criarAleatorio(7);
      let distinct = true;
      for (let t = 0; t < 2000; t++) {
        const c = GA.sortearIndices(rng, 20, 5);
        if (new Set(c).size !== 5 || c.some((x) => x < 0 || x >= 20)) distinct = false;
      }
      add({
        id: '6.4', title: 'Candidatos distintos no torneio',
        input: '2.000 sorteios de 5 candidatos numa população de 20',
        expected: 'nenhum candidato repetido no mesmo torneio',
        obtained: distinct ? 'todos os sorteios com candidatos distintos' : 'houve repetição',
        pass: distinct,
      });
    }

    /* 6.6 Limites de orçamento */
    {
      const e = new GA.AlgoritmoGenetico(baseConfig({ budgetCents: 0 })).executarAteOFim();
      let all0 = true;
      // geração atual e geração 0 (registrada no log)
      if (!e.registros[0].individuals.every((i) => i.final.chromosome === '0000')) all0 = false;
      if (!e.populacao.every((p) => p.ev.chromosome === '0000' && p.ev.benefitHund === 0)) all0 = false;
      if (!e.historico.every((h) => h.bestHund === 0 && h.meanHund === 0)) all0 = false;
      add({
        id: '6.6', title: 'Orçamento R$ 0',
        input: 'dados 6.1; orçamento R$ 0; demais parâmetros da 6.5',
        expected: 'toda a população reparada para 0000; custo, benefício e aptidão iguais a zero',
        obtained: all0 ? 'todos os indivíduos de todas as 51 gerações são 0000, aptidão 0' : 'há indivíduo diferente de 0000',
        pass: all0,
      });
      const ev = GA.avaliar(GA.transformarEmGenes('1111'), PROJECTS, 1400000);
      add({
        id: '6.6', title: 'Orçamento R$ 14.000',
        input: 'cromossomo 1111; orçamento R$ 14.000',
        expected: 'viável; custo R$ 14.000; benefício 23; saldo R$ 0',
        obtained: `${ev.feasible ? 'viável' : 'inviável'}; custo ${brl(ev.costCents)}; benefício ${pts(ev.benefitHund)}; saldo ${brl(ev.balanceCents)}`,
        pass: ev.feasible && ev.costCents === 1400000 && ev.benefitHund === 2300 && ev.balanceCents === 0,
      });
    }

    /* 6.5 Execução completa */
    const full = fullRun();
    add({
      id: '6.5', title: 'Execução completa (semente 42)',
      input: 'dados 6.1; população 20; 50 gerações; cruzamento 80%; mutação 5%; torneio 2; elite 1; semente 42',
      expected: '51 registros; melhor acumulado nunca diminui; melhor da população nunca diminui (elite 1); totais coerentes, custo ≤ R$ 7.000, benefício ≤ 12',
      obtained: `${full.records} registros; acumulado ${full.monotoneBestSoFar ? 'não diminui' : 'DIMINUI'}; melhor da população ${full.monotoneBest ? 'não diminui' : 'DIMINUI'}; melhor solução ${full.best.chromosome} (projetos ${names(full.best.selected)}; custo ${brl(full.best.costCents)}; benefício ${pts(full.best.benefitHund)}; saldo ${brl(full.best.balanceCents)}), encontrada na geração ${full.bestGeneration}; totais ${full.consistent ? 'coerentes' : 'INCOERENTES'}`,
      pass: full.records === 51 && full.monotoneBestSoFar && full.monotoneBest && full.consistent,
    });

    {
      const a = new GA.AlgoritmoGenetico(baseConfig()).executarAteOFim();
      const b = new GA.AlgoritmoGenetico(baseConfig()).executarAteOFim();
      const same = JSON.stringify(a.historico) === JSON.stringify(b.historico);
      let eliteOk = true;
      for (let g = 1; g < a.registros.length; g++) {
        const prevBest = a.historico[g - 1].bestChromosome;
        const el = a.registros[g].elite[0];
        if (!el || el.chromosome !== prevBest || a.historico[g].bestHund < a.historico[g - 1].bestHund) eliteOk = false;
      }
      add({
        id: '6.5', title: 'Reprodutibilidade e elitismo',
        input: 'mesma configuração executada duas vezes',
        expected: 'históricos idênticos; o elite de cada geração é o melhor da anterior, sem alterações',
        obtained: `${same ? 'históricos idênticos' : 'históricos diferentes'}; ${eliteOk ? 'elite sempre copiado sem alterações' : 'falha no elitismo'}`,
        pass: same && eliteOk,
      });
    }

    return tests;
  }

  function fullRun(over) {
    const e = new GA.AlgoritmoGenetico(baseConfig(over)).executarAteOFim();
    let monotoneBestSoFar = true, monotoneBest = true;
    for (let i = 1; i < e.historico.length; i++) {
      if (e.historico[i].bestSoFarHund < e.historico[i - 1].bestSoFarHund) monotoneBestSoFar = false;
      if (e.historico[i].bestHund < e.historico[i - 1].bestHund) monotoneBest = false;
    }
    const best = e.melhor.ev;
    const re = GA.avaliar(e.melhor.genes, PROJECTS, BUDGET);
    const consistent = re.costCents === best.costCents && re.benefitHund === best.benefitHund &&
      best.costCents <= BUDGET && best.benefitHund <= 1200;
    return { engine: e, records: e.historico.length, monotoneBestSoFar, monotoneBest, best, bestGeneration: e.melhor.generation, consistent };
  }

  /** Comparação das taxas de mutação de 1% e 20%, sementes 1 a 5. */
  function mutationComparison() {
    return [0.01, 0.20].map((rate) => {
      const runs = [1, 2, 3, 4, 5].map((seed) => {
        const r = fullRun({ mutationRate: rate, seed });
        const meanLast = r.engine.historico[r.engine.historico.length - 1].meanHund;
        return { seed, bestHund: r.best.benefitHund, chromosome: r.best.chromosome, generation: r.bestGeneration, finalMeanHund: meanLast };
      });
      const mean = runs.reduce((s, r) => s + r.bestHund, 0) / runs.length;
      const meanPop = runs.reduce((s, r) => s + r.finalMeanHund, 0) / runs.length;
      return { rate, runs, meanBestHund: mean, hits12: runs.filter((r) => r.bestHund === 1200).length, meanFinalPopHund: meanPop };
    });
  }

  return { PROJECTS, BUDGET, runValidation, fullRun, mutationComparison, brl, pts };
});

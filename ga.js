/*
 * Núcleo do algoritmo genético para seleção de projetos (mochila 0/1).
 * Implementado do zero, sem bibliotecas. Funciona no navegador (window.GA)
 * e no Node (require('./ga.js')).
 *
 * Unidades internas (inteiros, para evitar erros de ponto flutuante):
 *   costCents   -> custo em centavos de real
 *   benefitHund -> benefício em centésimos de ponto
 *   aptidão     -> benefitHund da solução reparada
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Gerador pseudoaleatório com semente (mulberry32) ---------- */

  function seedToState(seed) {
    const n = Math.trunc(Number(seed));
    const lo = n >>> 0;                              // 32 bits baixos
    const hi = Math.floor(n / 4294967296) >>> 0;     // bits altos (sementes grandes ou negativas)
    return (lo ^ Math.imul(hi, 0x9E3779B1)) >>> 0;   // para 0 <= semente < 2^32, estado = semente
  }

  function createRng(seed) {
    let a = seedToState(seed);
    const rng = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // [0, 1)
    };
    rng.getState = () => a;
    rng.setState = (s) => { a = s >>> 0; };
    return rng;
  }

  /** Inteiro uniforme em [lo, hi], inclusive. */
  function randInt(rng, lo, hi) {
    return lo + Math.floor(rng() * (hi - lo + 1));
  }

  /* ---------- Utilidades de cromossomo ---------- */

  const geneLetter = (i) => String.fromCharCode(65 + i);
  const toStr = (genes) => genes.join('');
  const fromStr = (s) => s.split('').map(Number);

  /* ---------- Avaliação ---------- */

  function evaluate(genes, projects, budgetCents) {
    let costCents = 0, benefitHund = 0;
    const selected = [];
    for (let i = 0; i < genes.length; i++) {
      if (genes[i] === 1) {
        costCents += projects[i].costCents;
        benefitHund += projects[i].benefitHund;
        selected.push(i);
      }
    }
    return {
      chromosome: toStr(genes),
      selected,
      costCents,
      benefitHund,
      balanceCents: budgetCents - costCents,
      feasible: costCents <= budgetCents,
    };
  }

  /* ---------- Reparação ----------
   * Enquanto o custo ultrapassar o orçamento, remove o projeto selecionado
   * com a menor razão benefício/custo; em empate, o de menor índice.
   * Custos são inteiros positivos; razões iguais produzem o mesmo double.
   */
  function repair(genes, projects, budgetCents) {
    const g = genes.slice();
    const steps = [];
    let ev = evaluate(g, projects, budgetCents);
    while (ev.costCents > budgetCents) {
      let worst = -1, worstRatio = Infinity;
      for (let i = 0; i < g.length; i++) {
        if (g[i] !== 1) continue;
        const ratio = projects[i].benefitHund / projects[i].costCents;
        if (ratio < worstRatio) { worstRatio = ratio; worst = i; } // estrito: mantém o menor índice no empate
      }
      const before = ev;
      g[worst] = 0;
      ev = evaluate(g, projects, budgetCents);
      steps.push({
        removed: worst,
        ratio: worstRatio,
        before: before.chromosome,
        beforeCostCents: before.costCents,
        beforeBenefitHund: before.benefitHund,
        after: ev.chromosome,
        afterCostCents: ev.costCents,
        afterBenefitHund: ev.benefitHund,
      });
    }
    return { genes: g, steps, evaluation: ev };
  }

  /* ---------- Operadores ---------- */

  /** Cruzamento de um ponto. cut = quantidade de genes antes do corte (1..n-1). */
  function crossover(p1, p2, cut) {
    return [
      p1.slice(0, cut).concat(p2.slice(cut)),
      p2.slice(0, cut).concat(p1.slice(cut)),
    ];
  }

  /** Inverte os genes indicados pela máscara (true = inverter). */
  function mutate(genes, mask) {
    const out = genes.slice();
    const flipped = [];
    for (let i = 0; i < out.length; i++) {
      if (mask[i]) { out[i] = 1 - out[i]; flipped.push(i); }
    }
    return { genes: out, flipped };
  }

  /** Sorteia k índices distintos em [0, n) (Fisher-Yates parcial). */
  function drawDistinct(rng, n, k) {
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = 0; i < k; i++) {
      const j = randInt(rng, i, n - 1);
      const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    return idx.slice(0, k);
  }

  /** Vencedor do torneio: maior aptidão; empate -> menor índice na população. */
  function tournamentWinner(candidates, fitness) {
    let best = candidates[0];
    for (const c of candidates) {
      if (fitness[c] > fitness[best] || (fitness[c] === fitness[best] && c < best)) best = c;
    }
    return best;
  }

  /** Índices dos E melhores (aptidão decrescente; empate -> menor índice). */
  function eliteIndices(fitness, count) {
    const order = fitness.map((_, i) => i)
      .sort((a, b) => (fitness[b] - fitness[a]) || (a - b));
    return order.slice(0, count);
  }

  /* ---------- Motor do AG ----------
   * Ordem dos sorteios (importante para a reprodutibilidade):
   *  Geração 0: para cada indivíduo, para cada gene, rng() < 0,5 -> 1.
   *  Gerações seguintes, para cada par, até completar a população:
   *   1. torneio do pai 1: k índices distintos (Fisher-Yates parcial);
   *   2. torneio do pai 2: idem, independente;
   *   3. rng() < taxa de cruzamento -> cruza; se cruzar, corte = inteiro em [1, n-1];
   *   4. mutação do filho 1: rng() < taxa, gene a gene;
   *   5. mutação do filho 2 (só se houver vaga para ele): idem.
   */
  class Engine {
    constructor(cfg) {
      this.cfg = Object.assign({}, cfg);
      this.n = cfg.projects.length;
      this.rng = createRng(cfg.seed);
      this.generation = 0;
      this.history = [];
      this.logs = [];
      this.best = null; // melhor indivíduo de toda a execução
      this._init();
    }

    get finished() { return this.generation >= this.cfg.generations; }

    _makeInd(rep) { return { genes: rep.genes, ev: rep.evaluation }; }

    _init() {
      const { projects, budgetCents, popSize } = this.cfg;
      const pop = [], events = [];
      for (let i = 0; i < popSize; i++) {
        const raw = [];
        for (let j = 0; j < this.n; j++) raw.push(this.rng() < 0.5 ? 1 : 0);
        const rep = repair(raw, projects, budgetCents);
        pop.push(this._makeInd(rep));
        events.push({ index: i, raw: toStr(raw), repair: rep.steps, final: rep.evaluation });
      }
      this.population = pop;
      this.logs.push({ generation: 0, type: 'init', individuals: events });
      this._record();
    }

    _record() {
      const fit = this.population.map((p) => p.ev.benefitHund);
      let bi = 0;
      for (let i = 1; i < fit.length; i++) if (fit[i] > fit[bi]) bi = i;
      const mean = fit.reduce((a, b) => a + b, 0) / fit.length;
      const genBest = this.population[bi];
      if (!this.best || genBest.ev.benefitHund > this.best.ev.benefitHund) {
        this.best = { genes: genBest.genes.slice(), ev: genBest.ev, generation: this.generation, index: bi };
      }
      this.history.push({
        generation: this.generation,
        bestHund: genBest.ev.benefitHund,
        bestChromosome: genBest.ev.chromosome,
        bestIndex: bi,
        meanHund: mean,
        bestSoFarHund: this.best.ev.benefitHund,
        bestSoFarChromosome: this.best.ev.chromosome,
        bestSoFarGeneration: this.best.generation,
      });
    }

    _tournament(fit) {
      const cands = drawDistinct(this.rng, this.cfg.popSize, this.cfg.tournamentSize);
      const winner = tournamentWinner(cands, fit);
      const top = Math.max(...cands.map((c) => fit[c]));
      return {
        candidates: cands.map((i) => ({ index: i, chromosome: this.population[i].ev.chromosome, fitnessHund: fit[i] })),
        winner,
        tie: cands.filter((c) => fit[c] === top).length > 1,
      };
    }

    /** Produz exatamente uma nova geração. Retorna o log dela, ou null se já terminou. */
    step() {
      if (this.finished) return null;
      const { projects, budgetCents, popSize, eliteCount, crossoverRate, mutationRate } = this.cfg;
      const prev = this.population;
      const fit = prev.map((p) => p.ev.benefitHund);
      const next = [];
      const log = { generation: this.generation + 1, type: 'gen', elite: [], pairs: [] };

      for (const idx of eliteIndices(fit, eliteCount)) {
        next.push({ genes: prev[idx].genes.slice(), ev: prev[idx].ev });
        log.elite.push({ from: idx, to: next.length - 1, chromosome: prev[idx].ev.chromosome, fitnessHund: fit[idx] });
      }

      let pairNo = 0;
      while (next.length < popSize) {
        const t1 = this._tournament(fit);
        const t2 = this._tournament(fit);
        const p1 = prev[t1.winner].genes, p2 = prev[t2.winner].genes;

        const draw = this.rng();
        const happened = draw < crossoverRate;
        let cut = null, c1, c2;
        if (happened) {
          cut = randInt(this.rng, 1, this.n - 1);
          [c1, c2] = crossover(p1, p2, cut);
        } else {
          c1 = p1.slice(); c2 = p2.slice();
        }

        const keepBoth = popSize - next.length >= 2;
        const kids = keepBoth ? [c1, c2] : [c1];
        const children = [];
        for (const k of kids) {
          const mask = [];
          for (let j = 0; j < this.n; j++) mask.push(this.rng() < mutationRate);
          const m = mutate(k, mask);
          const rep = repair(m.genes, projects, budgetCents);
          next.push(this._makeInd(rep));
          children.push({
            beforeMutation: toStr(k),
            flipped: m.flipped,
            afterMutation: toStr(m.genes),
            repair: rep.steps,
            final: rep.evaluation,
            placedAt: next.length - 1,
          });
        }

        log.pairs.push({
          pair: ++pairNo,
          tournaments: [t1, t2],
          parents: [
            { index: t1.winner, chromosome: toStr(p1), fitnessHund: fit[t1.winner] },
            { index: t2.winner, chromosome: toStr(p2), fitnessHund: fit[t2.winner] },
          ],
          crossover: { draw, rate: crossoverRate, happened, cut },
          offspring: [toStr(c1), toStr(c2)],
          discardedSecond: !keepBoth,
          children,
        });
      }

      this.population = next;
      this.generation++;
      this.logs.push(log);
      this._record();
      return log;
    }

    runToEnd() { while (!this.finished) this.step(); return this; }
  }

  return {
    createRng, randInt, seedToState,
    geneLetter, toStr, fromStr,
    evaluate, repair, crossover, mutate,
    drawDistinct, tournamentWinner, eliteIndices,
    Engine,
  };
});

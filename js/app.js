// Interface do simulador (a lógica do AG fica em ga.js)
(function () {
  'use strict';

  const GA = window.GA;
  const V = window.Validation;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = GA.letraGene;

  // Dados iniciais (seção 6.1)
  const EXAMPLE = [
    { name: 'Melhoria da iluminação', cost: '4000', benefit: '7' },
    { name: 'Instalação de bicicletários', cost: '3000', benefit: '5' },
    { name: 'Aquisição de bancos', cost: '2000', benefit: '3' },
    { name: 'Reforma de espaço de convivência', cost: '5000', benefit: '8' },
  ];
  const DEFAULTS = { budget: '7000', pop: '20', gens: '50', cross: '80', mut: '5', tour: '2', elite: '1', seed: '42' };
  const MIN_P = 4, MAX_P = 15;

  let projects = EXAMPLE.map((p) => Object.assign({}, p));
  let engine = null;
  let cfg = null;
  let mode = 'idle'; // idle, running, paused ou finished
  let dirty = false;
  let runToken = 0;
  let animToken = 0;
  let animating = false;
  let selectedLogGen = 0;
  let renderedHistory = 0;
  let lastValidation = null;

  // Formatação
  const brl = V.brl;
  const pts = V.pts;
  const mean2 = (h) => (h / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (x) => (x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4 }) + '%';
  const dec3 = (x) => x.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const ORD = ['primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto', 'sétimo', 'oitavo', 'nono', 'décimo',
    'décimo primeiro', 'décimo segundo', 'décimo terceiro', 'décimo quarto', 'décimo quinto'];
  const listPt = (arr) => arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
  const ratioTxt = (bh, cc) => (bh / cc * 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

  // Validação
  const RE_MONEY = /^\d{1,12}([.,]\d{1,2})?$/;
  const RE_BEN = /^\d{1,9}([.,]\d{1,2})?$/;
  const RE_INT = /^\d{1,9}$/;
  const RE_SEED = /^-?\d{1,15}$/;
  const RE_PCT = /^\d{1,3}([.,]\d{1,6})?$/;

  function toHundredths(s) {
    const [i, d = ''] = s.replace(',', '.').split('.');
    return Number(i) * 100 + Number((d + '00').slice(0, 2));
  }

  function readField(id) { return $('#' + id).value.trim(); }

  function validate() {
    const errors = {};
    const out = {};

    const norm = [];
    projects.forEach((p, i) => {
      const name = p.name.trim();
      const cost = p.cost.trim();
      const ben = p.benefit.trim();
      if (!name) errors[`p-${i}-name`] = 'Informe um nome.';
      let costCents = NaN, benefitHund = NaN;
      if (!cost) errors[`p-${i}-cost`] = 'Preencha o custo.';
      else if (!RE_MONEY.test(cost)) errors[`p-${i}-cost`] = 'Use um valor como 4000 ou 4000,50, sem separador de milhar.';
      else {
        costCents = toHundredths(cost);
        if (costCents <= 0) errors[`p-${i}-cost`] = 'O custo deve ser maior que zero.';
      }
      if (!ben) errors[`p-${i}-ben`] = 'Preencha o benefício.';
      else if (!RE_BEN.test(ben)) errors[`p-${i}-ben`] = 'Use um número não negativo, com até duas casas decimais.';
      else benefitHund = toHundredths(ben);
      norm.push({ name, costCents, benefitHund });
    });
    if (projects.length < MIN_P || projects.length > MAX_P) errors.projects = `Mantenha entre ${MIN_P} e ${MAX_P} projetos.`;
    out.projects = norm;

    const budget = readField('f-budget');
    if (!budget) errors['f-budget'] = 'Preencha o orçamento.';
    else if (!RE_MONEY.test(budget)) errors['f-budget'] = 'Use um valor não negativo, como 7000 ou 7000,50, sem separador de milhar.';
    else out.budgetCents = toHundredths(budget);

    const intField = (id, min, label) => {
      const v = readField(id);
      if (!v) { errors[id] = 'Preencha este campo.'; return NaN; }
      if (!RE_INT.test(v) || Number(v) < min) { errors[id] = label; return NaN; }
      return Number(v);
    };
    out.popSize = intField('f-pop', 2, 'Use um inteiro igual ou maior que 2.');
    out.generations = intField('f-gens', 1, 'Use um inteiro igual ou maior que 1.');

    const pctField = (id) => {
      const v = readField(id);
      if (!v) { errors[id] = 'Preencha este campo.'; return NaN; }
      if (!RE_PCT.test(v)) { errors[id] = 'Use um percentual entre 0 e 100, como 80 ou 2,5.'; return NaN; }
      const x = Number(v.replace(',', '.'));
      if (x > 100) { errors[id] = 'O percentual não pode passar de 100.'; return NaN; }
      return x / 100;
    };
    out.crossoverRate = pctField('f-cross');
    out.mutationRate = pctField('f-mut');

    const N = out.popSize;
    const tour = readField('f-tour');
    if (!tour) errors['f-tour'] = 'Preencha este campo.';
    else if (!RE_INT.test(tour)) errors['f-tour'] = 'Use um número inteiro.';
    else if (Number.isNaN(N)) errors['f-tour'] = 'Corrija primeiro o tamanho da população.';
    else if (Number(tour) < 2 || Number(tour) > N) errors['f-tour'] = `Use um inteiro entre 2 e ${N} (tamanho da população).`;
    else out.tournamentSize = Number(tour);

    const elite = readField('f-elite');
    if (!elite) errors['f-elite'] = 'Preencha este campo.';
    else if (!RE_INT.test(elite)) errors['f-elite'] = 'Use um número inteiro.';
    else if (Number.isNaN(N)) errors['f-elite'] = 'Corrija primeiro o tamanho da população.';
    else if (Number(elite) > N - 1) errors['f-elite'] = `Use um inteiro entre 0 e ${N - 1} (população menos 1).`;
    else out.eliteCount = Number(elite);

    const seed = readField('f-seed');
    if (!seed) errors['f-seed'] = 'Preencha a semente.';
    else if (!RE_SEED.test(seed) || !Number.isSafeInteger(Number(seed))) errors['f-seed'] = 'Use um número inteiro.';
    else out.seed = Number(seed);

    const ok = Object.keys(errors).length === 0;
    return { ok, errors, cfg: ok ? out : null };
  }

  function showErrors(res) {
    document.querySelectorAll('.err').forEach((e) => {
      const id = e.dataset.for;
      e.textContent = res.errors[id] || '';
      const input = document.getElementById(id);
      if (input) input.setAttribute('aria-invalid', res.errors[id] ? 'true' : 'false');
    });
  }

  // Tabela de projetos
  function renderProjects() {
    const body = $('#projects-body');
    body.innerHTML = '';
    projects.forEach((p, i) => {
      const tr = el('tr');
      tr.appendChild(el('td', 'gene', `<span class="gene-tag">${L(i)}</span>`));
      const cell = (key, cls, field, mode, label) => {
        const td = el('td', cls);
        const id = `p-${i}-${key}`;
        const inp = el('input');
        inp.id = id;
        inp.name = `projeto_${i}_${key}`;
        inp.spellcheck = false;
        inp.placeholder = { name: 'ex.: Reforma da biblioteca…', cost: 'ex.: 4000…', benefit: 'ex.: 7…' }[field];
        inp.value = p[field];
        if (field === 'name') { inp.title = p.name; inp.addEventListener('input', () => { inp.title = inp.value; }); }
        inp.autocomplete = 'off';
        if (mode) inp.inputMode = mode;
        inp.setAttribute('aria-label', `${label} do projeto ${L(i)}`);
        inp.addEventListener('input', () => { projects[i][field] = inp.value; onDataChanged(); });
        const err = el('small', 'err');
        err.dataset.for = id;
        td.append(inp, err);
        return td;
      };
      tr.appendChild(cell('name', 'c-name', 'name', null, 'Nome'));
      const cCost = cell('cost', 'c-cost', 'cost', 'decimal', 'Custo em reais');
      cCost.dataset.label = 'Custo (R$)';
      const cBen = cell('ben', 'c-ben', 'benefit', 'decimal', 'Benefício');
      cBen.dataset.label = 'Benefício';
      tr.append(cCost, cBen);
      const td = el('td');
      const rm = el('button', 'icon-btn', '×');
      rm.type = 'button';
      rm.title = `Remover projeto ${L(i)}`;
      rm.setAttribute('aria-label', `Remover projeto ${L(i)}`);
      rm.disabled = projects.length <= MIN_P;
      rm.addEventListener('click', () => {
        const snap = snapshot();
        const name = projects[i].name.trim() || `projeto ${L(i)}`;
        projects.splice(i, 1);
        renderProjects();
        onDataChanged();
        offerUndo(`“${name}” removido.`, snap);
      });
      td.appendChild(rm);
      tr.appendChild(td);
      body.appendChild(tr);
    });
    $('#project-count').textContent = `${projects.length} de ${MAX_P} (mínimo ${MIN_P})`;
    $('#add-project').disabled = projects.length >= MAX_P;
  }

  // evita que o tradutor do navegador mexa nos cromossomos
  const noTranslate = (root) => root.querySelectorAll('code').forEach((c) => c.setAttribute('translate', 'no'));

  // Desfazer, endereço com a configuração
  const FIELD_KEYS = { budget: 'b', pop: 'n', gens: 'g', cross: 'x', mut: 'm', tour: 't', elite: 'e', seed: 's' };
  let undoSnap = null, undoTimer = null, chartW = 0;

  function snapshot() {
    const f = {};
    Object.keys(FIELD_KEYS).forEach((k) => { f[k] = $('#f-' + k).value; });
    return { projects: projects.map((p) => Object.assign({}, p)), fields: f };
  }
  function restore(snap) {
    projects = snap.projects.map((p) => Object.assign({}, p));
    Object.entries(snap.fields).forEach(([k, v]) => { $('#f-' + k).value = v; });
    renderProjects();
    onDataChanged();
  }
  function offerUndo(text, snap) {
    undoSnap = snap;
    $('#undo-text').textContent = text;
    $('#undo').hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(hideUndo, 10000);
  }
  function hideUndo() { $('#undo').hidden = true; undoSnap = null; }

  // salva a configuração na URL (?cfg=...)
  function writeUrl() {
    try {
      const snap = snapshot();
      const data = { p: snap.projects.map((p) => [p.name, p.cost, p.benefit]) };
      Object.entries(FIELD_KEYS).forEach(([k, short]) => { data[short] = snap.fields[k]; });
      const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(data))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const url = new URL(location.href);
      url.searchParams.set('cfg', b64);
      history.replaceState(null, '', url);
    } catch (e) { /* ignora */ }
  }
  function readUrl() {
    try {
      const raw = new URL(location.href).searchParams.get('cfg');
      if (!raw) return;
      const bin = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
      const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
      if (!Array.isArray(data.p) || data.p.length < MIN_P || data.p.length > MAX_P) return;
      projects = data.p.map((r) => ({ name: String(r[0]), cost: String(r[1]), benefit: String(r[2]) }));
      Object.entries(FIELD_KEYS).forEach(([k, short]) => { if (data[short] !== undefined) $('#f-' + k).value = String(data[short]); });
    } catch (e) { /* URL inválida, usa o exemplo */ }
  }

  // Estado e controles
  function onDataChanged() {
    lastValidation = validate();
    showErrors(lastValidation);
    if (engine) {
      dirty = true;
      if (mode === 'running') pause();
    }
    updateControls();
  }

  function updateControls() {
    const valid = lastValidation ? lastValidation.ok : true;
    const ready = engine && !dirty && !engine.finalizado;
    $('#btn-run').disabled = !(ready && mode !== 'running');
    $('#btn-pause').disabled = mode !== 'running';
    $('#btn-step').disabled = !(ready && mode !== 'running');
    document.querySelectorAll('.replay').forEach((b) => { b.disabled = mode === 'running'; });

    const st = $('#run-status');
    st.classList.remove('warn');
    if (!valid) {
      const n = Object.keys(lastValidation.errors).length;
      st.textContent = `Corrija ${n === 1 ? 'o campo destacado' : `os ${n} campos destacados`} e clique em Reiniciar para aplicar.`;
      st.classList.add('warn');
    } else if (dirty) {
      st.textContent = 'Dados ou parâmetros alterados. Clique em Reiniciar para aplicá-los.';
      st.classList.add('warn');
    } else if (!engine) {
      st.textContent = '';
    } else if (mode === 'idle') {
      st.textContent = 'Geração 0 pronta. Clique em Executar ou em Avançar uma geração.';
    } else if (mode === 'running') {
      st.textContent = `Executando: geração ${engine.geracao} de ${cfg.generations}.`;
    } else if (mode === 'paused') {
      st.textContent = `Pausado na geração ${engine.geracao} de ${cfg.generations}. O estado foi preservado.`;
    } else {
      st.textContent = `Execução encerrada após ${cfg.generations} ${cfg.generations === 1 ? 'geração' : 'gerações'}.`;
    }
  }

  function reset() {
    lastValidation = validate();
    showErrors(lastValidation);
    if (!lastValidation.ok) {
      updateControls();
      const first = document.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    runToken++;
    abortAnim();
    cfg = lastValidation.cfg;
    engine = new GA.AlgoritmoGenetico(cfg);
    writeUrl();
    mode = 'idle';
    dirty = false;
    selectedLogGen = 0;
    renderedHistory = 0;
    $('#history-body').innerHTML = '';
    $('#log-gen').innerHTML = '';
    renderAll();
    const repaired = engine.registros[0].individuals.filter((i) => i.repair.length).length;
    $('#stage-body').innerHTML = '';
    setCaption(`Geração 0 criada com semente ${cfg.seed}: ${cfg.popSize} indivíduos sorteados gene a gene; ${repaired} ${repaired === 1 ? 'precisou' : 'precisaram'} de reparação. Os detalhes estão no registro.`);
    updateControls();
  }

  async function run() {
    if (!engine || dirty || engine.finalizado || mode === 'running') return;
    mode = 'running';
    updateControls();
    const token = ++runToken;
    while (mode === 'running' && token === runToken && !engine.finalizado) {
      const log = engine.proximaGeracao();
      selectedLogGen = log.generation;
      renderAll();
      updateControls();
      const am = $('#anim-mode').value;
      if (am !== 'off') await playGeneration(log, am);
      else { showStaticSummary(log); await plainWait(140 / speed()); }
    }
    if (token !== runToken) return;
    if (engine.finalizado) finish();
  }

  function pause() {
    if (mode !== 'running') return;
    mode = 'paused';
    runToken++;
    abortAnim();
    updateControls();
  }

  async function stepOnce() {
    if (!engine || dirty || engine.finalizado || mode === 'running') return;
    if (mode === 'idle') mode = 'paused';
    const log = engine.proximaGeracao();
    selectedLogGen = log.generation;
    renderAll();
    if (engine.finalizado) finish(); else updateControls();
    const am = $('#anim-mode').value;
    if (am !== 'off') await playGeneration(log, am);
    else showStaticSummary(log);
  }

  function finish() {
    mode = 'finished';
    runToken++;
    renderAll();
    updateControls();
  }

  // Renderização
  function renderAll() {
    if (!engine) return;
    const h = engine.historico[engine.historico.length - 1];
    $('#m-gen').textContent = `${engine.geracao} de ${cfg.generations}`;
    $('#m-best').textContent = pts(h.bestHund);
    $('#m-mean').textContent = mean2(h.meanHund);
    $('#m-acc').textContent = pts(h.bestSoFarHund);
    $('#m-acc-sub').textContent = `${h.bestSoFarChromosome}, geração ${h.bestSoFarGeneration}`;
    renderBest();
    renderPopulation();
    renderHistory();
    drawChart();
    renderLogSelect();
    renderLog();
  }

  function plainChrom(str, cls) {
    const c = el('div', 'chrom');
    const seg = el('span', 'seg');
    str.split('').forEach((b) => seg.appendChild(el('span', 'bit' + (b === '1' ? ' on' : '') + (cls ? ' ' + cls : ''), b)));
    c.appendChild(seg);
    return c;
  }

  function renderBest() {
    const b = engine.melhor;
    const ev = b.ev;
    const box = $('#best-card');
    box.innerHTML = '';
    $('#best-title').textContent = engine.finalizado ? 'Resultado final' : 'Melhor solução até agora';
    box.appendChild(plainChrom(ev.chromosome));
    const chosen = ev.selected.length
      ? '<ul>' + ev.selected.map((i) => `<li><b>${L(i)}</b> ${esc(cfg.projects[i].name)}</li>`).join('') + '</ul>'
      : 'nenhum (seleção vazia)';
    const dl = el('dl', null,
      `<dt>Cromossomo</dt><dd><code>${ev.chromosome}</code></dd>` +
      `<dt>Projetos escolhidos</dt><dd>${chosen}</dd>` +
      `<dt>Custo total</dt><dd>${brl(ev.costCents)}</dd>` +
      `<dt>Benefício total</dt><dd>${pts(ev.benefitHund)}</dd>` +
      `<dt>Saldo do orçamento</dt><dd>${brl(ev.balanceCents)} de ${brl(cfg.budgetCents)}</dd>` +
      `<dt>Encontrada na</dt><dd>geração ${b.generation}, posição #${b.index}</dd>`);
    box.appendChild(dl);
    noTranslate(box);
    if (engine.finalizado) {
      box.appendChild(el('p', 'final-note', 'Melhor indivíduo encontrado em toda a execução, incluindo a geração 0. Ele não é necessariamente o ótimo global.'));
    }
  }

  function renderPopulation() {
    const ol = $('#population');
    ol.innerHTML = '';
    const h = engine.historico[engine.historico.length - 1];
    const eliteN = engine.geracao > 0 ? cfg.eliteCount : 0;
    engine.populacao.forEach((ind, i) => {
      const li = el('li');
      if (i === h.bestIndex) li.classList.add('is-best');
      if (i < eliteN) li.classList.add('is-elite');
      li.innerHTML = `<span class="ix">#${i}</span><span class="ch">${ind.ev.chromosome}</span><span class="fit">${pts(ind.ev.benefitHund)}</span>`;
      li.title = (i < eliteN ? 'Elite copiado da geração anterior. ' : '') + `Custo ${brl(ind.ev.costCents)}, aptidão ${pts(ind.ev.benefitHund)}`;
      ol.appendChild(li);
    });
    $('#pop-sub').textContent = `geração ${engine.geracao}; contorno = melhor da geração${eliteN ? '; índice verde = elite' : ''}`;
  }

  function renderHistory() {
    const body = $('#history-body');
    for (let i = renderedHistory; i < engine.historico.length; i++) {
      const h = engine.historico[i];
      const tr = el('tr', null,
        `<td><button type="button" aria-label="Abrir o registro da geração ${h.generation}">${h.generation}</button></td><td>${pts(h.bestHund)}</td><td class="mono">${h.bestChromosome}</td>` +
        `<td>${mean2(h.meanHund)}</td><td>${pts(h.bestSoFarHund)}</td><td class="mono">${h.bestSoFarChromosome}</td>`);
      tr.dataset.gen = h.generation;
      tr.querySelector('button').addEventListener('click', () => {
        selectedLogGen = h.generation;
        renderLogSelect(); renderLog(); renderHistory();
        $('#log-title').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      });
      body.appendChild(tr);
    }
    renderedHistory = engine.historico.length;
    body.querySelectorAll('tr').forEach((tr) => tr.classList.toggle('sel', Number(tr.dataset.gen) === selectedLogGen));
    if (mode === 'running') body.closest('.table-scroll').scrollTop = 1e9;
  }

  function renderLogSelect() {
    const sel = $('#log-gen');
    for (let g = sel.options.length; g <= engine.geracao; g++) {
      const o = el('option', null, String(g));
      o.value = g;
      sel.appendChild(o);
    }
    sel.value = String(selectedLogGen);
  }

  // Registro textual
  function repairText(start, steps) {
    if (!steps.length) return null;
    return `${[start].concat(steps.map((s) => s.after)).join(' → ')} (remove ${steps.map((s) => L(s.removed)).join(', depois ')})`;
  }

  function pairSummary(log, p) {
    // mesmo formato do exemplo do enunciado
    const parts = [`Pais: ${p.parents[0].chromosome} e ${p.parents[1].chromosome}`];
    parts.push(p.crossover.happened ? `corte após o ${ORD[p.crossover.cut - 1]} gene` : 'sem cruzamento');
    parts.push(`filhos: ${p.offspring[0]} e ${p.offspring[1]}` + (p.discardedSecond ? ' (filho 2 descartado)' : ''));
    p.children.forEach((c, ci) => {
      if (c.flipped.length) {
        const which = c.flipped.length === 1 ? `apenas no ${ORD[c.flipped[0]]} gene` : `no ${listPt(c.flipped.map((f) => ORD[f]))} genes`;
        parts.push(`mutação ${which} do filho ${ci + 1}: ${c.afterMutation}`);
      }
    });
    p.children.forEach((c, ci) => {
      if (c.repair.length) parts.push(`reparação do filho ${ci + 1}: ${[c.afterMutation].concat(c.repair.map((s) => s.after)).join(' → ')}`);
    });
    return parts.join('; ');
  }

  function tournamentText(t, k) {
    const c = t.candidates.map((x) => `#${x.index} (<code>${x.chromosome}</code>, aptidão ${pts(x.fitnessHund)})`);
    return `Torneio do pai ${k}: ${listPt(c)}; vence #${t.winner}${t.tie ? ', por ter o menor índice entre os empatados' : ''}.`;
  }

  function renderLog() {
    renderLogInner();
    noTranslate($('#log'));
  }

  function renderLogInner() {
    const box = $('#log');
    box.innerHTML = '';
    if (!engine) return;
    const log = engine.registros[selectedLogGen];
    if (!log) { box.appendChild(el('p', 'empty', 'Sem registro para esta geração.')); return; }

    if (log.type === 'init') {
      const e = el('div', 'entry');
      e.appendChild(el('h3', null, 'Geração 0: população inicial aleatória'));
      e.appendChild(el('p', 'muted', 'Cada gene foi sorteado com probabilidade 1/2 de ser 0 ou 1; soluções acima do orçamento foram reparadas antes da avaliação.'));
      box.appendChild(e);
      log.individuals.forEach((ind) => {
        const r = repairText(ind.raw, ind.repair);
        const x = el('div', 'entry');
        x.innerHTML = `<p><b>#${ind.index}</b>: sorteado <code>${ind.raw}</code>; ${r ? `reparação ${r}` : 'viável sem reparação'}; custo ${brl(ind.final.costCents)}; aptidão ${pts(ind.final.benefitHund)}.</p>`;
        box.appendChild(x);
      });
      return;
    }

    if (log.elite.length) {
      const e = el('div', 'entry elite');
      e.appendChild(el('h3', null, `Elitismo <span class="badge">${log.elite.length}</span>`));
      log.elite.forEach((x) => e.appendChild(el('p', null, `#${x.from} da geração ${log.generation - 1} (<code>${x.chromosome}</code>, aptidão ${pts(x.fitnessHund)}) copiado sem alterações para a posição #${x.to}.`)));
      box.appendChild(e);
    } else {
      box.appendChild(el('div', 'entry', '<p class="muted">Sem elitismo: todas as vagas foram preenchidas por descendentes.</p>'));
    }

    log.pairs.forEach((p) => {
      const e = el('div', 'entry');
      const h = el('h3', null, `Par ${p.pair}`);
      const btn = el('button', 'btn ghost small-btn replay', 'Animar este par');
      btn.type = 'button';
      btn.disabled = mode === 'running';
      btn.addEventListener('click', () => replayPair(log, p));
      h.appendChild(btn);
      e.appendChild(h);
      e.appendChild(el('p', null, tournamentText(p.tournaments[0], 1)));
      e.appendChild(el('p', null, tournamentText(p.tournaments[1], 2)));
      const cx = p.crossover;
      if (cx.happened) {
        const a = p.parents[0].chromosome, b = p.parents[1].chromosome, c = cx.cut;
        e.appendChild(el('p', null, `Cruzamento: sorteio ${dec3(cx.draw)} &lt; ${pct(cx.rate)}; corte após o gene ${L(c - 1)}: <code>${a.slice(0, c)}|${a.slice(c)}</code> + <code>${b.slice(0, c)}|${b.slice(c)}</code> → <code>${p.offspring[0]}</code> e <code>${p.offspring[1]}</code>.`));
      } else {
        e.appendChild(el('p', null, `Sem cruzamento: sorteio ${dec3(cx.draw)} ≥ ${pct(cx.rate)}; os filhos copiam os pais: <code>${p.offspring[0]}</code> e <code>${p.offspring[1]}</code>.`));
      }
      if (p.discardedSecond) e.appendChild(el('p', null, `Só restava uma vaga: o filho 2 (<code>${p.offspring[1]}</code>) foi descartado.`));
      p.children.forEach((c, ci) => {
        const mut = c.flipped.length
          ? `mutação ${c.flipped.length === 1 ? 'no gene' : 'nos genes'} ${listPt(c.flipped.map(L))}: <code>${c.beforeMutation}</code> → <code>${c.afterMutation}</code>`
          : `sem mutação (<code>${c.afterMutation}</code>)`;
        const r = repairText(c.afterMutation, c.repair);
        e.appendChild(el('p', null, `Filho ${ci + 1}: ${mut}; ${r ? `reparação ${r}` : 'viável sem reparação'}; avaliação: <code>${c.final.chromosome}</code>, custo ${brl(c.final.costCents)}, aptidão ${pts(c.final.benefitHund)}; posição #${c.placedAt}.`));
      });
      e.appendChild(el('p', 'summary', esc(pairSummary(log, p)) + '.'));
      box.appendChild(e);
    });
  }

  function showStaticSummary(log) {
    const best = engine.historico[log.generation];
    setCaption(`Geração ${log.generation} produzida: ${log.pairs.length} ${log.pairs.length === 1 ? 'par' : 'pares'} de pais, ${log.elite.length} ${log.elite.length === 1 ? 'elite' : 'elites'}. Melhor aptidão ${pts(best.bestHund)} (<code>${best.bestChromosome}</code>).`);
    $('#stage-body').innerHTML = '';
  }

  // Gráfico (canvas, sem bibliotecas)
  function drawChart() {
    const cv = $('#chart');
    const css = getComputedStyle(document.documentElement);
    const col = (v) => css.getPropertyValue(v).trim();
    const dpr = window.devicePixelRatio || 1;
    const W = chartW, H = 240;
    if (!W) return;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!engine) return;
    const hist = engine.historico;
    const pad = { l: 44, r: 12, t: 10, b: 28 };
    const gw = W - pad.l - pad.r, gh = H - pad.t - pad.b;
    const maxX = Math.max(cfg.generations, 1);
    const maxY = Math.max(1, ...hist.map((h) => h.bestSoFarHund / 100)) * 1.1;
    const X = (g) => pad.l + (g / maxX) * gw;
    const Y = (v) => pad.t + gh - (v / maxY) * gh;

    ctx.font = '12px ' + col('--font');
    ctx.fillStyle = col('--muted');
    ctx.strokeStyle = col('--line');
    ctx.lineWidth = 1;
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const v = maxY / yTicks * i;
      const y = Y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), pad.l - 6, y);
    }
    const xTicks = Math.min(maxX, 10);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let i = 0; i <= xTicks; i++) {
      const g = Math.round(maxX / xTicks * i);
      ctx.fillText(String(g), X(g), H - pad.b + 8);
    }

    const line = (key, color, dash, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
      ctx.beginPath();
      hist.forEach((h, i) => { const x = X(h.generation), y = Y(h[key] / 100); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
      ctx.setLineDash([]);
    };
    line('meanHund', col('--p2'), [5, 4], 2);
    line('bestHund', col('--p1'), [], 2);
    line('bestSoFarHund', col('--elite'), [], 3);
    if (hist.length === 1) {
      ctx.fillStyle = col('--elite');
      ctx.beginPath(); ctx.arc(X(0), Y(hist[0].bestSoFarHund / 100), 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Animação
  const ABORT = { abort: true };
  const SPEEDS = [0.25, 0.5, 1, 2, 4];
  const speed = () => SPEEDS[Number($('#anim-speed').value)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function applySpeed() {
    const s = speed();
    $('#anim-speed-out').textContent = s.toLocaleString('pt-BR') + '×';
    document.documentElement.style.setProperty('--dur', Math.round(450 / s) + 'ms');
  }

  function plainWait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function wait(ms, tok) {
    const total = ms / speed();
    return new Promise((resolve, reject) => {
      const start = performance.now();
      const tick = () => {
        if (tok !== animToken) return reject(ABORT);
        if (performance.now() - start >= total) return resolve();
        setTimeout(tick, Math.min(50, total));
      };
      tick();
    });
  }

  function abortAnim() { animToken++; animating = false; }

  function setCaption(html) { $('#stage-caption').innerHTML = html; }

  function stageClear(n) {
    if (n === undefined) n = cfg.projects.length;
    const body = $('#stage-body');
    body.innerHTML = '';
    // linha com as letras dos genes
    const row = el('div', 'letters');
    row.appendChild(el('span', 'sr-label', ''));
    const c = el('div', 'chrom');
    const seg = el('span', 'seg');
    for (let i = 0; i < n; i++) seg.appendChild(el('span', 'bit', L(i)));
    c.appendChild(seg);
    row.appendChild(c);
    row.appendChild(el('span', 'sr-meta', ''));
    body.appendChild(row);
    return body;
  }

  // model = { bits, cls }; cut = genes antes do corte (ou null)
  function modelChrom(model, cut) {
    const c = el('div', 'chrom');
    c.setAttribute('translate', 'no');
    const mk = (i) => {
      const b = el('span', 'bit' + (model.bits[i] ? ' on' : '') + (model.cls[i] ? ' ' + model.cls[i] : ''), String(model.bits[i]));
      b.dataset.i = i;
      return b;
    };
    if (cut) {
      const head = el('span', 'seg head'), tail = el('span', 'seg tail');
      for (let i = 0; i < model.bits.length; i++) (i < cut ? head : tail).appendChild(mk(i));
      const line = el('span', 'cut');
      c.append(head, line, tail);
      // cada bit ocupa 34px (30 + 4 de espaço)
      line.style.left = `${3 + cut * 34 + 4}px`;
    } else {
      const seg = el('span', 'seg');
      for (let i = 0; i < model.bits.length; i++) seg.appendChild(mk(i));
      c.appendChild(seg);
    }
    return c;
  }

  function srow(label, chrom, meta) {
    const r = el('div', 'srow enter');
    r.appendChild(el('span', 'sr-label', label));
    r.appendChild(chrom);
    r.appendChild(el('span', 'sr-meta', meta || ''));
    return r;
  }

  const modelFrom = (str, cls) => ({ bits: str.split('').map(Number), cls: str.split('').map(() => cls || '') });

  async function playGeneration(log, am) {
    abortAnim();
    const tok = animToken;
    animating = true;
    try {
      if (log.elite.length) await animElite(log, tok);
      const pairs = am === 'all' ? log.pairs : log.pairs.slice(0, 1);
      for (const p of pairs) await animPair(log, p, tok);
      if (am === 'first' && log.pairs.length > 1) {
        setCaption(`Os outros ${log.pairs.length - 1} pares da geração ${log.generation} seguiram as mesmas etapas; o registro abaixo mostra cada um, e “Animar este par” reproduz qualquer um deles.`);
        await wait(900, tok);
      }
    } catch (e) {
      if (e !== ABORT) throw e;
    } finally {
      if (tok === animToken) animating = false;
    }
  }

  async function replayPair(log, p) {
    if (mode === 'running') return;
    abortAnim();
    const tok = animToken;
    $('#stage').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
    try { await animPair(log, p, tok); } catch (e) { if (e !== ABORT) throw e; }
  }

  async function animElite(log, tok) {
    const body = stageClear();
    const n = log.elite.length;
    const first = log.elite[0];
    setCaption(n === 1
      ? `Elitismo na geração ${log.generation}: o melhor indivíduo da geração anterior, #${first.from} (aptidão ${pts(first.fitnessHund)}), é copiado sem alterações para a posição #${first.to}.`
      : `Elitismo na geração ${log.generation}: os ${n} melhores da geração anterior são copiados sem alterações para as primeiras posições.`);
    log.elite.slice(0, 6).forEach((x) => {
      body.appendChild(srow(`<strong>#${x.from}</strong> → #${x.to}`, modelChrom(modelFrom(x.chromosome, 'elite-bit')), `aptidão <strong>${pts(x.fitnessHund)}</strong> <span class="badge">elite</span>`));
    });
    if (n > 6) body.appendChild(el('p', 'muted small', `e mais ${n - 6} no registro.`));
    await wait(1600, tok);
  }

  async function animPair(log, p, tok, ctx) {
    ctx = ctx || { projects: cfg.projects, budgetCents: cfg.budgetCents, mutationRate: cfg.mutationRate };
    const g = log.generation;
    const n = ctx.projects.length;
    const head = p.controlled ? '<span class="tag">Teste 6.4.</span> ' : `<span class="tag">Geração ${g}, par ${p.pair}.</span> `;

    // 1. torneios
    for (let k = 0; k < (p.controlled ? 0 : 2); k++) {
      const t = p.tournaments[k];
      const body = stageClear(n);
      setCaption(`<span class="tag">Geração ${g}, par ${p.pair}.</span> Torneio para o pai ${k + 1}: ${t.candidates.length} candidatos sorteados, sem repetição.`);
      const rows = t.candidates.map((c) => {
        const r = srow(`<strong>#${c.index}</strong>`, modelChrom(modelFrom(c.chromosome)), `aptidão <strong>${pts(c.fitnessHund)}</strong>`);
        body.appendChild(r);
        return { r, c };
      });
      await wait(1100, tok);
      rows.forEach(({ r, c }) => r.classList.add(c.index === t.winner ? 'win' : 'lose'));
      const w = t.candidates.find((c) => c.index === t.winner);
      setCaption(`<span class="tag">Geração ${g}, par ${p.pair}.</span> Vence #${t.winner}, com aptidão ${pts(w.fitnessHund)}${t.tie ? '. Houve empate na maior aptidão, e fica o de menor índice na população' : ''}. Ele será o pai ${k + 1}.`);
      await wait(1500, tok);
    }

    // 2. cruzamento
    const cx = p.crossover;
    const P1 = modelFrom(p.parents[0].chromosome, 'o1');
    const P2 = modelFrom(p.parents[1].chromosome, 'o2');
    let body = stageClear(n);
    const c1 = modelChrom(P1, cx.happened ? cx.cut : null);
    const c2 = modelChrom(P2, cx.happened ? cx.cut : null);
    const r1 = srow(`<strong>Pai 1</strong>${p.controlled ? '' : ` (#${p.parents[0].index})`}`, c1, `aptidão ${pts(p.parents[0].fitnessHund)}`);
    const r2 = srow(`<strong>Pai 2</strong>${p.controlled ? '' : ` (#${p.parents[1].index})`}`, c2, `aptidão ${pts(p.parents[1].fitnessHund)}`);
    body.append(r1, r2);
    setCaption(p.controlled
      ? `${head}Pais 1100 e 0011. Cruzamento forçado, com corte após o gene ${L(cx.cut - 1)}.`
      : cx.happened
      ? `Cruzamento: o sorteio deu ${dec3(cx.draw)}, abaixo da taxa de ${pct(cx.rate)}, então os pais cruzam. Corte sorteado após o gene ${L(cx.cut - 1)}.`
      : `Sem cruzamento: o sorteio deu ${dec3(cx.draw)}, que não fica abaixo da taxa de ${pct(cx.rate)}. Os filhos serão cópias dos pais.`);
    await wait(1300, tok);

    let K1, K2;
    if (cx.happened) {
      c1.classList.add('split'); c2.classList.add('split');
      await wait(800, tok);
      c1.querySelector('.tail').classList.add('down');
      c2.querySelector('.tail').classList.add('up');
      r1.querySelector('.sr-meta').textContent = '';
      r2.querySelector('.sr-meta').textContent = '';
      setCaption(`Cruzamento: os segmentos depois do gene ${L(cx.cut - 1)} trocam de lugar.`);
      await wait(1200, tok);
      const cut = cx.cut;
      K1 = { bits: P1.bits.slice(0, cut).concat(P2.bits.slice(cut)), cls: P1.cls.slice(0, cut).concat(P2.cls.slice(cut)) };
      K2 = { bits: P2.bits.slice(0, cut).concat(P1.bits.slice(cut)), cls: P2.cls.slice(0, cut).concat(P1.cls.slice(cut)) };
    } else {
      K1 = { bits: P1.bits.slice(), cls: P1.cls.slice() };
      K2 = { bits: P2.bits.slice(), cls: P2.cls.slice() };
    }
    const kids = [K1, K2];

    body = stageClear(n);
    const kidRows = kids.map((K, i) => {
      const r = srow(`<strong>Filho ${i + 1}</strong>`, modelChrom(K), '');
      body.appendChild(r);
      return r;
    });
    setCaption(`Filhos após o cruzamento: ${p.offspring[0]} e ${p.offspring[1]}.`);
    await wait(1200, tok);
    if (p.discardedSecond) {
      kidRows[1].classList.add('faded');
      kidRows[1].querySelector('.sr-meta').textContent = 'descartado';
      setCaption(`Só resta uma vaga na nova população, então apenas o filho 1 segue. O filho 2 é descartado.`);
      await wait(1500, tok);
    }

    // 3. mutação
    for (let ci = 0; ci < p.children.length; ci++) {
      const ch = p.children[ci];
      const row = kidRows[ci];
      const K = kids[ci];
      setCaption(p.controlled
        ? `${head}Mutação controlada no filho ${ci + 1}: ${ch.flipped.length ? `inverter só o gene ${listPt(ch.flipped.map(L))}.` : 'nenhum gene invertido.'}`
        : `Mutação no filho ${ci + 1}: cada gene tem ${pct(ctx.mutationRate)} de chance de ser invertido. ${ch.flipped.length ? `Foram invertidos: ${ch.flipped.length === 1 ? 'gene' : 'genes'} ${listPt(ch.flipped.map(L))}.` : 'Nenhum gene foi invertido.'}`);
      await wait(900, tok);
      for (const i of ch.flipped) {
        const bit = row.querySelector(`.bit[data-i="${i}"]`);
        bit.classList.add('flipping');
        await wait(270, tok);
        K.bits[i] = 1 - K.bits[i];
        K.cls[i] = 'mut';
        bit.textContent = String(K.bits[i]);
        bit.className = 'bit mut flipping' + (K.bits[i] ? ' on' : '');
        await wait(400, tok);
        bit.classList.remove('flipping');
      }
      row.querySelector('.sr-meta').innerHTML = ch.flipped.length ? `${ch.beforeMutation} → <strong>${ch.afterMutation}</strong>` : 'sem mutação';
      await wait(1000, tok);
    }

    // 4. reparação
    for (let ci = 0; ci < p.children.length; ci++) {
      const ch = p.children[ci];
      const K = kids[ci];
      body = stageClear(n);
      const chrom = modelChrom(K);
      const row = srow(`<strong>Filho ${ci + 1}</strong>`, chrom, '');
      body.appendChild(row);

      const meter = el('div', 'meter');
      const bar = el('div', 'meter-bar');
      const fill = el('div', 'meter-fill');
      const mark = el('div', 'meter-mark');
      const text = el('div', 'meter-text');
      bar.append(fill, mark);
      meter.append(bar, text);
      body.appendChild(meter);
      const plist = el('ul', 'plist');
      const lis = ctx.projects.map((pr, i) => {
        const li = el('li', K.bits[i] ? '' : 'off', `<b>${L(i)}</b> ${esc(pr.name)} (${brl(pr.costCents)}; ${pts(pr.benefitHund)})`);
        plist.appendChild(li);
        return li;
      });
      body.appendChild(plist);

      const startCost = ch.repair.length ? ch.repair[0].beforeCostCents : ch.final.costCents;
      const scale = Math.max(startCost, ctx.budgetCents, 1);
      const setMeter = (cost) => {
        fill.style.transform = `scaleX(${Math.min(1, cost / scale)})`;
        fill.classList.toggle('ok', cost <= ctx.budgetCents);
        text.textContent = `Custo ${brl(cost)} para um orçamento de ${brl(ctx.budgetCents)}`;
      };
      mark.style.left = `calc(${ctx.budgetCents / scale * 100}% - 1px)`;
      setMeter(startCost);

      if (!ch.repair.length) {
        setCaption(`Reparação do filho ${ci + 1}: o custo de ${brl(ch.final.costCents)} cabe no orçamento. Nada a remover.`);
        await wait(1400, tok);
      } else {
        for (const s of ch.repair) {
          const bit = chrom.querySelector(`.bit[data-i="${s.removed}"]`);
          bit.classList.add('rm');
          lis[s.removed].classList.add('removed');
          const pr = ctx.projects[s.removed];
          setCaption(`Reparação do filho ${ci + 1}: ${brl(s.beforeCostCents)} passa do orçamento. Sai ${L(s.removed)} (${esc(pr.name)}), a menor razão benefício/custo entre os selecionados: ${ratioTxt(pr.benefitHund, pr.costCents)} ponto(s) por R$ 1.000.`);
          await wait(1700, tok);
          K.bits[s.removed] = 0;
          bit.textContent = '0';
          bit.classList.remove('on');
          setMeter(s.afterCostCents);
          row.querySelector('.sr-meta').innerHTML = `${s.before} → <strong>${s.after}</strong>`;
          await wait(900, tok);
          bit.classList.remove('rm');
        }
      }
      setCaption(`Filho ${ci + 1} avaliado: <code>${ch.final.chromosome}</code>, custo ${brl(ch.final.costCents)}, aptidão ${pts(ch.final.benefitHund)}.`);
      await wait(1100, tok);
    }

    // 5. filhos entram na nova população
    body = stageClear(n);
    p.children.forEach((ch, ci) => {
      body.appendChild(srow(`<strong>Filho ${ci + 1}</strong> → #${ch.placedAt}`, modelChrom(kids[ci]), `aptidão <strong>${pts(ch.final.benefitHund)}</strong>`));
    });
    const places = p.children.map((ch, ci) => `filho ${ci + 1} na posição #${ch.placedAt}`);
    setCaption(p.controlled ? `${head}Resultado: filho 1 = ${p.children[0].final.chromosome} (aptidão ${pts(p.children[0].final.benefitHund)}), filho 2 = ${p.children[1].final.chromosome} (aptidão ${pts(p.children[1].final.benefitHund)}). Um filho pode ser pior que os pais.` : `Par ${p.pair} concluído: ${listPt(places)} da geração ${g}.`);
    await wait(1400, tok);
  }

  // teste 6.4 usando as funções do ga.js
  async function animateTest64() {
    if (mode === 'running') pause();
    const P = V.PROJECTS, B = V.BUDGET;
    const [k1, k2] = GA.cruzar(GA.transformarEmGenes('1100'), GA.transformarEmGenes('0011'), 2);
    const kids = [[k1, [true, false, false, false]], [k2, [false, false, false, false]]].map(([k, mask]) => {
      const m = GA.mutar(k, mask);
      const r = GA.reparar(m.genes, P, B);
      return { beforeMutation: GA.transformarEmTexto(k), flipped: m.flipped, afterMutation: GA.transformarEmTexto(m.genes), repair: r.steps, final: r.evaluation, placedAt: 0 };
    });
    const pair = {
      pair: 1, controlled: true, tournaments: [],
      parents: [{ index: '–', chromosome: '1100', fitnessHund: 1200 }, { index: '–', chromosome: '0011', fitnessHund: 1100 }],
      crossover: { draw: 0, rate: 1, happened: true, cut: 2 },
      offspring: [GA.transformarEmTexto(k1), GA.transformarEmTexto(k2)], discardedSecond: false, children: kids,
    };
    abortAnim();
    const tok = animToken;
    animating = true;
    $('#stage').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
    try { await animPair({ generation: 0 }, pair, tok, { projects: P, budgetCents: B, mutationRate: 0 }); }
    catch (e) { if (e !== ABORT) throw e; }
    finally { if (tok === animToken) animating = false; }
  }

  // Testes na interface
  function runTestsUI() {
    const out = $('#tests-out');
    out.innerHTML = '<p class="muted">Executando…</p>';
    setTimeout(() => {
      const tests = V.runValidation();
      const passed = tests.filter((t) => t.pass).length;
      out.innerHTML = '';
      out.appendChild(el('p', 'tests-sum', `${passed} de ${tests.length} testes aprovados.`));
      const list = el('div', 'tests');
      tests.forEach((t) => {
        const d = el('div', 'test');
        d.innerHTML = `<h3><span class="verdict ${t.pass ? 'ok' : 'bad'}">${t.pass ? '✓ passou' : '✗ falhou'}</span> ${t.id} ${esc(t.title)}</h3>` +
          `<dl><dt>Entrada</dt><dd>${esc(t.input)}</dd><dt>Esperado</dt><dd>${esc(t.expected)}</dd><dt>Obtido</dt><dd>${esc(t.obtained)}</dd></dl>`;
        list.appendChild(d);
      });
      out.appendChild(list);

      out.appendChild(el('h3', 'sub', 'Efeito da mutação (6.5): 1% e 20%, sementes 1 a 5'));
      const comp = V.mutationComparison();
      let rows = '';
      comp.forEach((c) => c.runs.forEach((r) => {
        rows += `<tr><td>${pct(c.rate)}</td><td>${r.seed}</td><td>${pts(r.bestHund)}</td><td><code>${r.chromosome}</code></td><td>${r.generation}</td><td>${mean2(r.finalMeanHund)}</td></tr>`;
      }));
      const wrap = el('div', 'table-scroll');
      wrap.style.maxHeight = 'none';
      wrap.innerHTML = `<table class="exp"><thead><tr><th>Mutação</th><th>Semente</th><th>Melhor final</th><th>Cromossomo</th><th>Geração em que surgiu</th><th>Média da população na geração 50</th></tr></thead><tbody>${rows}</tbody></table>`;
      out.appendChild(wrap);
      const sum = comp.map((c) => `Mutação ${pct(c.rate)}: média do melhor benefício final ${mean2(c.meanBestHund)}; ${c.hits12} de 5 execuções atingiram 12; média da população final ${mean2(c.meanFinalPopHund)}.`).join(' ');
      out.appendChild(el('p', null, sum));
      noTranslate(out);
    }, 20);
  }

  // Inicialização
  function fillDefaults() {
    Object.entries(DEFAULTS).forEach(([k, v]) => { $('#f-' + k).value = v; });
  }

  function init() {
    fillDefaults();
    readUrl();
    renderProjects();
    applySpeed();

    ['f-budget', 'f-pop', 'f-gens', 'f-cross', 'f-mut', 'f-tour', 'f-elite', 'f-seed'].forEach((id) => {
      $('#' + id).addEventListener('input', onDataChanged);
    });
    $('#add-project').addEventListener('click', () => {
      if (projects.length >= MAX_P) return;
      projects.push({ name: `Projeto ${L(projects.length)}`, cost: '1000', benefit: '1' });
      renderProjects();
      onDataChanged();
      const inp = document.getElementById(`p-${projects.length - 1}-name`);
      inp.focus(); inp.select();
    });
    $('#load-example').addEventListener('click', () => {
      const snap = snapshot();
      projects = EXAMPLE.map((p) => Object.assign({}, p));
      fillDefaults();
      renderProjects();
      onDataChanged();
      offerUndo('Exemplo da seção 6.1 restaurado.', snap);
    });
    $('#undo-btn').addEventListener('click', () => {
      if (!undoSnap) return;
      restore(undoSnap);
      hideUndo();
    });
    window.addEventListener('beforeunload', (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });
    new ResizeObserver((entries) => {
      chartW = Math.round(entries[0].contentRect.width);
      drawChart();
    }).observe($('#chart'));
    $('#btn-run').addEventListener('click', run);
    $('#btn-pause').addEventListener('click', pause);
    $('#btn-step').addEventListener('click', stepOnce);
    $('#btn-reset').addEventListener('click', reset);
    $('#anim-speed').addEventListener('input', applySpeed);
    $('#anim-skip').addEventListener('click', () => {
      if (!animating) return;
      abortAnim();
      if (engine) setCaption(`Animação pulada. A geração ${engine.geracao} já está calculada; veja o registro abaixo.`);
      $('#stage-body').innerHTML = '';
    });
    $('#log-gen').addEventListener('change', (e) => {
      selectedLogGen = Number(e.target.value);
      renderLog();
      renderHistory();
    });
    $('#btn-tests').addEventListener('click', runTestsUI);
    $('#btn-anim64').addEventListener('click', animateTest64);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawChart);

    reset();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

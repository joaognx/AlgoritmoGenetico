// Executa os testes de validação no Node: node tests/run-tests.js
const V = require('../js/validation.js');

const tests = V.runValidation();
let ok = 0;
for (const t of tests) {
  if (t.pass) ok++;
  console.log(`[${t.pass ? 'OK' : 'FALHOU'}] ${t.id} ${t.title}`);
  console.log(`   entrada:  ${t.input}`);
  console.log(`   esperado: ${t.expected}`);
  console.log(`   obtido:   ${t.obtained}`);
}
console.log(`\n${ok}/${tests.length} testes aprovados\n`);

const full = V.fullRun();
console.log('Histórico da execução completa (semente 42):');
console.log('ger | melhor | cromossomo | média | acumulado');
for (const h of full.engine.historico) {
  console.log(`${h.generation} | ${h.bestHund / 100} | ${h.bestChromosome} | ${(h.meanHund / 100).toFixed(2)} | ${h.bestSoFarHund / 100} (${h.bestSoFarChromosome})`);
}

console.log('\nComparação de mutação:');
for (const c of V.mutationComparison()) {
  console.log(`taxa ${c.rate * 100}%: média do melhor = ${(c.meanBestHund / 100).toFixed(2)}; atingiram 12: ${c.hits12}/5; média da população final = ${(c.meanFinalPopHund / 100).toFixed(2)}`);
  for (const r of c.runs) console.log(`   semente ${r.seed}: melhor ${r.bestHund / 100} (${r.chromosome}) na geração ${r.generation}; média final da população ${(r.finalMeanHund / 100).toFixed(2)}`);
}
process.exit(ok === tests.length ? 0 : 1);

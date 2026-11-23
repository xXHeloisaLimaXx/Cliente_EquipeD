// Testes: conversões conhecidas + execução contra a API real do Grupo C.
// Uso: com a API do Grupo C rodando, `npm test` (ou API_URL=... npm test).
import assert from 'node:assert/strict';
import { parseData, normalizarStatus, processarEncomenda } from './public/normalizador.js';

const API = (process.env.API_URL ?? 'http://localhost:3000') + '/api/v1';

// Mesma data/hora (12/11/2026 09:00 em Fortaleza) escrita nos 4 formatos → mesmo instante.
const alvo = Date.parse('2026-11-12T09:00:00-03:00');
assert.equal(parseData('2026-11-12T09:00:00-03:00', 'ISO8601'), alvo);
assert.equal(parseData('1794484800', 'UNIX'), alvo);
assert.equal(parseData('12/11/2026 09:00', 'DD/MM/YYYY HH:mm'), alvo);
assert.equal(parseData('11/12/2026 09:00 AM', 'MM/DD/YYYY hh:mm A'), alvo);
assert.equal(parseData('11/13/2026 09:00 PM', 'MM/DD/YYYY hh:mm A'), Date.parse('2026-11-13T21:00:00-03:00'));
assert.equal(parseData('11/13/2026 12:30 AM', 'MM/DD/YYYY hh:mm A'), Date.parse('2026-11-13T00:30:00-03:00'));
assert.throws(() => parseData('13/13/2026 09:00', 'MM/DD/YYYY hh:mm A'));

// As 3 variações de "em trânsito" viram o mesmo status.
for (const s of ['EM_TRANSITO', 'IN_TRANSIT', 'EM ROTA', 'Em trânsito']) assert.equal(normalizarStatus(s), 'EM_TRANSITO');
assert.equal(normalizarStatus('EM ENTREGA'), 'SAIU_PARA_ENTREGA');
console.log('Conversões: OK');

const get = async (p) => (await fetch(API + p)).json();
const transportadoras = await get('/transportadora');
const encomendas = await get('/encomenda?include=movimentacoes');
const porId = new Map(transportadoras.map((t) => [t.id, t]));
const agora = Date.parse(process.env.REFERENCIA ?? '2026-11-23T12:00:00-03:00');

const cont = {};
let desconhecidos = 0;
for (const enc of encomendas) {
  const r = processarEncomenda(enc, porId.get(enc.transportadoraID), agora); // lança erro se algum formato falhar
  desconhecidos += r.eventos.filter((e) => e.status === 'DESCONHECIDO').length;
  assert.ok(r.tempoTransporteMs >= 0, `${r.codigoRastreio}: tempo de transporte negativo`);
  cont[r.situacao] = (cont[r.situacao] ?? 0) + 1;
}
assert.equal(desconhecidos, 0, 'há status sem equivalente no mapa');
console.log(`Encomendas processadas: ${encomendas.length}`);
console.log('Situação (referência 23/11/2026 12:00):', cont);
console.log('Tudo certo.');

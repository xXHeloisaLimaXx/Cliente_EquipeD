import { processarEncomenda, fmtData, fmtDuracao, ETAPAS, SITUACOES } from './normalizador.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const entradaLocal = (d) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

let dados = { transportadoras: [], encomendas: [] };
let linhas = [];
let filtroSituacao = '';

async function getJSON(url) {
  const r = await fetch(url);
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.error ?? `Erro ${r.status} em ${url}`);
  return corpo;
}

async function carregar() {
  $('#erro').hidden = true;
  try {
    const [transportadoras, encomendas] = await Promise.all([
      getJSON('/api/v1/transportadora'),
      getJSON('/api/v1/encomenda?include=movimentacoes'),
    ]);
    dados = { transportadoras, encomendas };
    $('#transp').innerHTML = '<option value="">Todas</option>' +
      transportadoras.map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join('');
    processar();
  } catch (e) {
    mostrarErro(`Não foi possível carregar os dados. ${e.message}`);
  }
}

function mostrarErro(msg) { const el = $('#erro'); el.textContent = msg; el.hidden = false; }

function processar() {
  const agora = $('#ref').value ? new Date($('#ref').value).getTime() : Date.now();
  const porId = new Map(dados.transportadoras.map((t) => [t.id, t]));
  const falhas = [];
  linhas = [];
  for (const enc of dados.encomendas) {
    try { linhas.push(processarEncomenda(enc, porId.get(enc.transportadoraID), agora)); }
    catch (e) { falhas.push(`${enc.codigoRastreio}: ${e.message}`); }
  }
  if (falhas.length) mostrarErro(`${falhas.length} encomenda(s) não puderam ser interpretadas. ${falhas[0]}`);
  desenhar();
}

function filtradas() {
  const t = $('#transp').value, q = $('#busca').value.trim().toLowerCase();
  return linhas.filter((l) =>
    (!t || String(l.transportadora.id) === t) &&
    (!q || l.codigoRastreio.toLowerCase().includes(q)) &&
    (!filtroSituacao || l.situacao === filtroSituacao));
}

function desenhar() {
  const base = linhas.filter((l) => !$('#transp').value || String(l.transportadora.id) === $('#transp').value);
  const cont = Object.fromEntries(Object.keys(SITUACOES).map((k) => [k, base.filter((l) => l.situacao === k).length]));
  const botoes = [['', 'Todas', base.length], ...Object.entries(SITUACOES).map(([k, r]) => [k, r, cont[k]])];
  $('#resumo').innerHTML = botoes.map(([k, r, n]) =>
    `<button type="button" data-sit="${k}" aria-pressed="${k === filtroSituacao}"><strong>${n}</strong><span>${esc(r)}</span></button>`).join('');

  const lista = filtradas();
  $('#contagem').textContent = `${lista.length} de ${linhas.length} encomendas`;
  $('#linhas').innerHTML = lista.length ? lista.map((l) => `
    <tr tabindex="0" data-id="${l.id}">
      <td class="cod">${esc(l.codigoRastreio)}</td>
      <td>${esc(l.transportadora.nome)}</td>
      <td class="rota">${esc(l.origem)} para ${esc(l.destino)}</td>
      <td>${esc(ETAPAS[l.statusAtual] ?? l.statusAtual)}</td>
      <td class="num">${fmtDuracao(l.tempoTransporteMs)}</td>
      <td class="num">${fmtData(l.previsao)}</td>
      <td><span class="selo ${l.situacao}">${SITUACOES[l.situacao]}</span></td>
    </tr>`).join('') : '<tr><td colspan="7">Nenhuma encomenda encontrada com esses filtros.</td></tr>';
}

function textoDiferenca(l) {
  if (l.diferencaMs > 0) return `${fmtDuracao(l.diferencaMs)} de atraso`;
  return l.dataEntrega ? `${fmtDuracao(l.diferencaMs)} antes da previsão` : `faltam ${fmtDuracao(l.diferencaMs)} para a previsão`;
}

function abrirDetalhe(id) {
  const l = linhas.find((x) => x.id === id);
  if (!l) return;
  $('#detalhe').innerHTML = `
    <div class="det-topo">
      <div>
        <h2 id="det-titulo">${esc(l.codigoRastreio)}</h2>
        <p>${esc(l.origem)} para ${esc(l.destino)}. ${esc(l.transportadora.nome)}, datas no formato ${esc(l.transportadora.formatoData)}.</p>
      </div>
      <form method="dialog"><button>Fechar</button></form>
    </div>
    <dl class="fatos">
      <div><dt>Postagem</dt><dd>${fmtData(l.postagem)}</dd></div>
      <div><dt>Previsão de entrega</dt><dd>${fmtData(l.previsao)}</dd></div>
      <div><dt>${l.dataEntrega ? 'Entregue em' : 'Ainda não entregue'}</dt><dd>${l.dataEntrega ? fmtData(l.dataEntrega) : 'Em trânsito até a referência'}</dd></div>
      <div><dt>Tempo de transporte</dt><dd>${fmtDuracao(l.tempoTransporteMs)}</dd></div>
      <div><dt>Situação</dt><dd><span class="selo ${l.situacao}">${SITUACOES[l.situacao]}</span><br>${textoDiferenca(l)}</dd></div>
    </dl>
    <div class="det-corpo">
      <h3>Histórico de movimentações</h3>
      <table>
        <thead><tr><th>Data e hora (Fortaleza)</th><th>Etapa padrão</th><th>Local</th><th>Como a transportadora enviou</th></tr></thead>
        <tbody>${l.eventos.map((e) => `
          <tr><td class="num">${fmtData(e.t)}</td><td>${esc(ETAPAS[e.status] ?? e.status)}</td><td>${esc(e.local)}</td>
          <td class="orig">${esc(e.statusOriginal)}, ${esc(e.dataHoraOriginal)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  $('#detalhe').showModal();
}

$('#ref').value = entradaLocal(new Date());
$('#ref').addEventListener('change', processar);
$('#recarregar').addEventListener('click', carregar);
$('#transp').addEventListener('change', desenhar);
$('#busca').addEventListener('input', desenhar);
$('#resumo').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  filtroSituacao = b.dataset.sit; desenhar();
});
$('#linhas').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) abrirDetalhe(Number(tr.dataset.id)); });
$('#linhas').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const tr = e.target.closest('tr[data-id]'); if (tr) abrirDetalhe(Number(tr.dataset.id)); } });
$('#detalhe').addEventListener('click', (e) => { if (e.target === $('#detalhe')) $('#detalhe').close(); });

carregar();

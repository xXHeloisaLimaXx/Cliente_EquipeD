// Camada de normalização do Grupo D: transforma os dados heterogêneos das
// transportadoras em um modelo único (status padrão + data em milissegundos UTC).

// Decisão 1: fuso assumido para formatos sem fuso (DD/MM/YYYY e MM/DD/YYYY).
// Brasil (Fortaleza) é UTC-3 e não tem horário de verão.
const DESLOCAMENTO_FORTALEZA_MS = 3 * 3600 * 1000;

// Decisão 2: 4 etapas padrão, na ordem do processo de entrega.
export const ETAPAS = {
  POSTADO: 'Postado',
  EM_TRANSITO: 'Em trânsito',
  SAIU_PARA_ENTREGA: 'Saiu para entrega',
  ENTREGUE: 'Entregue',
};

// Mapa de equivalência (a API só lista os códigos; a equivalência é nossa).
// Atenção: "EM ROTA" (Ceará Cargas) é trânsito; "EM ENTREGA" é que significa saída para entrega.
export const MAPA_STATUS = {
  POSTADO: 'POSTADO', EM_TRANSITO: 'EM_TRANSITO', SAIU_PARA_ENTREGA: 'SAIU_PARA_ENTREGA', ENTREGUE: 'ENTREGUE',
  PICKED_UP: 'POSTADO', IN_TRANSIT: 'EM_TRANSITO', OUT_FOR_DELIVERY: 'SAIU_PARA_ENTREGA', DELIVERED: 'ENTREGUE',
  COLETADO: 'POSTADO', 'EM ROTA': 'EM_TRANSITO', 'EM ENTREGA': 'SAIU_PARA_ENTREGA', FINALIZADO: 'ENTREGUE',
  'Objeto postado': 'POSTADO', 'Em trânsito': 'EM_TRANSITO', 'Saiu para entrega': 'SAIU_PARA_ENTREGA',
  'Entregue ao destinatário': 'ENTREGUE',
};

export function normalizarStatus(original) {
  return MAPA_STATUS[original] ?? 'DESCONHECIDO';
}

// Converte o texto de data de uma transportadora para milissegundos UTC.
export function parseData(valor, formato) {
  const v = String(valor).trim();
  let t = NaN, m;
  switch (formato) {
    case 'ISO8601': // 2026-11-11T09:00:00-03:00 (já traz o fuso)
      t = Date.parse(v);
      break;
    case 'UNIX': // segundos desde 1970 (aceita milissegundos se vier com 13 dígitos)
      t = /^\d+$/.test(v) ? Number(v) * (v.length >= 13 ? 1 : 1000) : NaN;
      break;
    case 'DD/MM/YYYY HH:mm': // dia primeiro, 24 horas
      m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(v);
      if (m) t = Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) + DESLOCAMENTO_FORTALEZA_MS;
      break;
    case 'MM/DD/YYYY hh:mm A': // mês primeiro (formato americano), 12 horas com AM/PM
      m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2}) (AM|PM)$/i.exec(v);
      if (m) {
        const hora = (+m[4] % 12) + (m[6].toUpperCase() === 'PM' ? 12 : 0);
        t = Date.UTC(+m[3], +m[1] - 1, +m[2], hora, +m[5]) + DESLOCAMENTO_FORTALEZA_MS;
      }
      break;
  }
  if (!Number.isFinite(t)) throw new Error(`Data "${v}" não segue o formato "${formato}"`);
  return t;
}

export const SITUACOES = {
  ENTREGUE_NO_PRAZO: 'Entregue no prazo',
  ENTREGUE_ATRASO: 'Entregue com atraso',
  EM_ANDAMENTO: 'Em andamento',
  ATRASADA: 'Atrasada',
};

// Junta tudo: devolve a encomenda no modelo padronizado, com tempo de transporte e atraso.
// Regra de atraso (decisão 3): entregue → data da entrega > previsão;
// não entregue → data de referência (agora) > previsão. Comparação ao minuto.
export function processarEncomenda(enc, transportadora, agoraMs) {
  if (!transportadora) throw new Error(`Transportadora ${enc.transportadoraID} não encontrada`);
  const formato = transportadora.formatoData;
  const eventos = (enc.Movimentacoes ?? [])
    .map((m) => ({
      id: m.id, local: m.local, latitude: m.latitude, longitude: m.longitude,
      statusOriginal: m.status, status: normalizarStatus(m.status),
      dataHoraOriginal: m.dataHora, t: parseData(m.dataHora, formato),
    }))
    // Decisão 4: reordenar pela data real do evento (a API ordena por ordem de registro).
    .sort((a, b) => a.t - b.t || a.id - b.id);

  const postagem = parseData(enc.dataPostagem, formato);
  const previsao = parseData(enc.previsaoEntrega, formato);
  const entrega = eventos.find((e) => e.status === 'ENTREGUE') ?? null;
  const atual = eventos.at(-1) ?? null;
  const fim = entrega ? entrega.t : agoraMs;
  const diferenca = fim - previsao; // > 0 = passou da previsão

  let situacao;
  if (entrega) situacao = diferenca > 0 ? 'ENTREGUE_ATRASO' : 'ENTREGUE_NO_PRAZO';
  else situacao = diferenca > 0 ? 'ATRASADA' : 'EM_ANDAMENTO';

  return {
    id: enc.id, codigoRastreio: enc.codigoRastreio, origem: enc.origem, destino: enc.destino,
    transportadora, eventos, postagem, previsao,
    dataEntrega: entrega?.t ?? null,
    statusAtual: atual?.status ?? 'SEM_MOVIMENTACAO',
    tempoTransporteMs: fim - postagem, diferencaMs: diferenca, situacao,
  };
}

const formatador = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' });
export const fmtData = (t) => formatador.format(t);

export function fmtDuracao(ms) {
  const min = Math.round(Math.abs(ms) / 60000);
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), mm = min % 60;
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${mm} min`;
  return `${mm} min`;
}

// Servidor do Grupo D: entrega a página e repassa /api/* para a API do Grupo C.
// O repasse existe porque a API do Grupo C não habilita CORS; assim o navegador
// só conversa com este servidor (mesma origem) e nada precisa mudar no código do Grupo C.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_URL = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const PORT = process.env.PORT ?? 4000;
const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function json(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corpo));
}

http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      if (req.method !== 'GET') return json(res, 405, { error: 'Este cliente só faz leitura (GET).' });
      try {
        const r = await fetch(API_URL + req.url);
        res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') ?? 'application/json' });
        return res.end(Buffer.from(await r.arrayBuffer()));
      } catch {
        return json(res, 502, { error: `Não foi possível falar com a API do Grupo C em ${API_URL}. Ela está rodando?` });
      }
    }
    const caminho = req.url.split('?')[0];
    const arquivo = join(PUBLIC, normalize(caminho === '/' ? '/index.html' : caminho));
    if (!arquivo.startsWith(PUBLIC)) return json(res, 403, { error: 'Acesso negado.' });
    const dados = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] ?? 'application/octet-stream' });
    res.end(dados);
  } catch {
    json(res, 404, { error: 'Não encontrado.' });
  }
}).listen(PORT, () => console.log(`Cliente do Grupo D em http://localhost:${PORT}  (API do Grupo C: ${API_URL})`));

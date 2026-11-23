# Cliente de rastreio de encomendas (Grupo D)

Aplicação web que consome a **Logistics API** do Grupo C (Estudo de Caso 2: Rastreamento de Encomendas
entre Transportadoras).
Ela mostra o histórico de cada encomenda, calcula o tempo de transporte e identifica atrasos, depois de padronizar
os status e as datas das 4 transportadoras.

## Como rodar

Precisa do **Node.js 20 ou superior** (`node -v`). Não há dependências para instalar.

1. Ligue a API do Grupo C (em outra pasta/terminal): `npm install` e `npm start` (porta 3000).
2. Nesta pasta: `npm start`
3. Abra **http://localhost:4000**

Se a API estiver em outro endereço: `API_URL=http://outro-host:3000 npm start`.
Teste automático (com a API ligada): `npm test`.

## Como funciona

```
Navegador ──► servidor.js (porta 4000) ──► API do Grupo C (porta 3000)
                │ entrega a página e repassa /api/*
public/normalizador.js  parsers de data, mapa de status, tempo de transporte e atraso
public/app.js           tabela, filtros, resumo e histórico
```

O `servidor.js` repassa as chamadas porque a API do Grupo C não habilita CORS; assim o navegador só fala com a mesma origem
e nada precisa mudar no código do outro grupo.

## Regras de padronização

- **Formato de dados combinado com o Grupo C:** JSON.
- **Status padrão:** Postado, Em trânsito, Saiu para entrega, Entregue (mapa dos 16 códigos em `normalizador.js`).
- **Datas:** tudo vira instante UTC e é exibido em horário de Fortaleza (UTC-3). Formatos sem fuso são tratados como UTC-3.
- **Atraso:** entregue com data de entrega depois da previsão, ou não entregue com a data de referência depois da previsão.
- **Tempo de transporte:** da postagem até a entrega (ou até a data de referência, se ainda não entregue).
- **Ordem do histórico:** reordenada pela data real do evento, e não pela ordem de registro da API.

A **data de referência** no topo da página é o "agora" usado nos cálculos (padrão: hora atual). Mude-a para simular outro dia.

# Relatório de integração com a API (Grupo D)

**Disciplina:** Sistemas Distribuídos, IFCE Tianguá
**Atividade:** Representação de Dados e Interoperabilidade, Estudo de Caso 2 (Rastreamento de Encomendas entre Transportadoras)
**Grupo D (cliente):** _[nomes dos integrantes]_  **Grupo C (API mock):** _[nomes dos integrantes]_
**Repositório:** _[link do GitHub]_

## 1. Visão geral

O Grupo C entregou a Logistics API (Node.js, Express e SQLite) com 4 transportadoras, 76 encomendas e 221 movimentações.
O Grupo D desenvolveu uma aplicação web que consome essa API, apresenta o histórico de cada encomenda, calcula o tempo de
transporte e identifica atrasos. Para isso, o cliente padroniza os status e as datas, que a API entrega propositalmente
em formatos diferentes por transportadora.

## 2. Formato de representação de dados

Os dois grupos adotaram **JSON**. _[confirmar com o Grupo C e registrar a data da conversa]_ A API já responde em JSON, o formato
é legível, tem suporte nativo no JavaScript do navegador e comporta bem o histórico aninhado (encomenda com transportadora e
movimentações na mesma resposta).

## 3. Endpoints usados

| Endpoint | Uso no cliente |
|---|---|
| `GET /api/v1/transportadora` | Obter `formatoData` e `listaStatus` de cada transportadora |
| `GET /api/v1/encomenda?include=movimentacoes` | Obter todas as encomendas já com o histórico, em uma só chamada |

## 4. Problemas encontrados

| # | Problema | Onde aparece |
|---|---|---|
| 1 | **Status diferentes para a mesma etapa.** São 16 códigos para 4 etapas (ex.: `EM_TRANSITO`, `IN_TRANSIT`, `EM ROTA`, `Em trânsito`). A API só lista os códigos de cada transportadora e não informa o equivalente. | Todas |
| 2 | **Quatro formatos de data:** `DD/MM/YYYY HH:mm` (Rápido Nordeste), ISO 8601 com fuso (Global Express), Unix em segundos (Ceará Cargas) e `MM/DD/YYYY hh:mm A` (LogBR). | Todas |
| 3 | **Formato americano.** A LogBR escreve mês antes do dia, com AM/PM. Tratá-la como dia/mês produziria datas erradas sem nenhum erro aparente (ex.: `11/05/2026` seria lido como 11 de maio). | LogBR |
| 4 | **Falta de fuso horário.** Só o ISO 8601 informa o fuso (`-03:00`). Os formatos com barra não têm fuso, e Unix é UTC. | Três de quatro |
| 5 | **Nomes enganosos.** `EM ROTA` (Ceará Cargas) corresponde a "em trânsito", e `EM ENTREGA` é que corresponde a "saiu para entrega". | Ceará Cargas |
| 6 | **Ordem do histórico.** A API ordena por ordem de registro (`createdAt`), não pela data do evento, e não há campo de status atual. | API |
| 7 | **CORS não habilitado.** O navegador bloqueia páginas de outra origem que chamam a API diretamente. | API |

## 5. Decisões de padronização

1. **Status padrão:** Postado, Em trânsito, Saiu para entrega, Entregue. Tabela de equivalência:

| Padrão | Rápido Nordeste | Global Express | Ceará Cargas | LogBR |
|---|---|---|---|---|
| Postado | POSTADO | PICKED_UP | COLETADO | Objeto postado |
| Em trânsito | EM_TRANSITO | IN_TRANSIT | EM ROTA | Em trânsito |
| Saiu para entrega | SAIU_PARA_ENTREGA | OUT_FOR_DELIVERY | EM ENTREGA | Saiu para entrega |
| Entregue | ENTREGUE | DELIVERED | FINALIZADO | Entregue ao destinatário |

2. **Datas:** todas as datas viram um instante único (milissegundos UTC) e são exibidas em horário de Fortaleza. O parser de cada
   transportadora é escolhido pelo campo `formatoData` que a própria API informa.
3. **Fuso assumido:** formatos sem fuso são tratados como **UTC-3** (America/Fortaleza; o Brasil não adota horário de verão).
4. **Ordem:** o cliente reordena as movimentações pela data real do evento, em vez de confiar na ordem de registro.
5. **Status atual:** é a etapa da última movimentação, já reordenada.
6. **Tempo de transporte:** da `dataPostagem` até a movimentação "Entregue" ou, se ainda não entregue, até a data de referência.
7. **Atraso:** encomenda entregue é atrasada se a data da entrega for posterior à `previsaoEntrega`; encomenda não entregue é
   atrasada se a data de referência for posterior à previsão. A comparação é feita ao minuto.
8. **Data de referência:** é o "agora" dos cálculos. Fica configurável na tela, porque os dados mock têm datas fixas
   (outubro e novembro de 2026).

## 6. Adaptações feitas no cliente

- **`normalizador.js`:** parsers de data por formato, mapa de status, ordenação, tempo de transporte e atraso.
- **`servidor.js`:** entrega a página e repassa `/api/*` à API do Grupo C. Isso resolveu o problema do CORS sem alterar o
  código do outro grupo.
- **Tela de histórico:** mostra, para cada movimentação, o dado padronizado ao lado do original enviado pela transportadora
  (por exemplo `Em trânsito, 11/14/2026 09:00 PM`), o que deixa a conversão visível.
- **Testes (`teste.js`):** garantem que a mesma data escrita nos 4 formatos resulta no mesmo instante, que as variações de
  "em trânsito" viram um só status e que as 76 encomendas reais são processadas sem erro.

## 7. Resultados

Com data de referência 23/11/2026 12:00 (Fortaleza), as 76 encomendas foram classificadas assim:

| Situação | Quantidade |
|---|---|
| Entregue no prazo | 15 |
| Entregue com atraso | 18 |
| Em andamento | 5 |
| Atrasada (não entregue e com a previsão vencida) | 38 |

Todos os valores de data seguiram o `formatoData` esperado e todos os status foram reconhecidos pelo mapa.
Os números mudam conforme a data de referência escolhida.

## 8. Demonstração

Screenshots na pasta `screenshots/`: lista de encomendas com resumo e filtros, e histórico de uma encomenda da LogBR com a
conversão do formato americano. _[acrescentar capturas dos demais cenários, se desejado]_

## 9. Limitações e melhorias

- O fuso UTC-3 é uma suposição, já que a API não informa o fuso dos formatos sem fuso.
- Um status novo, que ainda não esteja no mapa, é exibido como "DESCONHECIDO" em vez de derrubar a aplicação.
- O cliente só lê dados (GET); não cadastra encomendas nem movimentações.

## 10. Conclusão

_[2 ou 3 frases do grupo sobre o que aprendeu: por que uma camada de normalização separada facilita a interoperabilidade, e o que
seria melhor se os dois grupos tivessem combinado um padrão único desde o início.]_

# Relatório de entrega — Central de Chamados

Referência: `especificacao/ESPECIFICACAO_FINAL_PARA_IA.md`, versão 4.0.
Data desta entrega: 7 de setembro de 2026.

Este relatório separa o que está **implementado e testado**, o que está
**implementado sem teste real**, o que é **demonstrativo**, o que **depende de
consentimento ou configuração** e o que ficou **fora do escopo**, como exige a
secção 24.

---

## 1. Resumo honesto em três frases

O domínio, os leitores de fontes, a conciliação, as métricas e as sete telas
estão implementados e cobertos por **218 testes automáticos** mais **23 testes
restritos** executados contra os insumos reais, com o XLSM preservado byte a
byte. O protocolo de persistência em revisões imutáveis está implementado e
provado sob concorrência (**100 disputas, um vencedor por rodada, nenhum recibo
perdido**), porém **contra um Microsoft Graph simulado**. **Nenhuma conta
Microsoft foi conectada, nenhum dado foi para o OneDrive e nada foi publicado**
— a prova técnica bloqueante da secção 16.5 continua pendente porque a
configuração pública (client ID e redirect URI) ainda não existe.

---

## 2. Implementado e testado

Testes sintéticos: `npm test` (218 testes, 12 arquivos).
Testes com os insumos reais: `npm run test:restrito` (23 testes) — exige as
variáveis de ambiente descritas em `tests/restrito/baseline-real.test.ts` e só
roda em ambiente autorizado.

### 2.1 Unidades, jornada e rateio

| Regra | Evidência |
|---|---|
| Fração de dia → minutos (0,125 = 180; 0,0625 = 90; 0,18958… = 273) | `tests/duracao.test.ts` |
| 4h33 não vira 4h30; segundos reais viram pendência, não arredondamento | `tests/duracao.test.ts` |
| Parser próprio de `HH:mm`, incluindo acumulado acima de 24 h | `tests/duracao.test.ts` |
| Datas civis sem objeto `Date`; sistema 1900/1904 do arquivo; serial 60 recusado | `tests/datas.test.ts` |
| Nenhum deslocamento de dia por conversão de fuso | `tests/datas.test.ts` |
| Meta de 480 min; 7h30 → faltam 30; 8h15 → excede 15; nunca ambos positivos | `tests/jornada.test.ts` |
| Férias, jornada parcial, início de controle, dias futuros não são atraso | `tests/jornada.test.ts` |
| Compartilhado sem rateio soma uma vez no dia e zero por ticket | `tests/alocacao.test.ts` |
| Rateio 75+45=120 aceito; 75+60 rejeitado (`allocation_sum_mismatch`) | `tests/alocacao.test.ts` |
| As cinco classes e o eixo de células fecham com o total confirmado | `tests/alocacao.test.ts`, `tests/metricas.test.ts` |

### 2.2 Identidade e classificação

| Regra | Evidência |
|---|---|
| Namespaces IR/RR/INC/RITM/SCTASK/CR distintos; compostos separados sem fundir | `tests/identidade.test.ts` |
| Chave oficial não usa título, linha, `External` nem `Reference ID` | `tests/identidade.test.ts` |
| `EXTRABASELINE` avaliado antes de `BASELINE`; célula manual prevalece | `tests/identidade.test.ts` |
| `Updated` nunca vira encerrado; status novo fica visível como não mapeado | `tests/identidade.test.ts` |
| `"Transferido "` com espaço final é a mesma identidade, com bruto preservado | `tests/identidade.test.ts` + real |

### 2.3 Leitores de fontes

| Regra | Evidência |
|---|---|
| CSV com parser real (aspas, escape, quebra de linha no campo, BOM, CRLF) | `tests/csv.test.ts` |
| Perfil detectado pelo cabeçalho; duplicado e obrigatório ausente bloqueiam | `tests/csv.test.ts` |
| Coluna ausente ≠ coluna vazia; coluna desconhecida vira metadado | `tests/csv.test.ts` |
| OOXML preserva fórmula, valor salvo, natureza e erro por célula | `tests/ooxml.test.ts` |
| VBA apenas detectado; vínculo externo marcado e nunca resolvido | `tests/ooxml.test.ts` + real |
| Limites: tamanho, expansão (zip bomb), travessia de caminho, entrada duplicada | `tests/ooxml.test.ts` |
| Nenhuma expansão de entidade XML personalizada (sem XXE por construção) | `tests/ooxml.test.ts` |
| Exportação neutraliza texto que pareceria fórmula | `tests/ooxml.test.ts` |

### 2.4 Baseline do XLSM real — 28 conferências, todas conformes

Executado com `npm run baseline -- "<caminho do xlsm>"` e replicado em
`tests/restrito/`. O arquivo foi aberto **somente para leitura**; o SHA-256
antes e depois é idêntico ao do manifesto (AC-074).

13 abas · Chamados 106 · Apontamentos 333 linhas operacionais · 281 com duração
· 52 sem duração · 323 com referência em B · **33.693 minutos (561h33 brutas)**
entre 18/05/2026 e 31/08/2026 · 72 dias-calendário · Follow-ups 22 · To Do 5 ·
Resolvidos 70 · Histórico Status 16 · Meu desenvolvimento 8 (1 sem data) ·
Planilha1 97 com **14 status divergentes** · Fila Follow-up 20 · 81 “Resolvido”
contra 70 registros (**11 sem correspondência, sem data fabricada**) · 7
“Transferido ” com espaço final · 15 `#REF!` em Apontamentos · 4 `#VALUE!` em
Chamados · 10 fórmulas com vínculo externo · E4=180, E5=90, E142=273, E316=30 ·
298 das 323 linhas com referência têm fórmula em F · A286/E286 preservam data e
270 min apesar dos erros · os 4 pares candidatos a repetição (263/267, 264/268,
265/269, 266/270) viram pendência sem exclusão automática.

### 2.5 Importação e conciliação

| Regra | Evidência |
|---|---|
| Comparação em três estados B/S/A, com conflito quando ambos divergem | `tests/reconciliacao.test.ts` |
| Multiplicidade: reordenar não cria eventos; dois iguais continuam dois | `tests/reconciliacao.test.ts` |
| Correspondência ambígua exige confirmação | `tests/reconciliacao.test.ts` |
| Duração corrigida é alteração, não esforço novo | `tests/reconciliacao.test.ts` |
| Versão antiga não regride; empate divergente é conflito explícito | `tests/importacao.test.ts` |
| Ausência na carga preserva chamado, horas, notas e estado | `tests/importacao.test.ts` |
| Atualização oficial não toca em nenhum campo pessoal | `tests/importacao.test.ts` |
| Referência provisória é completada pelo CSV posterior, sem duplicar | `tests/importacao.test.ts` |
| Prévia invalidada quando a revisão-base ou o hash da fonte mudam | `tests/importacao.test.ts` |
| Excluir candidato da carga não apaga registro existente | `tests/importacao.test.ts` |
| Follow-up, tarefa e desenvolvimento não geram horas | `tests/importacao.test.ts` |
| Cada carga confirmada vira uma revisão atômica com recibo de auditoria | `tests/importacao.test.ts` |

### 2.6 Interface

Verificada com navegador real (`npm run verificar:interface`), capturas em
`docs/evidencias/`:

- sem rolagem horizontal do corpo em **360, 390, 768, 1.280 e 1.440 px**;
- tabela larga rolando dentro do próprio contêiner (306 px visíveis, 1.465 px de
  conteúdo);
- diálogo com foco contido e **foco devolvido ao acionador**;
- nenhum erro de console;
- paleta, contraste e tipografia conferidos por teste
  (`tests/identidade-visual.test.ts`): os cinco HEX da referência, contraste de
  todas as etiquetas ≥ 4,5:1, texto branco sobre Serene Blue e Mint Frost
  provado abaixo do mínimo e ausente das regras, nenhum `@font-face`, nenhum
  gradiente.

### 2.7 Protocolo de persistência (contra Graph **simulado**)

| Regra | Evidência |
|---|---|
| 100 disputas do mesmo eTag: 1 vencedor por rodada, 100 recibos preservados | `tests/persistencia.test.ts` |
| Operação perdedora reaplicável; as duas alterações sobrevivem | `tests/persistencia.test.ts` |
| Idempotência por `operationId`; resposta perdida confirmada pelo recibo | `tests/persistencia.test.ts` |
| Falha de envio e cota não publicam estado nem afirmam salvamento | `tests/persistencia.test.ts` |
| Inicialização concorrente não cria bases paralelas nem renomeia pastas | `tests/persistencia.test.ts` |
| Cabeça vazia com revisões existentes entra em recuperação | `tests/persistencia.test.ts` |
| Conteúdo alterado por fora detectado por hash; base de outra conta recusada | `tests/persistencia.test.ts` |
| Restaurar cria revisão nova e preserva a anterior | `tests/persistencia.test.ts` |
| Ponteiro cabe em 768 caracteres e não carrega texto de chamados | `tests/persistencia.test.ts` |

---

## 3. Implementado sem teste real

Estes componentes estão escritos, tipados e compilados, mas **nunca foram
executados contra o serviço real**:

- **`src/adapters/identity/msal.ts`** — Authorization Code com PKCE, autoridade
  de consumidores, cache em memória, escopo `Files.ReadWrite.AppFolder` e
  consentimento incremental para `Files.Read`. Nunca executado contra o
  Microsoft Entra.
- **`src/adapters/graph/graphReal.ts`** — chamadas ao Graph com `If-Match` no
  PATCH, `conflictBehavior: fail`, download por `@microsoft.graph.downloadUrl`
  sem anexar o bearer token, tradução de 401/403/404/409/412/429/507. Nunca
  executado contra o Microsoft Graph.
- **Tratamento de `429` com `Retry-After`** — implementado na tradução de erro,
  sem teste que o exercite.

O `GraphSimulado` reproduz identidade de item, eTag por gravação, `If-Match` e
`conflictBehavior: fail`. **Passar nesses testes prova que o protocolo é correto
sob concorrência; não prova que o OneDrive real se comporta assim.**

---

## 4. Demonstrativo

O modo demonstrativo é **explicitamente separado** e usa apenas dados
inventados (`src/fixtures/demonstracao.ts`, faixa de identificadores 9xxxxxxx).
Nesse modo:

- toda tela exibe a faixa “Modo demonstrativo — dados inventados”;
- qualquer alteração informa “**alterado apenas nesta sessão do navegador**”;
- a aplicação **nunca** exibe “Salvo no OneDrive”;
- a exportação avisa que conterá os dados sintéticos exibidos.

---

## 5. Dependente de consentimento ou configuração

| O que falta | Comportamento seguro hoje |
|---|---|
| Client ID e redirect URI reais | Login desativado; a tela de entrada diz “Integração Microsoft não configurada” e oferece só o modo demonstrativo. Nenhum valor fictício é preenchido. |
| Consentimento Microsoft da pessoa | Nenhuma chamada ao Graph é feita. |
| Hospedagem HTTPS e autorização para publicar | Nada foi publicado. Não há URL. |
| Vínculo com a planilha no OneDrive | Só o upload manual está disponível; nenhuma pasta do OneDrive é varrida. |
| Fuso das extrações CS3 | Horários preservados como locais; perfis temporais diferentes não são comparados. |
| Data inicial de controle e calendário real | Padrão editável apresentado; sem início definido não se gera dívida retroativa. |
| Cadência e limite de follow-up | `ruleStatus = unconfirmed`; nenhuma elegibilidade automática, nenhum encerramento recomendado. A divergência “três cobranças IR × duas nos cálculos” está sinalizada, sem assumir nenhuma das regras. |
| Licença e arquivo da fonte Magnetik | Fallback do sistema em uso e **declarado na interface e no diagnóstico**. Nenhuma fonte foi baixada ou incorporada. |
| Rateio, duplicatas e célula histórica dos registros reais | Pendências de conciliação abertas, sem correção silenciosa. |

---

## 6. Fora do escopo desta versão

Envio de horas ao CS3; alteração do CS3; robô agendado sem usuário; trabalho
offline com sincronização posterior; edição bidirecional do XLSM; colaboração
multiusuário na mesma base; aprovações corporativas; cronômetro; armazenamento
de senhas; indicadores oficiais de SLA. Nenhuma dessas funções aparece como
botão aparentemente ativo. O conector automático CS3 e a extensão assistida são
evolução separada (secção 19).

---

## 7. Lacunas conhecidas do que foi entregue

São itens da especificação que **ainda não estão prontos**, declarados aqui em
vez de escondidos:

1. **AC-039 (cópia renomeada)** — a identidade da fonte é guardada por SHA-256 e
   por `driveId + itemId`, mas **não existe o fluxo que propõe associar uma
   cópia renomeada à fonte já conhecida**. Hoje um arquivo com outro nome e
   mesmo conteúdo é reconhecido pelo hash, porém a associação explícita não é
   oferecida na tela.
2. **AC-068 (fonte alterada durante o download)** — a prévia é invalidada quando
   o hash muda (testado), mas a **releitura de metadados antes e depois do
   download, com retentativa limitada**, está descrita e não implementada no
   adaptador.
3. **Verificação periódica** (revisão a cada 60 s com a tela visível; fonte
   vinculada a cada 5 min) — **não implementada**.
4. **Checkpoint e restauração pela interface** — o repositório implementa
   `restaurar` e há teste; o botão “Criar checkpoint” está desativado enquanto
   não houver conexão.
5. **Leitura do XLSM em Web Worker** — hoje o parser roda na thread principal.
   Com o arquivo real (777 KiB, 13 abas) a leitura levou centenas de
   milissegundos nos testes, mas a especificação pede Worker e feedback
   contínuo: **ainda não implementado**.
6. **Meta de escala (2.000 tickets, 10.000 apontamentos, revisão até 10 MiB)** —
   **não medida**.
7. **Teste com leitor de tela e zoom de 200 %** — **não executado**. O que foi
   verificado por navegador está na secção 2.6.
8. **Navegadores** — verificado apenas em Chromium. Safari e Edge **não foram
   testados**.
9. **Kanban opcional em Chamados** — não implementado; a tabela, que é a visão
   obrigatória, está pronta.
10. **“Abrir no CS3”** — permanece desabilitado, com explicação. Nenhum endereço
    é fabricado a partir do número do chamado.

---

## 8. Matriz de aceite AC-001 a AC-074

Legenda: **T** testado automaticamente · **TR** testado com os insumos reais ·
**I** implementado sem teste automático · **C** depende de configuração real ·
**N** não implementado.

| ID | Situação | Observação |
|---|---|---|
| AC-001 | T · TR | 3 IR + 13 RR = 16 identidades; nenhuma hora criada. |
| AC-002 | T · TR | Reimportação idêntica: zero duplicação de notas, horas ou eventos. |
| AC-003 | T | Só campos oficiais mudam; título, célula manual e próxima ação preservados. |
| AC-004 | T | Versão antiga não regride; item marcado e fora da seleção padrão. |
| AC-005 | T | Empate com conteúdo diferente vira conflito; nada decidido pela ordem do upload. |
| AC-006 | T | Ausência preserva ticket, horas e status. |
| AC-007 | T | Coluna ausente preserva; presente e vazia vai ao comparativo. |
| AC-008 | T · TR | Parser real; descrição não é dividida. |
| AC-009 | T | Perfil bloqueado; entrada incompatível avisada. |
| AC-010 | T | Tipo vem do esquema; `External`/`Reference ID` não viram tickets. |
| AC-011 | TR | 13 abas; hash inalterado; zero macro ou vínculo executado. |
| AC-012 | TR | 106 principais, 97 da cópia não acrescentadas, 14 divergências sinalizadas. |
| AC-013 | TR | `Data Resolução` (AG) capturada fora da tabela; derivados só para reconciliação. |
| AC-014 | TR | 70 resoluções e 16 eventos, mesmo distantes do início. |
| AC-015 | TR | 333 / 281 / 52; 323 é outro denominador. |
| AC-016 | T · TR | 180 minutos. |
| AC-017 | T · TR | 273 minutos; nunca 270. |
| AC-018 | TR | 33.693 min = 561h33 brutas, rotuladas como não homologadas. |
| AC-019 | T · TR | Incompletos preservados e fora dos confirmados. |
| AC-020 | T | Serial 60 recusado; sem deslocamento por UTC. |
| AC-021 | T | 7h30 → faltam 30 min, excedente zero. |
| AC-022 | T | 8h15 → excede 15 min, sem truncar nem transferir saldo. |
| AC-023 | T | Férias, jornada parcial 240, futuros não são atraso. |
| AC-024 | T | 120 no dia; nenhum ticket recebe 120. |
| AC-025 | T | 75+45=120 aceito; 75+60 rejeitado. |
| AC-026 | T | Referência provisória completada sem duplicar. |
| AC-027 | T · TR | Linhas 155/176/194 preservadas; C194 sugere sem escolher. |
| AC-028 | T | Só esforço detalhado soma; snapshots ficam à parte. |
| AC-029 | T | `reported_posted`; nunca `verified_by_cs3`. |
| AC-030 | T | Cancelado sai do total, permanece no histórico com auditoria. |
| AC-031 | T · TR | Grupo pessoal com dois candidatos; tickets não fundidos. |
| AC-032 | T · TR | Namespaces distintos; nenhum ticket fictício. |
| AC-033 | T | Normaliza para comparar, preserva o bruto. |
| AC-034 | T | Reordenação não cria horas. |
| AC-035 | T · TR | Os 4 pares viram pendência; nada excluído nem homologado. |
| AC-036 | T | Correção de duração é alteração do mesmo registro. |
| AC-037 | T | S=B mantém local; A e S divergindo de B é conflito. |
| AC-038 | T | Prévia invalidada por mudança de revisão-base ou de hash. |
| AC-039 | **N** | Associação explícita de cópia renomeada **não implementada**. Ver secção 7.1. |
| AC-040 | TR | A286/E286 mantêm data e 270 min; agrupamentos recalculados. |
| AC-041 | T · TR | F guardada como consulta calculada; nenhum evento histórico criado. |
| AC-042 | T · TR | Nenhum acesso externo; proveniência e pendência registradas. |
| AC-043 | TR | 11 casos sem registro, sem data fabricada. |
| AC-044 | T · TR | Sete normalizados; zero do indicador não é fonte confiável. |
| AC-045 | T | Intervalo negativo e data futura excluídos, com contagem informada. |
| AC-046 | T | Manual prevalece; divergência vira aviso. |
| AC-047 | T | Histórico sem evidência vai para Sem classificação; nunca retroclassificado. |
| AC-048 | T | EXTRABASELINE vai para revisão, não AMS. |
| AC-049 | T | As cinco classes e as células fecham; desvio é mostrado, não escondido. |
| AC-050 | T | Nenhum apontamento criado por tarefa, follow-up ou desenvolvimento. |
| AC-051 | I | `ruleStatus=unconfirmed`, aviso na tela, sem encerramento automático. Sem teste automático. |
| AC-052 | T | Resultado vazio é desconhecido, não “sem resposta”. |
| AC-053 | T · TR | 8 registros, 1 sem data, nenhuma hora gerada. |
| AC-054 | **C** | Arquitetura evita `workbook/createSession` (documentado). Fluxo real não executado. |
| AC-055 | **C** | Escopo mínimo declarado e usado no código; **não comprovado em execução**. |
| AC-056 | **C** | Alternativas e alcance real de `Files.Read` explicados na tela; consentimento não exercido. |
| AC-057 | T (simulado) | Base de uma conta recusada por outra. Real não testado. |
| AC-058 | T | Texto escapado; exportação neutraliza fórmula. |
| AC-059 | T + verificação | Nenhum CSV/XLSM/token/registro real no `dist/`, no código ou nos logs. Ver secção 9. |
| AC-060 | T | Erro compreensível antes de gravar; nenhuma base parcial. |
| AC-061 | T (simulado) | 100 disputas: 1 vencedor, nenhum recibo perdido. Real não testado. |
| AC-062 | T (simulado) | Revisão anterior continua ativa; nada parcial no dashboard. |
| AC-063 | T (simulado) | Recibo consultado; sem duplicar; “incerto” quando não confirma. |
| AC-064 | T (simulado) | Uma identidade de base; sem `state-head` renomeado. |
| AC-065 | T (simulado) | Recuperação em vez de base vazia. |
| AC-066 | T (simulado, parcial) | Cota testada; **throttling 429 implementado sem teste**. |
| AC-067 | T (simulado) | Revisão nova consistente; anterior preservada. |
| AC-068 | **N** parcial | Prévia invalidada por hash (testado); **releitura com retentativa limitada não implementada**. Ver secção 7.2. |
| AC-069 | T | HEX corretos; texto escuro em azul/menta; sem paleta alternativa. |
| AC-070 | T | Fallback declarado; nenhuma fonte incluída sem licença. |
| AC-071 | T (navegador) parcial | Foco, rótulos, alternativa tabular e ausência de corte verificados. **Leitor de tela e zoom 200 % não testados**. |
| AC-072 | T | “Zero confirmado” distinto de “fonte não importada”; estados de erro implementados. |
| AC-073 | **C** | **Nada foi conectado nem publicado.** Nenhuma alegação de integração é feita. |
| AC-074 | TR | Hashes finais idênticos; fontes reais não reescritas. |

**Contagem:** 52 casos com teste automático ou com os insumos reais; 3
implementados sem teste automático ou com teste parcial; 5 dependentes de
configuração real; 2 não implementados (AC-039 e a parte pendente do AC-068);
os demais cobertos parcialmente conforme a coluna.

### Gates obrigatórios (secção 21)

| Gate | Situação |
|---|---|
| Preservação de esforço | **Atendido** (testado, inclusive com o arquivo real). |
| Reimportação idempotente | **Atendido**. |
| Conciliação de identidades compostas | **Atendido**. |
| Separação de dados oficiais e pessoais | **Atendido**. |
| Read-only do XLSM | **Atendido** (hash idêntico antes e depois). |
| Dois dispositivos sem perda | **Atendido contra Graph simulado**; falta a conta real. |
| Permissão e conta corretas | **Não comprovado** — depende de execução real. |
| Recuperação comprovada | **Atendido contra Graph simulado**; falta a conta real. |
| Ausência de dados reais no build | **Atendido** (verificação na secção 9). |
| Usabilidade e acessibilidade | **Parcialmente atendido** — falta leitor de tela, zoom 200 % e outros navegadores. |
| Conexão real antes de alegar publicação | **Nenhuma alegação foi feita.** |

---

## 9. Privacidade do build

Verificação executada sobre `dist/`, `src/` e os arquivos versionados:

- nenhum `.xlsm`, `.xlsx` ou `.csv` rastreado pelo git;
- nenhum identificador real de chamado no código, nos exemplos ou no bundle —
  os que existiam em comentários e na suíte automática foram substituídos pela
  faixa sintética `9xxxxxxx`;
- os hashes dos insumos aparecem **apenas** nos contratos da especificação
  (`especificacao/contratos/`), que são o contrato do projeto, e nos testes
  restritos;
- os insumos privados nunca entraram no repositório; `.gitignore` cobre
  `insumos_privados/`, `**/*.xlsm`, `**/*.xlsx`, `exports/`, `recovery/` e `.env`;
- as capturas em `docs/evidencias/` usam exclusivamente o modo demonstrativo.

> **Ponto que precisa da sua decisão.** A pasta `especificacao/` foi versionada
> por conter os contratos que o código consome (tokens, perfil, baseline,
> critérios de aceite). Esses documentos citam números de chamado reais nas
> evidências da secção 10.6. Se o repositório `mr4ndre4tt4/tissa_hub` for
> público ou vier a ser, **essa pasta deve sair do controle de versão**. Diga se
> devo removê-la e manter apenas os contratos estritamente necessários ao build.

---

## 10. Como verificar tudo

```bash
npm install
npm test                    # 218 testes sintéticos
npx tsc -b                  # tipagem
npm run build               # build de produção

# Interface, com navegador real:
npx vite preview --port 4173 --strictPort &
npm run verificar:interface

# Baseline e testes com os insumos reais — só em ambiente autorizado:
npm run baseline -- "/caminho/central_chamados_produtividade_aprimorado (1).xlsm"
CENTRAL_XLSM="…" CENTRAL_CSV_INC="…" CENTRAL_CSV_REQ="…" npm run test:restrito
```

---

## 11. O que precisa de você para seguir

1. **Client ID e redirect URI** de um registro de aplicativo Microsoft que
   aceite conta pessoal — sem isso a prova técnica da secção 16.5 não roda e a
   integração continua desativada.
2. **Autorização para publicar** e a definição da hospedagem HTTPS.
3. **Decisão sobre a pasta `especificacao/`** no repositório (secção 9).
4. **Fuso das extrações CS3** e a **data inicial de controle**.
5. **Regra de follow-up**: três cobranças para IR ou duas? A planilha diverge de
   si mesma e nenhuma das duas foi assumida.
6. **Licença e arquivo da Magnetik**, se a fonte deve ser aplicada.

Nada disso foi inventado, e nenhum campo de credencial está preenchido com
exemplo que aparente ser real.

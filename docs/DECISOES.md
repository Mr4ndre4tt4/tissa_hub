# Decisões de arquitetura

Registro das escolhas que fogem do óbvio, com a razão e a alternativa
descartada. Todas seguem a especificação v4.0; onde ela deixou margem, a escolha
está justificada aqui.

---

## 1. Leitor OOXML próprio, em vez do SheetJS

**Decisão.** `src/domain/sources/{zip,xml,ooxml,xlsm}.ts` implementam a leitura
do XLSM diretamente sobre o pacote OOXML, usando `fflate` apenas para inflar
cada entrada do ZIP.

**Por quê.** A especificação (secção 14.1) prefere o SheetJS CE “desde que
preserve valores brutos, fórmulas e valores salvos exigidos pelo perfil” e
autoriza, em caso contrário, “complementar com leitura OOXML segura ou escolher
alternativa documentada, mantendo o contrato”. Três exigências do perfil pesaram:

1. **Contrato por célula.** A secção 10.4 exige, ao mesmo tempo, a fórmula, o
   valor bruto, o valor salvo e a natureza (literal, calculada, erro) de cada
   célula — e o tipo do erro (`#REF!`, `#VALUE!`) preservado, não descartado.
   Precisamos desse quarteto simultâneo, com controle total sobre o que é
   guardado.
2. **Limites de segurança próprios.** A secção 17 fixa 20 MiB por arquivo,
   150 MiB descomprimidos e 1 milhão de células examinadas, e exige validar o
   ZIP contra caminhos maliciosos, entrada duplicada e expansão excessiva —
   **antes** de interpretar. Esses limites precisam ser aplicados por nós, no
   momento certo, com mensagem compreensível.
3. **Procedência da dependência.** A especificação manda “não depender do pacote
   instalado sem verificar sua origem/versão”. O pacote `xlsx` publicado no
   registro npm está desatualizado em relação à distribuição oficial do SheetJS
   CE, que hoje é servida pelo CDN do próprio projeto. Trazer uma versão antiga
   do registro contrariaria a instrução; puxar do CDN acrescentaria uma
   dependência de rede fora do lockfile.

**Alternativa descartada.** Usar `xlsx@0.18.5` do registro npm. Descartada pelos
três motivos acima.

**O que o leitor não faz, por construção.** Não avalia fórmula (não existe motor
de avaliação no código), não executa VBA (o `vbaProject.bin` é apenas detectado
pela presença), não abre vínculo externo, DDE, conexão ou URL, e não escreve no
arquivo de origem. O varredor de XML decodifica somente as cinco entidades
predefinidas e referências numéricas: entidades personalizadas voltam literais,
o que elimina expansão de entidade e XXE por construção.

**Custo assumido.** Suportamos o subconjunto de OOXML que este perfil precisa:
`sharedStrings`, `styles` (só para saber o que é data), definições de tabela,
sistema de datas 1900/1904, células literais, com fórmula, com erro e com texto
em linha. Um arquivo com layout realmente diferente exige novo perfil — que é
exatamente o que a secção 10.2 determina.

**Prova.** As 28 conferências do baseline batem com o contrato no arquivo real,
e o SHA-256 do original é idêntico antes e depois da leitura.

---

## 2. Aritmética de datas sem `Date`

**Decisão.** `src/domain/time/datas.ts` converte entre data civil e dias desde a
época com o algoritmo de Howard Hinnant, sobre componentes Y/M/D.

**Por quê.** A secção 6.1 proíbe “converter datas civis em UTC e depois deslocar
um dia”. Qualquer uso de `new Date('2026-09-04')` introduz fuso e o risco exato
que a especificação quer eliminar. Sem `Date`, o deslocamento é impossível por
construção — e o teste percorre todas as datas do período do baseline
confirmando ida e volta estável.

O serial 60 do sistema 1900 (29/02/1900, data que nunca existiu) é **recusado**
com motivo próprio, em vez de virar uma data histórica por suposição.

---

## 3. Duração: recusar em vez de arredondar

**Decisão.** `fracaoDeDiaParaMinutos` só aceita um valor cuja conversão caia a
menos de 1e-6 minuto de um inteiro. Fora disso devolve `segundos_reais` como
pendência.

**Por quê.** A secção 6.1 diz que, se a conversão indicar segundos realmente
existentes, é preciso “solicitar regra explícita; não arredondar silenciosamente
o trabalho”. O epsilon absorve ruído de ponto flutuante (0,18958333333333333 ×
1440 = 273,0000000000000x) sem absorver 10 segundos de trabalho real.

---

## 4. Identidade dos apontamentos: chave estável + multiplicidade

**Decisão.** A chave de identidade é `data | referência | descrição | tipo de
atuação`, **sem a duração**. O casamento entre carga e base é por grupo de chave
e por ordinal dentro do grupo.

**Por quê.** Três exigências que se contradizem se resolvidas de forma ingênua
(secção 8.4):

- reordenar linhas não pode criar eventos → a linha não pode ser chave;
- dois eventos iguais não viram um → a chave não pode ser única por conteúdo,
  daí o ordinal;
- duração corrigida é **alteração**, não atividade nova → a duração precisa
  ficar fora da chave.

Quando há mais de um registro equivalente dos dois lados e o conteúdo diverge, a
correspondência por ordinal deixa de ser segura e o caso vira **confirmação
manual**, em vez de uma escolha automática.

---

## 5. Revisões imutáveis com um ponteiro condicionado

**Decisão.** Cada mutação grava um documento de estado completo, com nome único,
e publica trocando a `description` da pasta `state-head` por `PATCH` com
`If-Match`.

**Por quê.** A secção 16.1 fixa esta decisão e é explícita: “a combinação em um
protocolo de commit é decisão deste projeto, não um recurso transacional
anunciado pela Microsoft”. O ponteiro carrega apenas schema, workspace, ID da
revisão, ID do arquivo e hash — nunca texto de chamado — e é validado contra o
limite de 768 caracteres.

**Consequências que o código respeita.**

- Concluir o upload **não** publica estado: o ponteiro só muda depois de os
  bytes serem relidos e o SHA-256 conferido.
- `PATCH` sem `If-Match` é recusado pelo próprio contrato, nas duas
  implementações.
- Um 412 devolve **conflito com a revisão atual**, não uma nova tentativa cega.
- Uma revisão que fere invariantes nunca chega a ser enviada.
- A criação de pastas usa `conflictBehavior: fail`; a disputa é resolvida
  **lendo a pasta existente**, jamais com `rename`, que produziria bases
  paralelas.

**Limite conhecido.** Tudo isso foi provado contra um Graph simulado. A prova
técnica bloqueante da secção 16.5 — na conta real, com escopo aprovado — **não
foi executada**, porque a configuração pública não existe. Enquanto não rodar, a
integração permanece não confirmada.

---

## 6. `contain: paint` no contêiner de tabela

**Decisão.** `.rolagem-tabela` declara `overflow-x: auto` **e** `contain: paint`.

**Por quê.** Uma verificação com navegador real mostrou o corpo rolando 731 px
na horizontal a 390 px de largura, na tela de Chamados. O diagnóstico
descartou `<caption>`, cabeçalho `sticky` e a cadeia de contêineres: o layout já
estava correto (o contêiner media 306 px), mas o navegador somava a largura da
tabela rolável à área de rolagem do documento. `contain: paint` declara o que já
é verdade — nada dentro do contêiner pinta fora dele — e o corpo deixa de rolar,
sem esconder conteúdo.

Junto com isso, `min-width: 0` nos itens de grade corrige a causa mais comum do
mesmo sintoma: itens de grade têm `min-width: auto` e por isso uma tabela larga
estica a faixa inteira.

Ambos foram verificados em 360, 390, 768, 1.280 e 1.440 px, com a tabela larga
continuando a rolar dentro do próprio contêiner.

---

## 7. Modo demonstrativo separado do estado real

**Decisão.** O `ProvedorApp` tem três modos e a mutação declara o resultado em
vez de assumir sucesso. Sem conexão, a mensagem é “alterado apenas nesta sessão
do navegador”; a string “Salvo no OneDrive” só aparece depois que o recibo da
operação é lido de volta da revisão ativa.

**Por quê.** Secções 1 e 16.2: “Não afirmar ‘salvo no OneDrive’ se houve somente
alteração no navegador” e “Só então apresentar ‘Salvo no OneDrive’”. Os dados
demonstrativos usam a faixa `9xxxxxxx` e um marcador textual, e nunca se
misturam a uma base real.

---

## 8. Sem persistência local de dados de trabalho

**Decisão.** Nenhum dado de trabalho vai para `localStorage`, IndexedDB ou cache
de Service Worker. O cache do MSAL é de memória, com apenas o estado transitório
do redirecionamento em `sessionStorage`.

**Por quê.** Secção 17. Formulários em edição ficam em memória: se a renovação
silenciosa falhar, pedimos reautenticação **sem** perder o que está na tela e
**sem** afirmar salvamento.

---

## 9. CSP restritiva e nenhum recurso externo

**Decisão.** `index.html` declara CSP com `default-src 'self'`, `object-src
'none'`, `base-uri 'none'` e `form-action 'none'`; `connect-src` libera apenas
os domínios do Graph e do login Microsoft. O favicon é um SVG embutido.

**Por quê.** Secção 17: HTTPS, CSP restritiva, texto importado escapado,
dependências verificadas, nenhum rastreador. Nenhuma fonte é baixada de origem
externa — a Magnetik não foi fornecida e o fallback do sistema está declarado.


---

## 10. Especificação fora do controle de versão

**Decisão.** `especificacao/` está no `.gitignore`. Os contratos versionados
ficam em `contratos/` e contêm apenas tokens visuais, fixtures sintéticas e o
esquema de configuração pública.

**Por quê.** O repositório é público. O documento mestre e o arquivo de
interpretação da planilha citam números de chamado reais; o baseline e o perfil
descrevem o volume de trabalho da pessoa e trazem os hashes dos insumos. A
secção 2.2 da especificação é explícita: “o pacote não deve ser publicado ou
anexado a um ambiente de desenvolvimento sem autorização adequada”.

**Consequência prática.** O script de baseline e a suíte restrita carregam
`baseline_xlsm.json` e `manifesto_fontes.json` em tempo de execução, pelo
caminho em `CENTRAL_CONTRATOS` (padrão `especificacao/contratos`), em vez de
importá-los estaticamente. Assim o projeto compila e os testes sintéticos rodam
sem o pacote presente, e a conferência com o arquivo real continua possível no
ambiente autorizado.


---

## 11. Armazenamento do cache de autenticação

**Decisão.** `cacheLocation: 'memoryStorage'` com `storeAuthStateInCookie: true`
e `secureCookies: true`.

**Por quê.** A secção 15.1 pede cache "preferindo memória e apenas estado
transitório necessário ao redirecionamento". A primeira tentativa foi memória
com `storeAuthStateInCookie: false`, e o MSAL **recusa** essa combinação no
fluxo de redirecionamento, com `in_mem_redirect_unavailable`: nada sobreviveria
à volta do login para processar a resposta. `temporaryCacheLocation:
'sessionStorage'` não satisfaz a verificação — o MSAL exige o cookie.

A combinação adotada mantém a intenção da especificação:

- os **tokens** ficam apenas em memória, somem ao fechar a página e nunca vão
  para `localStorage` nem são serializados em JSON do OneDrive ou log;
- somente o **estado transitório do redirecionamento** — state, nonce e
  verificador PKCE — fica num cookie de vida curta, restrito a HTTPS. É
  literalmente o "estado transitório necessário ao redirecionamento" que a
  secção 15.1 admite. Esse cookie trafega para a hospedagem estática, que já
  serve o próprio código da página: não amplia o que ela poderia observar.

**Alternativa descartada.** `cacheLocation: 'sessionStorage'` funcionaria e
sobreviveria a um recarregamento, mas colocaria os tokens fora da memória — mais
distante do que a especificação pede. Fica registrada como troca possível caso
a reautenticação a cada recarregamento se mostre incômoda no uso diário.

**Consequência aceita.** Recarregar a página encerra a sessão e exige entrar de
novo. Como a sessão da Microsoft permanece no navegador, normalmente é um
redirecionamento rápido, sem digitar senha. A secção 15.1 já prevê pedir
reautenticação sem perder o formulário em memória.

**Trava de regressão.** `tests/erros-autenticacao.test.ts` verifica a
configuração montada: cache em memória obriga cookie de estado, o cookie é
restrito a HTTPS, nada vai para `localStorage`, não há client secret e o
registro de dado pessoal está desligado. A configuração é exportada justamente
para poder ser testada — uma combinação inválida só apareceria no navegador, no
meio do login.

---

## 12. `explicar()` não pode esconder o código AADSTS

**Decisão.** `explicar()` (`src/app/estado.tsx`) monta o rodapé do erro a
partir de `errorCode` **e** `subError`, e procura um `AADSTS\d+` tanto em
`errorMessage` quanto em `.message` antes de descartar o detalhe.

**Por quê.** Depois de corrigir a decisão 11, uma tentativa real de login
devolveu `server_error` sem detalhe algum na tela — só o código. A causa: para
esse código, o MSAL frequentemente entrega `errorMessage` vazio e põe o texto
completo (com o `AADSTS…` que identifica a causa exata) apenas em `.message`.
A função só olhava `errorMessage`, então a informação que a pessoa precisava
para diagnosticar — e relatar — ficava presa dentro da exceção.

`server_error` também ganhou entrada própria em `CAUSAS_MSAL`: a causa mais
comum é o redirect URI estar cadastrado na plataforma "Web" do registro do
aplicativo, além de (ou em vez de) "Single-page application" — o que a
Microsoft recusa com `AADSTS9002326` ("Cross-origin token redemption is
permitted only for the 'Single-Page Application' client-type").

**O que não mudou.** O armazenamento do cache (decisão 11) continua
`memoryStorage` + cookie: `server_error` acontece depois da volta do
redirecionamento, na troca do código por token — não é o mesmo problema que
`in_mem_redirect_unavailable` resolveu, e nada indica que trocar para
`sessionStorage` mudaria este resultado.

**Trava de regressão.** `tests/erros-autenticacao.test.ts` reproduz um erro com
`errorCode: 'server_error'`, `errorMessage` vazio e o código AADSTS apenas em
`.message`, e confere que ele aparece na mensagem final — junto com o
subcódigo, quando presente, e mesmo para um `errorCode` sem causa conhecida no
mapa.

---

## 13. Erros do Graph identificam qual chamada falhou

**Decisão.** `GraphReal.requisitar()` (`src/adapters/graph/graphReal.ts`)
monta o detalhe do `ErroGraph` como `MÉTODO caminho → status mensagem`, em vez
de só repassar a mensagem que a Microsoft devolveu no corpo. `explicar()`
ganhou um caso próprio para `nao_encontrado` (404).

**Por quê.** O login passou a funcionar (decisões 11 e 12 resolveram os dois
defeitos anteriores) e a primeira tentativa real contra o Graph devolveu
apenas **"Item not found"** na tela — a mensagem crua de um 404 da Microsoft,
sem dizer qual das seis ou sete chamadas de `RepositorioOneDrive.inicializar()`
falhou (`approot`, `criarPasta` de cada pasta, `obterItem`…). Sem o caminho,
"Item not found" é praticamente inútil para diagnosticar: pode ser a pasta do
aplicativo, o ponteiro, uma revisão. Como o Microsoft Graph reaproveita a mesma
mensagem genérica para itens diferentes, o texto sozinho não distingue os
casos.

**Consequência para dados privados.** O caminho é estrutural (`/me/drive/...`,
nomes de pasta fixos como `state-head`) — nunca contém texto de chamado nem
identificador de trabalho, então pode aparecer na tela e em teste sem violar
a secção 17.

**Trava de regressão.** `tests/graphReal.test.ts` verifica que um 404 em
`obterItem()` chega com método, caminho, status e mensagem no `ErroGraph`, e
que um erro numa escrita (`criarPasta`) mostra `POST`, não sempre `GET`.
`tests/erros-autenticacao.test.ts` verifica que `explicar()` traduz
`nao_encontrado` preservando o detalhe original.

---

## 14. `approot()` provisiona a pasta do aplicativo antes de lê-la

**Decisão.** `GraphReal.approot()` (`src/adapters/graph/graphReal.ts`) tenta o
`GET .../special/approot` normalmente; se vier 404, escreve um marcador vazio
em `.../special/approot:/.provisionamento:/content` (uma escrita endereçada
pelo caminho) e só então relê. Um 409 nessa escrita — outra sessão provisionou
primeiro — é absorvido; qualquer outro erro é propagado.

**Por quê.** O caminho técnico exposto pela decisão 13 permitiu confirmar a
causa raiz do 404 relatado: o detalhe chegou como `GET
/me/drive/special/approot → 404 Item not found`, com a pessoa confirmando que
(a) a tela de consentimento da Microsoft **não** apareceu nessa tentativa — o
escopo já estava concedido de uma tentativa anterior — e (b) o OneDrive normal
dessa conta funciona fora do aplicativo. As duas coisas descartam falta de
consentimento e conta sem OneDrive. O que resta é um comportamento documentado
da Microsoft para pastas especiais: diferente de contas corporativas, o
OneDrive pessoal **não cria a pasta especial numa leitura** — só depois de uma
escrita endereçada pelo caminho (`.../special/approot:/algo:/content` ou
`.../special/approot:/children`), a pasta passa a existir e a responder ao
`GET`.

**Por que uma pasta-marcador, e não a primeira pasta real (`state-head`).**
`GraphReal` é a camada de transporte; não deveria saber o nome das pastas que
`RepositorioOneDrive` decide criar (secção 4, `cliente.ts`: "a interface é
mínima de propósito"). O marcador mantém a separação — `approot()` continua
podendo ser chamado sem nenhum conhecimento do protocolo de revisões por cima
dele — ao custo de uma escrita a mais, feita uma única vez por conta (nas
chamadas seguintes o `GET` já funciona).

**Consequência aceita.** A primeira conexão de cada conta cria uma pasta
`.provisionamento` vazia dentro da pasta do aplicativo, que nunca é lida de
volta e não aparece na estrutura documentada (secção 3 de `OPERACAO.md`). Não
é removida porque o contrato do Graph (`ClienteGraph`) não inclui exclusão —
adicioná-la só para isto ampliaria a interface por um caso único.

**Ainda em aberto.** Só `approot()` foi exercitado contra a conta real. O
restante do protocolo — gravar e reler uma revisão com verificação de SHA-256,
publicar o ponteiro com `If-Match`, um 412 de conflito real — continua sem
confirmação. A prova técnica bloqueante da secção 16.5 permanece pendente.

**Trava de regressão.** `tests/graphReal.test.ts` cobre as quatro
combinações: pasta já existe (nenhuma escrita), 404 seguido de provisionamento
bem-sucedido, 404 seguido de 409 (outra sessão venceu, segue normalmente), e
404 seguido de um erro real no marcador (propagado, não engolido).

**Duas correções sucessivas — ver decisão 15.** A primeira tentativa de
provisionar (`PUT special/approot:/.provisionamento:/content`, endereçamento
por caminho) devolveu 404 contra a conta real — e continuou devolvendo 404
mesmo depois do consentimento único e mais amplo da decisão 15
(`Files.ReadWrite`, todo o OneDrive), o que descarta escopo como a causa desta
falha específica. O que sobra é a forma do endereçamento: um caminho com
dois-pontos precisa **resolver** `special/approot` como um item já existente
antes de aplicar o resto do caminho — não há o que resolver numa pasta que
nunca existiu. A implementação atual usa, em vez disso, o endpoint que a
documentação da Microsoft cita explicitamente para este caso —
`POST /drive/special/approot/children`, sem dois-pontos — que trata o alias
como referência de pai para criação de filho, não como caminho a resolver.

Fica em aberto se essa troca de endpoint, sozinha, já teria bastado com
`Files.ReadWrite.AppFolder` — sem precisar do consentimento amplo da decisão
15. O relato confirmado (issue #682) foi sobre `GET`, não sobre este `POST`
endereçado pelo alias. A tela de bloqueio da decisão 15 continua no lugar como
rede de segurança; o próximo relato contra a conta real vai dizer se ela ainda
chega a aparecer.

---

## 15. Consentimento único e mais amplo só para destravar a pasta do aplicativo

**Decisão.** Quando `inicializar()` falha com 404 em `special/approot` mesmo
depois do provisionamento (decisão 14), o aplicativo entra no modo
`bloqueio_pasta_app` e oferece um botão explícito — nunca automático — para
pedir `Files.ReadWrite` (acesso a todo o OneDrive) **uma única vez**. O token
dessa troca específica cria a pasta; o dia a dia volta a pedir só
`Files.ReadWrite.AppFolder` depois disso.

**Por quê.** Não é bug deste projeto: para a leitura simples (`GET
special/approot`), há um relato confirmado e sem resolução permanente
publicada pela Microsoft em
[OneDrive/onedrive-api-docs#682](https://github.com/OneDrive/onedrive-api-docs/issues/682)
de que a mesma chamada falha com 404 usando só `Files.ReadWrite.AppFolder` e
funciona com `Files.ReadWrite.All`. O workaround documentado ali — "pedir
acesso total a cada novo usuário uma vez, depois soltar" — é o que este modo
implementa, com uma diferença: aqui é uma **decisão explícita da pessoa**, não
algo pedido a todo usuário silenciosamente.

**O que ainda não está separado.** A tentativa de provisionar por escrita
(decisão 14) falhou tanto com escopo restrito quanto — depois deste modo
existir — com o escopo amplo, mas usando um endereçamento por caminho que a
decisão 14 identificou depois como provavelmente errado em si (não resolve um
item que nunca existiu, com escopo nenhum). A troca para o endpoint
`POST .../special/approot/children` (decisão 14) pode ser suficiente sozinha,
sem este consentimento amplo. Esta tela continua no lugar como rede de
segurança até o próximo relato confirmar se ainda chega a aparecer.

**Por que isto contraria, e depois volta a respeitar, a secção 15.1.** A
especificação pede escopo inicial `Files.ReadWrite.AppFolder` e "não amplie".
Ampliar por decisão própria do código, sem perguntar, teria contrariado essa
regra diretamente. Por isso a ampliação:

- nunca é automática — existe uma tela própria (`bloqueio_pasta_app` em
  `estado.tsx` e `BloqueioPastaApp` em `App.tsx`) que explica a limitação, cita
  a fonte, e só age depois de um clique;
- é **transitória no código**: `consentirProvisionamentoUnico()` nunca
  adiciona `Files.ReadWrite` a `escoposConsentidos` — nenhuma chamada
  posterior do aplicativo volta a pedir esse escopo;
- é **honesta sobre o limite real**: o texto da tela avisa que o consentimento
  concedido à Microsoft continua registrado do lado deles até a própria pessoa
  revogá-lo em `account.microsoft.com/consent` — parar de pedir o escopo no
  código não apaga a concessão já dada.

**Como o retorno é identificado.** `Identidade.iniciar()` processa o retorno
de qualquer redirecionamento (login normal ou este consentimento único) pelo
mesmo `handleRedirectPromise()`. Como nenhum outro fluxo deste aplicativo pede
exatamente `Files.ReadWrite` (sem o sufixo `.AppFolder`), a presença desse
escopo na resposta identifica o retorno sem ambiguidade — `iniciar()` passa a
devolver `{ conta, tokenProvisionamentoUnico }`, e o token dessa troca
específica é usado só para a chamada de criação da pasta, nunca guardado.

**Consequência para a prova técnica da secção 16.5.** Só a criação da pasta
foi confirmada contra a conta real. O restante do protocolo continua pendente.

**Trava de regressão (na época).** `tests/erros-autenticacao.test.ts`
conferia que `ESCOPO_PROVISIONAMENTO_UNICO` (`Files.ReadWrite`) não coincidia,
por igualdade exata, com nenhum outro escopo do aplicativo — a mesma
comparação que `iniciar()` usava para reconhecer o retorno.

**Superada pela decisão 19.** O consentimento único resolvia o acesso, mas não
o problema: mesmo com `Files.ReadWrite` de todo o OneDrive, `special/approot`
continuou recusando toda tentativa. A decisão 19 substitui completamente este
mecanismo — `Files.ReadWrite` passa a ser o escopo principal, pedido desde o
primeiro login, e `ESCOPO_PROVISIONAMENTO_UNICO`,
`consentirProvisionamentoUnico()`, o modo `bloqueio_pasta_app` e a tela
`BloqueioPastaApp` foram removidos do código.

---

## 16. `explicar()` não pode descartar o detalhe também no caso `transporte`

**Decisão.** O caso `'transporte'` de `explicar()` passa a incluir
`e.message`, como os demais casos que carregam detalhe técnico.

**Por quê.** `'transporte'` é o balde genérico de `traduzirStatus()`
(`graphReal.ts`) para **qualquer** status HTTP que não caiu em nenhum dos
outros códigos — não só falha real de rede. A tentativa seguinte de criar a
pasta do aplicativo (decisão 14) devolveu essa mensagem genérica sem detalhe
nenhum, escondendo justamente o que era preciso ver para saber se o novo
`POST .../special/approot/children` (decisão 14) tinha sido rejeitado por
outro motivo (por exemplo, nome de item começando com ponto) — o mesmo tipo de
erro corrigido para `'nao_encontrado'` na decisão 13, mas esquecido aqui.

**Trava de regressão.** `tests/erros-autenticacao.test.ts` cobre as duas
origens de `'transporte'`: um status HTTP não classificado (detalhe com
método, caminho e status) e uma falha real de `fetch()` (detalhe começando com
"A conexão falhou:") — as duas precisam aparecer na mensagem final.

---

## 17. Marcador de provisionamento sem ponto inicial, e erro com `code` + `innerError`

**Decisão.** O nome do marcador de provisionamento (decisão 14) muda de
`.provisionamento` para `provisionamento-inicial`, sem ponto no início.
`GraphReal.requisitar()` passa a incluir, quando presentes, `error.code`,
`error.innerError.code`, `error.innerError.message` e o cabeçalho
`request-id` da resposta — não só `error.message`.

**Por quê.** Com a correção da decisão 16, o próprio
`POST .../special/approot/children` (decisão 14) devolveu, contra a conta
real e já com o consentimento amplo da decisão 15, `400 Invalid request` —
sem mais detalhe. Essa mensagem rasa não chega a dizer qual parte do corpo foi
rejeitada. A diferença mais concreta entre o corpo enviado e os exemplos
documentados de criação de item (`driveItem: post children`) é o nome do
marcador começar com ponto — não confirmado como a causa, mas é a hipótese
mais barata de testar, e não tem custo (o nome do marcador é só um detalhe de
implementação, nunca lido de volta).

**Por que não parar de investigar aqui.** Duas hipóteses de forma de chamada já
foram tentadas e falharam contra a conta real (decisão 14: caminho com
dois-pontos, 404; decisão 14: alias sem dois-pontos com nome de ponto, 400).
Se esta tentativa falhar de novo, a pesquisa por documentação — que já errou
duas vezes o suficiente para a conta real recusar a chamada — deixa de ser
confiável o bastante para mais uma tentativa às cegas. O próximo passo, se
necessário, é testar a chamada diretamente no Graph Explorer
(`developer.microsoft.com/graph/graph-explorer`) com a conta real, para ver a
resposta completa em vez de inferir de exemplos genéricos.

**Trava de regressão.** `tests/graphReal.test.ts` confere que o corpo do
marcador não começa com ponto, e que `error.code`, `innerError.code`,
`innerError.message` e `request-id` aparecem todos na mensagem final quando
presentes na resposta.

---

## 18. `approot()` para de tentar escrever; toca o drive padrão e tenta de novo

**Decisão.** Diante de 404 na primeira leitura de `special/approot`,
`GraphReal.approot()` não tenta mais nenhuma escrita. Em vez disso, faz um
`GET /me/drive` (o drive padrão, não a pasta especial) e relê `special/approot`
— com até duas retentativas curtas, só se a releitura vier `503`.

**Por quê — o que foi eliminado, com prova.** As duas tentativas de escrita
da decisão 14 e 17 foram verificadas diretamente contra a conta real e contra
o Graph Explorer, e as duas estão descartadas:

1. `PUT special/approot:/nome:/content` (escrita endereçada por caminho) — 404
   contra a conta real, com escopo restrito e com escopo `Files.ReadWrite`
   amplo. O caminho por dois-pontos precisa resolver `special/approot` como
   item já existente; não há o que resolver numa pasta que nunca existiu.
2. `POST special/approot/children` (criação pelo alias, sem dois-pontos) —
   confirmado no Graph Explorer, com a conta real: **405 Method Not Allowed**.
   Não é um método aceito nesse endereço. A documentação que sugeria esse
   endpoint (secção 14) não corresponde ao comportamento real da API v1.0.

Também confirmado manualmente: a pasta `Apps` já existe na raiz do OneDrive da
conta, mas está **vazia** — nenhuma das tentativas anteriores criou nada. Isso
descarta qualquer teoria de que uma tentativa anterior tivesse "quase"
funcionado.

**A pista que resta.** Um relato recente no fórum oficial da Microsoft (Q&A,
["Personal OneDrive: newly consented apps get 403 accessDenied / serviceReadOnly ('Database Is Read Only') on ALL drive endpoints, while an app consented months ago works for the same user at the same moment"](https://learn.microsoft.com/en-us/answers/questions/5983388/personal-onedrive-newly-consented-apps-get-403-acc))
descreve, para contas OneDrive pessoais com aplicativo **recém-consentido**,
exatamente esta sequência: 404 no início, depois `503 serviceNotAvailable`
com mensagem "User is pending provisioning", antes de eventualmente
estabilizar. A causa apontada ali é que o caminho de consentimento por
`Files.ReadWrite.AppFolder` sozinho não dispara uma etapa de inicialização
que o backend da Microsoft precisa completar para a conta — enquanto um
escopo mais amplo (`Files.ReadWrite`) dispara essa inicialização, e ela
**persiste** depois de disparada.

**O que isto NÃO é.** Uma confirmação definitiva. O relato é de um fórum
comunitário, não da documentação oficial, e eu não consegui buscar a página
inteira (bloqueio de rede para `learn.microsoft.com` neste ambiente) — só o
resumo da busca. É tratado como a pista mais forte disponível, não como fato
estabelecido.

**Por que tocar `/me/drive` em vez de insistir em `special/approot`.** Se a
causa real for essa etapa de inicialização pendente do lado da Microsoft, o
endereço exato que a dispara pode não ser `special/approot` — nossas
tentativas de leitura E escrita nesse endereço específico, mesmo com escopo
amplo, continuaram 404. `/me/drive` é o endpoint mais básico possível do
Graph para OneDrive; tocá-lo é a tentativa mais barata de "acordar" uma
inicialização pendente antes de desistir.

**Consequência aceita.** Se a causa raiz for mesmo essa, pode não se resolver
numa única tentativa dentro do tempo de uma sessão de navegador — o relato
descreve um estado "pending" que pode levar tempo para assentar do lado da
Microsoft. As retentativas ficam limitadas a 503 e a no máximo três tentativas
com espera curta, para não travar a pessoa numa tela "conectando" por muito
tempo; um 404 persistente depois disso continua indo para o modo
`bloqueio_pasta_app` (decisão 15), e a explicação na tela continua sendo a
mais honesta disponível — inclusive sugerindo esperar e tentar de novo mais
tarde, já que parte do problema pode estar do lado da Microsoft, fora do
alcance deste código.

**Trava de regressão (na época).** `tests/graphReal.test.ts` cobria: pasta já
existe (sem chamada extra); 404 seguido de toque no drive e releitura
bem-sucedida; toque no drive que também falha, mas a releitura de approot
ainda é tentada; 503 retentado até dar certo; 503 persistente até desistir na
terceira tentativa; e um erro não transitório (403) que não é retentado.

**Superada pela decisão 19.** Mesmo com esta correção publicada, a conta real
continuou devolvendo 404 em `special/approot` — a hipótese da "inicialização
pendente" não se confirmou (ou não se resolveu no tempo testado). Um teste
direto no Graph Explorer, feito pela pessoa dona da conta, encontrou a causa
real: veja a decisão 19.

---

## 19. Pasta comum na raiz, não a pasta especial `special/approot`

**Decisão.** O aplicativo para de usar o mecanismo especial de pasta do
OneDrive (`special/approot`, autorizado por `Files.ReadWrite.AppFolder`) e
passa a usar uma pasta comum, com nome fixo (`NOME_PASTA_DO_APP =
"Central de Chamados"`, em `graphReal.ts`), criada na raiz do drive
(`root/children`) se ainda não existir. O escopo principal muda de
`Files.ReadWrite.AppFolder` para **`Files.ReadWrite`** — acesso a todo o
OneDrive —, pedido desde o primeiro login, não mais como consentimento
condicional (decisão 15, removida).

**Por quê.** Depois de quatro tentativas de fazer `special/approot` funcionar
contra a conta real — leitura simples (decisão 14), escrita por caminho
(decisão 14), criação pelo alias (decisão 17), toque no drive padrão com
retentativa (decisão 18) —, a causa raiz foi isolada com um teste direto no
**Graph Explorer**, feito pela pessoa dona da conta:

- `POST /me/drive/special/approot/children` devolveu **405 Method Not
  Allowed** — não é um método aceito nesse endereço, ponto final. A
  documentação usada nas decisões 14 e 17 não corresponde à API v1.0 real.
- `GET /me/drive/special/approot`, testado com a identidade do **próprio**
  Graph Explorer (client ID diferente do nosso app), devolveu 200 — prova de
  que a API e a conta funcionam normalmente, mas não prova nada sobre a pasta
  do *nosso* aplicativo, porque `special/approot` é uma pasta por aplicativo.
- **`POST /me/drive/root/children`** (pasta comum, endereço padrão, sem
  alias) devolveu **201 Created** — a mesma conta, a mesma sessão do Graph
  Explorer, funcionando perfeitamente para o mecanismo comum.
- Conferido manualmente no OneDrive: a pasta `Apps` existe na raiz da conta,
  mas está **vazia** — nenhuma tentativa anterior, em nenhuma decisão, chegou
  a criar nada ali.

A conclusão: o mecanismo especial `special/approot` está com problema nesta
conta especificamente — causa exata não confirmada (pode ser um bug do lado
da Microsoft, específico desta conta ou deste período), mas a pasta comum
funciona, comprovadamente, agora. Depois de tantas tentativas descartadas com
prova, insistir em `special/approot` deixou de ser um caminho razoável.

**O que isto contraria — e por que a decisão não foi minha.** A especificação
(secção 15.1) pede o escopo mínimo (`Files.ReadWrite.AppFolder`) e "não
amplie". Trocar para `Files.ReadWrite` (todo o OneDrive) contraria essa regra
diretamente e **permanentemente** — não é mais um consentimento condicional
de uso único (decisão 15, que este código substitui): é o escopo pedido em
todo login, dali em diante. Por ser uma mudança permanente no modelo de
privacidade da especificação, e não uma correção técnica dentro dela, a
decisão foi posta explicitamente para a pessoa dona da conta escolher — ela
autorizou esta troca depois de ver a prova do Graph Explorer.

**O que continua igual, apesar da permissão mais ampla.** O código só lê e
grava dentro da pasta com o nome fixo do aplicativo — nunca em outro lugar do
OneDrive. A interface (`App.tsx`, tela de entrada) e `Configuracoes.tsx`
passam a dizer isso explicitamente: a permissão técnica cobre o OneDrive
inteiro, mas o aplicativo se restringe à própria pasta por decisão do código,
não por um limite que o OAuth imponha — o mesmo padrão de honestidade já
usado para `Files.Read` (secção 15.3).

**O que foi removido.** `ESCOPO_PASTA_DO_APP` (renomeado para
`ESCOPO_PRINCIPAL`, valor `Files.ReadWrite`); `ESCOPO_PROVISIONAMENTO_UNICO`;
`Identidade.consentirProvisionamentoUnico()`; o retorno enriquecido de
`iniciar()` (`{ conta, tokenProvisionamentoUnico }`, voltou a ser só
`AccountInfo | null`); o modo `bloqueio_pasta_app`; o componente
`BloqueioPastaApp`; o campo `autorizarAcessoAmploUnico` do contexto; e todo o
mecanismo de tocar o drive padrão e retentar em 503 de `GraphReal.approot()`
(decisão 18) — não faz mais sentido depois que se descartou o mecanismo
`special/approot` inteiro, não só a forma de bootstrapá-lo.

**Por que uma pasta com nome fixo, e por que "Central de Chamados".** O nome
aparece na raiz do OneDrive da pessoa, então precisa ser reconhecível — é
literalmente o nome do aplicativo. Criação usa `conflictBehavior: fail` e o
mesmo padrão "ler, criar no 404, reler no 409" já usado para as subpastas
(`obterOuCriar` em `repositorio.ts`) — sem `rename`, para não produzir pastas
paralelas entre duas sessões inicializando ao mesmo tempo (secção 16.3).

**Consequência para a prova técnica da secção 16.5.** A criação da pasta do
aplicativo foi confirmada contra a conta real por este mecanismo. O restante
do protocolo — gravar e reler uma revisão com verificação de SHA-256,
publicar o ponteiro com `If-Match`, um 412 de conflito real — continua sem
confirmação.

**Trava de regressão.** `tests/graphReal.test.ts` cobre: leitura direta
quando a pasta já existe; 404 seguido de criação bem-sucedida pelo nome;
404 seguido de 409 (outra sessão criou primeiro, relê pelo nome); 404 seguido
de um erro real na criação (propagado, não a leitura original); e um erro
não-404 na leitura (403) que não tenta criar nada.

---

## 20. Recuperação manual: escolher a revisão, não só ver o aviso

**Decisão.** `RepositorioOneDrive.recuperarApontandoPara(itemId)` publica o
ponteiro apontando direto para uma revisão já gravada, quando a cabeça está
vazia (`RecuperacaoNecessaria`). A tela `Recuperacao` (`App.tsx`) lista as
revisões existentes e cada uma tem seu próprio botão — a pessoa escolhe qual
vira a base ativa.

**Por quê.** A criação da pasta do aplicativo (decisão 19) desbloqueou a
conexão real pela primeira vez, e a primeira conexão real caiu direto neste
caso: `RecuperacaoNecessaria` (ponteiro vazio, 1 revisão gravada) — sinal
de que `criarBase()` conseguiu gravar a revisão inicial mas não chegou a
publicar o ponteiro (a causa mais provável é a página ter recarregado no meio
do caminho, o que a decisão 11 já documenta como encerrando a sessão). A tela
de recuperação existia desde o início do projeto, mas só tinha "tentar de
novo" — que relê o mesmo ponteiro vazio e cai no mesmo aviso outra vez, sem
saída — e "sair da conta". Não havia, até agora, nenhum jeito de completar a
recuperação que a própria mensagem de erro promete ("use a recuperação para
escolher uma revisão").

**Por que não recuperar automaticamente a mais recente.** A secção 16.3 trata
recuperação como decisão deliberada da pessoa, não escolha automática do
código — o mesmo princípio que já rege `criarBase()`. Com mais de uma
revisão na pasta (histórico maior, ou duas sessões gravando por fora ao mesmo
tempo), a mais recente pelo nome do arquivo não é necessariamente a certa.

**Como o método se protege.** Mesmas garantias do resto do protocolo:
- nunca sobrescreve um ponteiro que já é válido — se outra sessão publicou
  entretanto, devolve `conflito` com a base atual, em vez de apagar por cima;
- publica com `If-Match` no `eTag` da cabeça lida no início da operação — um
  412 vira `conflito`, não repetição cega;
- confere schema e conta antes de publicar — uma revisão de outra conta
  Microsoft (AC-057) ou de uma versão de schema incompatível nunca vira a
  base ativa;
- valida invariantes antes de publicar, como qualquer outra gravação.

**O que não faz.** Não cria uma revisão nova — só republica o ponteiro para
uma que já existe. Por isso não recebe `operationId`: não há nada para tornar
idempotente além do `If-Match` que a própria chamada já usa.

**Trava de regressão.** `tests/persistencia.test.ts`, contra o Graph
simulado: recuperação bem-sucedida a partir do mesmo cenário do AC-065
(ponteiro limpo por fora, revisão preservada); recusa quando o ponteiro já é
válido (conflito, nada sobrescrito); recusa quando a revisão pertence a outra
conta.

---

## 21. `baixarConteudo()` identifica o domínio quando a rede falha

**Decisão.** `GraphReal.baixarConteudo()` inclui, na mensagem de erro, o
domínio (via `new URL(...).host`) da URL de download — nunca o caminho nem a
query string, que carregam a autenticação temporária dessa URL.

**Por quê.** Ao tentar recuperar a revisão gravada (decisão 20), a conta real
devolveu "A conexão falhou durante o download: Failed to fetch" — duas vezes
seguidas, o que descarta instabilidade passageira de rede como explicação
única. `index.html` declara uma política de segurança de conteúdo (CSP) com
`connect-src` restrito a uma lista de domínios da Microsoft, incluindo
`https://*.files.1drv.com` — mas o caractere `*` num host de CSP cobre **um**
rótulo de subdomínio, não vários. URLs de download do OneDrive pessoal
costumam ter mais de um rótulo antes de `files.1drv.com` (por exemplo,
`public.bn1305.files.1drv.com`), e não bateriam com esse padrão — o mesmo
tipo de erro sem detalhe que já apareceu várias vezes nesta investigação
(decisões 12, 13, 16, 17), agora numa camada diferente (a política de
segurança da própria página, não uma chamada ao Graph).

**Por que não ampliar a CSP às cegas.** Sem o domínio real que a conta
devolveu, ampliar a política seria adivinhar de novo — o mesmo erro que já
custou tempo nas decisões 14 e 17 (tentar consertar sem primeiro confirmar a
causa exata). A mensagem agora traz o domínio real; a política será ajustada
com esse dado, não com suposição.

**O que continua seguro.** A URL de download nunca é guardada em estado, log
ou repositório (M3) — só o `host` extraído dela, no momento do erro, aparece
na mensagem que a pessoa vê na tela.

**Trava de regressão.** `tests/graphReal.test.ts` confere que o domínio da
URL de download aparece no erro e que a query string (onde fica a
autenticação temporária) nunca aparece.

---

## 22. CSP libera `*.microsoftpersonalcontent.com`

**Decisão.** `connect-src` em `index.html` ganha
`https://*.microsoftpersonalcontent.com`.

**Por quê.** O domínio real, devolvido pela mensagem de erro da decisão 21
contra a conta real, é `my.microsoftpersonalcontent.com` — o domínio que o
Microsoft Graph usa para download de conteúdo do OneDrive **pessoal**.
Nenhum dos domínios já liberados batia com ele: `*.sharepoint.com` é
OneDrive/SharePoint corporativo, `*.up.1drv.com` e `*.files.1drv.com` são de
links de compartilhamento — famílias de domínio diferentes, servindo contas
diferentes. Confirmado com o dado real, não com suposição — a decisão 21
existe exatamente para não repetir o padrão das decisões 14 e 17 (corrigir
antes de confirmar a causa).

**Trava de regressão.** `tests/csp.test.ts` (novo) lê `index.html` e confere
que `connect-src` contém `https://*.microsoftpersonalcontent.com`, além de
`graph.microsoft.com` e `login.microsoftonline.com` — para este domínio
específico não voltar a desaparecer silenciosamente numa edição futura da
política.

---

## 23. `App()` checava a rota antes do modo — recuperação "voltava" para o login

**Decisão.** `App()` (`App.tsx`) só mostra a tela de login quando a rota é
`entrada` **e** o modo não é `conectado` nem `demonstrativo`. A checagem virou
uma função pura exportada, `deveMostrarEntrada(modo, rotaTela)`. Na tela
principal, a rota `entrada` passa a renderizar `MeuDia` (como `dia`), em vez
de nada.

**Por quê — o bug real, encontrado só contra a conta real.** Depois de
resolver CORS, CSP e confirmar que `recuperarApontandoPara()` (decisão 20)
publicava o ponteiro com sucesso (cinco requisições, todas 200, inclusive o
`PATCH` com `If-Match`), a pessoa continuava caindo na tela de "Entrar com
Microsoft" depois de clicar em "Recuperar esta" — **sem nenhum erro em
lugar nenhum**. A causa não era rede, CORS, nem sessão: a rota (`rota.tela`)
nunca muda sozinha quando o modo muda — só muda quando alguém navega
explicitamente (`navegar()`). Como a pessoa nunca tinha saído da rota padrão
(`entrada`, o estado antes de logar) durante toda a recuperação, a checagem
antiga —`if (rota.tela === 'entrada') return <Entrada />` — disparava mesmo
com `modo === 'conectado'`, escondendo a base recém-aberta atrás da tela de
login. A pessoa então clicava em "Entrar com Microsoft" de novo, o que
explica as reautenticações repetidas observadas nesta investigação (decisão
22 em diante) — não era a sessão expirando, era a própria interface mandando
entrar de novo sem necessidade.

**Como foi isolado.** Só com o Console e a aba Rede do navegador reais,
abertos pela pessoa dona da conta, com "Preserve log" ligado: um clique
isolado em "Recuperar esta" mostrou cinco requisições, todas 200 — nenhum
erro, nenhuma requisição de navegação de página — e mesmo assim a tela
seguinte foi a de login. Sem esse teste ao vivo, cada hipótese anterior
(CORS, CSP, sessão expirada) parecia plausível; só a ausência de qualquer
falha na rede, com o mesmo sintoma, apontou para a própria navegação da
aplicação.

**Por que uma função pura, não teste de componente.** O projeto não tem
infraestrutura de teste de componente React (`tests/*.test.ts` testam lógica
pura). A condição de roteamento que causou o bug foi extraída como
`deveMostrarEntrada()`, exportada e testável sem renderizar nada.

**Trava de regressão.** `tests/rota.test.ts` (novo): a tela de login aparece
na rota `entrada` para todo modo "deslogado"; **não** aparece quando
`conectado` ou `demonstrativo`, mesmo na rota `entrada` — o caso exato do bug
real; nunca aparece fora da rota `entrada`, seja qual for o modo.

---

## 24. Revisão proativa depois da decisão 23 — dois pontos da mesma classe de bug

**Contexto.** Pedido explícito da pessoa dona da conta depois do conserto da
decisão 23: analisar o código de forma sistemática antes de pedir mais um
ciclo de teste ao vivo, em vez de continuar corrigindo uma hipótese por vez.
Revisão de `estado.tsx`, `App.tsx`, `repositorio.ts` e `msal.ts` à procura da
mesma classe de bug (estado muda, nada na tela reflete) e de outras
correções óbvias.

**24.1 — `sair()` tinha o mesmo problema da decisão 23, na direção oposta.**
`sair()` (`estado.tsx`) zera `modo` para `nao_configurado` mas nunca soube de
rota — só por sorte funcionava, porque os três lugares que chamavam `sair()`
(Escolher base, Recuperação) só eram visíveis enquanto a rota ainda não
tinha saído de `entrada`. Isso deixaria de valer no instante em que qualquer
botão de sair aparecesse fora desse caminho — o que a correção 24.2, abaixo,
faz. **Correção.** `App()` passa a montar um `aoSair()` que chama `sair()` e
navega para `entrada` na mesma ação; `EscolherBase`, `Recuperacao` e
`Configuracoes` recebem `aoSair` por propriedade em vez de chamar `sair()`
direto do contexto, para a navegação nunca ficar esquecida num destino novo.

**24.2 — Não havia nenhuma forma de sair da conta depois de conectado.**
`sair()` só era chamado nas telas de Escolher base e Recuperação — nenhum
botão existia em `conectado` nem `demonstrativo`. Sessão expirada em uso
(`traduzirErro()`, caso `nao_autorizado`, "A sessão expirou. Entre
novamente") não tinha ação nenhuma disponível na interface para agir sobre
o próprio aviso. **Correção.** Botão "Sair desta conta" no painel "Conta e
permissões" de Configurações, visível para `conectado` e `demonstrativo`,
usando o mesmo `aoSair` de 24.1.

**24.3 — Referência instável de `configuracao` em `ProvedorApp`.**
`configuracao = lerConfiguracaoPublica()` era um valor padrão de parâmetro:
reavaliado a cada render, produzindo uma referência de objeto nova toda vez
mesmo sem nada mudar (`main.tsx` nunca passa a prop). Inofensivo em produção
hoje só porque o guard `iniciadoRef` no efeito de login absorve o reexecutar,
mas instabiliza a dependência de qualquer `useMemo`/`useEffect` futuro que
dependa de `configuracao`. **Correção.** `useMemo(() => configuracaoProp ??
lerConfiguracaoPublica(), [configuracaoProp])` — mesma referência entre
renders enquanto a prop não mudar.

**Por que sem teste de componente para 24.1/24.2.** Mesma limitação da
decisão 23: sem infraestrutura de teste de componente React, a garantia
central (`deveMostrarEntrada('nao_configurado', 'entrada') === true`) já
está coberta por `tests/rota.test.ts`; o que muda aqui é só a certeza de que
`aoSair()` sempre navega para `entrada` antes de `sair()` completar — uma
propriedade de fiação entre componentes, não de lógica pura.

**Verificação.** `npx tsc -b`, `npm test` (259 testes, nenhum novo — nenhuma
lógica pura nova a testar) e `npm run build` passam depois das três
correções.

---

## 25. `RecuperacaoNecessaria` numa mutação prendia a pessoa sem saída — achado ao vivo

**O bug real, contra a conta real.** Depois da revisão da decisão 24, a
pessoa tentou uma importação em Importações e viu o aviso "O ponteiro está
vazio, mas há 1 revisão(ões) gravada(s)... Nenhuma base foi recriada: use a
recuperação para escolher uma revisão." — mas continuou na própria tela de
Importações, sem nenhum jeito de "entrar em recuperação" como a mensagem
mandava. A causa: `salvar()` (`repositorio.ts`) relê a cabeça a cada
mutação, não só no login — `carregarRevisaoAtiva()` pode descobrir o
ponteiro vazio a qualquer momento, não só na conexão inicial. Como
`RecuperacaoNecessaria` **não** é um `ErroGraph`, `salvar()` só a
repassava (`if (e instanceof ErroGraph) return this.traduzirErro(e); throw
e;`), e o `catch` de `mutar()` (`estado.tsx`) tratava qualquer coisa que
chegasse ali como um erro de gravação genérico — `setGravacao({ situacao:
'erro', ... })` — sem nunca tocar em `modo`. Os dois outros lugares que já
chamam `carregarRevisaoAtiva()` (o efeito de login e `recarregar()`) sempre
souberam trocar `modo` para `'recuperacao'` quando isso acontece; só o
caminho de mutação, aberto pela decisão 20 (recuperação manual) e nunca
revisado depois, não sabia.

**Por que a revisão da decisão 24 não pegou isto.** A revisão foi guiada
pela mesma classe de bug (rota não acompanha modo), mas olhou para onde
`modo` muda e a tela não acompanha — não para onde uma exceção conhecida
(`RecuperacaoNecessaria`, já tratada em dois lugares) deixa de ser tratada
num terceiro. Só apareceu contra a conta real, com uma base que já estava
nesse estado (ponteiro vazio, uma revisão órfã) antes desta sessão.

**Correção.** No `catch` de `mutar()`, além de gravar o erro, `e instanceof
RecuperacaoNecessaria || e instanceof BaseCorrompida` agora também chama
`setErroConexao(explicar(e))` e `setModo('recuperacao')` — mesmo tratamento
já aplicado no login e em `recarregar()`. `App()` intercepta `modo ===
'recuperacao'` antes de qualquer rota (decisão 23), então a tela de
Recuperação (com a listagem real de revisões e o botão "Recuperar esta")
substitui a tela onde a mutação falhou, em vez de deixar um aviso sem ação
possível.

**Trava de regressão.** `tests/erros-autenticacao.test.ts`: `explicar()`
continua orientando para a recuperação quando recebe `RecuperacaoNecessaria`
— a mesma mensagem que motivou a correção. O acoplamento entre essa
exceção e `setModo('recuperacao')` em `mutar()` não tem teste de componente,
pela mesma limitação das decisões 23 e 24.

---

## 26. "Não consigo colocar o chamado" — faltava a metade de criar o provisório

**O relato.** A pessoa reportou não conseguir "colocar" um chamado no
aplicativo. Chamados.tsx nunca teve formulário de criação manual — a tela
vazia já dizia "Importe as extrações do CS3 ou a planilha em Importações"
— então o caminho esperado é registrar horas em Meu dia citando o chamado
pelo campo "Chamado(s) ou atividade interna", como a própria ajuda do campo
sugere ("Ex.: IR90000001 ; RR90000002"). Só que citar um chamado que ainda
não veio de nenhuma extração CS3 não fazia nada visível: `aplicarApontamento()`
(`MeuDia.tsx`) resolvia a referência contra `base.tickets` e, sem achar,
gravava `ticketId: null` — a referência ficava órfã, o chamado nunca
aparecia em nenhuma tela, e o apontamento parecia ter ido para lugar
nenhum.

**A metade que já existia.** O domínio já tinha tudo preparado para este
caso: `Ticket.provisorio: boolean` ("Verdadeiro enquanto só existir
referência pessoal, sem linha oficial"), `validarInvariantes()` já isenta
tickets sem `sourceSystem`/`ticketType`/`sourceTicketId` da checagem de
chave duplicada, `DetalheChamado.tsx` já tem o aviso "Referência
provisória" pronto, e `domain/reconciliation/importacao.ts` já sabe
completar um provisório quando a extração oficial chega, sem duplicar. Só
faltava o lado de criar um — a decisão 20 (recuperação manual) e todo o
resto da secção 8.5 nunca chegaram a implementar isso em `MeuDia.tsx`.

**Correção.** Novo `resolverOuCriarTicket()` em `MeuDia.tsx`: procura um
chamado existente pela referência normalizada e, não achando, cria um
`Ticket` com `provisorio: true`, `sourceSystem/ticketType/sourceTicketId:
null`, `oficial: null`. `aplicarApontamento()` passa a resolver todas as
referências citadas por essa função antes de montar a revisão nova,
acumulando os tickets criados na mesma chamada — duas citações do mesmo
chamado no mesmo apontamento, ou uma citação repetida numa edição
posterior, reaproveitam o mesmo `Ticket`, nunca duplicam.

**Verificação.** Reproduzido ao vivo contra o modo demonstrativo (Playwright
headless, `npm run dev`): apontar uma hora citando um chamado inexistente
(`IR99999999`) faz o chamado aparecer em Chamados, marcado "Dados oficiais
ainda não importados", com o apontamento vinculado corretamente em
DetalheChamado e refletido no Dashboard ("1 referência(s) provisória(s),
contadas à parte"); nenhum erro no console. Testadas também todas as
outras telas (Meu dia, Dashboard, Planejamento, Importações, Meu
desenvolvimento, Configurações) neste mesmo passe — nenhum erro de console
ou exceção não tratada em nenhuma delas. `tests/apontamento.test.ts`
(novo, 7 testes) cobre `resolverOuCriarTicket()` e `aplicarApontamento()`:
criação do provisório, reaproveitamento sem duplicar (mesma citação duas
vezes no mesmo apontamento, citação repetida numa edição, chamado já
existente), e o caso de atividade interna sem referência não criar nada.
`npx tsc -b`, `npm test` (267 testes) e `npm run build` passam.

---

## 27. A causa real por trás de "Recuperação necessária" reaparecendo sempre

**O relato.** Logada com a conta real, a pessoa importou um CSV de 13
registros, confirmou a carga, e caiu direto em "Recuperação necessária" —
ponteiro vazio, 1 revisão gravada com o carimbo de horário de segundos
atrás. Não era a primeira vez: o mesmo sintoma, com uma revisão órfã
diferente a cada vez, já tinha aparecido em pontos anteriores desta sessão
(inclusive na primeira mensagem deste chat) e motivou tanto a recuperação
manual (decisão 20) quanto o roteamento de `mutar()` para o modo
`recuperacao` (decisão 25). Essas duas correções tratavam o **sintoma** —
dar um caminho de saída quando isso acontece — nenhuma delas explicava
**por que** o ponteiro aparecia vazio logo depois de uma publicação
bem-sucedida, contra dados reais, de forma repetida.

**A causa.** `GraphReal.obterItem()` (`graphReal.ts`) fazia uma leitura
simples de driveItem: `GET /me/drive/items/{id}`, sem `$select`. A
Microsoft **não devolve a propriedade `description` numa leitura assim** —
comportamento documentado da API do Graph, não uma falha de rede ou de
permissão. `paraItem()` mapeia a ausência do campo para string vazia
(`r.description ?? ''`), e `lerPonteiro('')` devolve `null`. Resultado:
toda vez que `carregarRevisaoAtiva()` relia a cabeça — o primeiro passo de
`salvar()`, e de novo na confirmação do passo 7 — via um ponteiro vazio,
**mesmo que o `PATCH` anterior tivesse gravado a descrição corretamente no
servidor**. Como já existia pelo menos uma revisão gravada (a que acabara
de ser publicada), isso é exatamente a condição que dispara
`RecuperacaoNecessaria`. A recuperação manual (decisão 20) "funcionava"
por não depender dessa leitura — ela usa a revisão já validada em memória
e nunca relê a cabeça para confirmar — o que escondia o problema até a
mutação seguinte relê-la de novo e reproduzir o mesmo sintoma.

**Por que nunca apareceu nos testes.** A suíte roda contra um Graph
simulado, em memória, que guarda e devolve `description` fielmente. Essa
omissão é um comportamento específico da API real da Microsoft — só
apareceria contra a conta real, e só numa leitura que dependesse desse
campo logo depois de escrevê-lo, exatamente o padrão do protocolo de
ponteiro (secção 16.2).

**Correção.** `obterItem()` passa a pedir
`$select=id,name,eTag,cTag,description,size,folder,@microsoft.graph.downloadUrl`
explicitamente. É o único ponto de leitura de item usado por
`lerCabeca()` — `atualizarDescricao()`, `criarPasta()` e `filhos()` não
precisam do mesmo ajuste porque nenhum outro código lê `.descricao` de um
item que não tenha passado por `obterItem()`.

**Trava de regressão.** `tests/graphReal.test.ts`: um novo bloco confirma
que a URL de `obterItem()` inclui `description` no `$select`, e que a
descrição é devolvida corretamente quando o servidor a inclui na resposta
— a reprodução mínima do bug real seria justamente o oposto: um `$select`
que não pede o campo, contra um servidor que só devolve o que foi pedido.

**O que isto muda para a base já presa.** A revisão órfã que a pessoa está
vendo agora continua gravada e recuperável pela tela de Recuperação (a
decisão 20 nunca dependeu da leitura quebrada). Depois desta correção
publicada, a expectativa é que o problema pare de **reaparecer** a cada
mutação — mas isso só é confirmado depois de testar de novo contra a conta
real, o que a secção 16.5 já cobra e ainda não rodou.

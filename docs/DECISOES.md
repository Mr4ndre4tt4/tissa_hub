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

**Por que um marcador, e não a primeira pasta real (`state-head`).**
`GraphReal` é a camada de transporte; não deveria saber o nome das pastas que
`RepositorioOneDrive` decide criar (secção 4, `cliente.ts`: "a interface é
mínima de propósito"). O marcador mantém a separação — `approot()` continua
podendo ser chamado sem nenhum conhecimento do protocolo de revisões por cima
dele — ao custo de uma escrita a mais, feita uma única vez por conta (nas
chamadas seguintes o `GET` já funciona).

**Consequência aceita.** A primeira conexão de cada conta grava um arquivo
`.provisionamento` vazio dentro da pasta do aplicativo, que nunca é lido de
volta e não aparece na estrutura documentada (secção 3 de `OPERACAO.md`). Não
é removido porque o contrato do Graph (`ClienteGraph`) não inclui exclusão —
adicioná-la só para isto ampliaria a interface por um caso único.

**Ainda em aberto.** Só `approot()` foi exercitado contra a conta real. O
restante do protocolo — gravar e reler uma revisão com verificação de SHA-256,
publicar o ponteiro com `If-Match`, um 412 de conflito real — continua sem
confirmação. A prova técnica bloqueante da secção 16.5 permanece pendente.

**Trava de regressão.** `tests/graphReal.test.ts` cobre as quatro
combinações: pasta já existe (nenhuma escrita), 404 seguido de provisionamento
bem-sucedido, 404 seguido de 409 (outra sessão venceu, segue normalmente), e
404 seguido de um erro real no marcador (propagado, não engolido).

**Correção parcial — ver decisão 15.** Contra a conta real, o próprio marcador
de provisionamento também devolveu 404. A causa não era a forma da chamada
(leitura vs. escrita, `special/approot` vs. `special/approot:/…:/content`),
mas o escopo: com **apenas** `Files.ReadWrite.AppFolder`, nenhuma chamada
consegue criar a pasta do zero — é uma limitação do próprio Microsoft Graph,
não deste código. Este provisionamento continua no lugar (não faz mal em
contas onde funciona, e evita uma leitura a mais nas contas onde a pasta já
existe), mas sozinho não resolve o caso relatado.

---

## 15. Consentimento único e mais amplo só para destravar a pasta do aplicativo

**Decisão.** Quando `inicializar()` falha com 404 em `special/approot` mesmo
depois do provisionamento (decisão 14), o aplicativo entra no modo
`bloqueio_pasta_app` e oferece um botão explícito — nunca automático — para
pedir `Files.ReadWrite` (acesso a todo o OneDrive) **uma única vez**. O token
dessa troca específica cria a pasta; o dia a dia volta a pedir só
`Files.ReadWrite.AppFolder` depois disso.

**Por quê.** A causa raiz foi confirmada contra a conta real, não é bug deste
projeto: com apenas `Files.ReadWrite.AppFolder`, nenhuma chamada — leitura ou
escrita — consegue criar a pasta especial do zero. É uma limitação conhecida
do Microsoft Graph, relatada e sem resolução permanente publicada pela
Microsoft em
[OneDrive/onedrive-api-docs#682](https://github.com/OneDrive/onedrive-api-docs/issues/682):
a mesma chamada que falha com 404 usando só `Files.ReadWrite.AppFolder`
funciona com `Files.ReadWrite.All`. O workaround documentado ali —
"pedir acesso total a cada novo usuário uma vez, depois soltar" — é
exatamente o que este projeto implementa, com uma diferença: aqui é uma
**decisão explícita da pessoa**, não algo pedido a todo usuário
silenciosamente.

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

**Trava de regressão.** `tests/erros-autenticacao.test.ts` confere que
`ESCOPO_PROVISIONAMENTO_UNICO` (`Files.ReadWrite`) não coincide, por igualdade
exata, com nenhum outro escopo do aplicativo — a mesma comparação que
`iniciar()` usa para reconhecer o retorno — e que a operação recusa sem
configuração, como as demais.

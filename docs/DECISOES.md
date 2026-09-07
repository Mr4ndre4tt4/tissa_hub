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

# Operação: configuração, publicação e recuperação

Nada deste documento foi executado nesta entrega. Ele descreve o procedimento
para quando a configuração real existir.

---

## 1. Registro do aplicativo Microsoft

Necessário para qualquer coisa sair do modo demonstrativo.

1. No portal do Microsoft Entra, crie um registro de aplicativo com suporte a
   **contas Microsoft pessoais**.
2. Plataforma **Single-page application (SPA)**. O fluxo é Authorization Code com
   PKCE; **não** habilite fluxo implícito e **não** crie client secret — este é
   um aplicativo de navegador.
3. Cadastre o **redirect URI** exatamente igual ao endereço onde a interface
   será servida (por exemplo `https://exemplo.com/` em produção e
   `http://localhost:5173/` em desenvolvimento). Redirecionamentos precisam
   corresponder ao registro.
4. Permissão delegada inicial: **`Files.ReadWrite.AppFolder`**. Não amplie.
   `Files.Read` só entra por consentimento incremental, quando a pessoa escolher
   vincular um arquivo fora da pasta do aplicativo — e a interface explica que
   esse escopo **não** é exclusivo daquele único arquivo.

Depois, copie `.env.example` para `.env` e preencha:

```bash
VITE_MS_CLIENT_ID=          # client ID do registro
VITE_MS_AUTHORITY=https://login.microsoftonline.com/consumers
VITE_MS_REDIRECT_URI=       # idêntico ao cadastrado
VITE_APP_URL=               # endereço publicado, quando existir
```

Valores em branco significam “entrada real ainda não fornecida”. Não preencha
com exemplo fictício: o aplicativo trata branco como não configurado e mostra a
mensagem correta.

---

## 2. Prova técnica bloqueante (secção 16.5)

**Antes de usar dados reais**, execute na conta real e registre o resultado:

1. criar a estrutura de pastas na pasta especial do aplicativo;
2. ler e gravar uma revisão, conferindo o SHA-256 dos bytes relidos;
3. `PATCH` condicionado por `If-Match` no `description` de `state-head`, com o
   escopo aprovado — confirmando que **`description` é gravável** e que o
   **`eTag` muda a cada gravação de metadados** nessa conta;
4. conflito real entre dois clientes a partir do mesmo `eTag`;
5. resposta perdida, arquivo removido, alteração externa, hash inválido e
   recuperação;
6. 100 disputas sintéticas de publicação: exigir **um vencedor por base e nenhum
   recibo perdido**, depois conciliar a operação perdedora e conferir as duas.

O passo 6 já passa contra o Graph simulado (`tests/persistencia.test.ts`). Os
passos 1 a 5 **precisam** ser refeitos contra o serviço real: a documentação não
substitui essa execução.

**Se o protocolo do ponteiro, o escopo ou as características de leitura não
forem confirmados**, o sistema permanece demonstrativo ou somente leitura, com
relatório do bloqueio, e é preciso propor uma alternativa de commit condicional
comprovada. Voltar ao salvamento por sobrescrita não é uma opção.

Logs desses testes não devem conter tokens nem textos privados.

---

## 3. Estrutura remota

```text
approot/
  state-head/    pasta vazia; `description` guarda o ponteiro da revisão ativa
  revisions/     documentos JSON imutáveis, nomes únicos
  sources/       cópias de fontes, quando autorizadas, e evidências
  candidates/    candidatos de importação referenciados por revisão
  exports/       relatórios solicitados
  recovery/      checkpoints e recibos de recuperação
```

`state-head` **não** recebe filhos. O ponteiro carrega apenas schema, workspace,
ID da revisão, ID do arquivo e hash — nunca texto de chamado — e é validado
contra o limite de 768 caracteres.

---

## 4. Publicação

Só depois da prova técnica e com autorização explícita.

```bash
npm run build       # gera dist/
```

`dist/` contém apenas código e recursos públicos. Sirva por **HTTPS**, de uma
hospedagem estática autorizada. Azure Static Web Apps é uma opção de publicação,
não um requisito nem uma assinatura já existente; qualquer hospedagem estática
autorizada serve, sem mudar o destino dos dados.

Depois de publicar:

1. acrescente o endereço real ao `redirect URI` do registro e ao `.env`;
2. **abra o endereço publicado** e confirme login, gravação e leitura em outra
   máquina;
3. só então a integração pode ser declarada funcionando. Build verde e teste
   unitário aprovado **não** comprovam persistência, concorrência, licença
   tipográfica, autorização do cliente ou publicação.

Não contrate serviço, não exponha arquivos e não publique sem autorização.

---

## 5. Recuperação

**Situações previstas e o que o aplicativo faz.**

| Situação | Comportamento |
|---|---|
| Ponteiro vazio e nenhuma revisão | Base nova; a inicialização é uma operação explícita. |
| Ponteiro vazio **com** revisões gravadas | Entra em **recuperação**. A base não é recriada do zero. |
| Hash da revisão não confere | Base corrompida; a revisão não é usada nesse estado. |
| Revisão apontada foi removida | Erro explícito; nenhuma base vazia é criada em silêncio. |
| Base de outra conta Microsoft | Recusada. Uma segunda conta nunca carrega a memória da primeira. |
| 412 na publicação | Conflito com a revisão atual, para conciliar. A revisão perdedora fica gravada e identificável. |
| Resposta perdida | Consulta ao recibo. Se não der para determinar, exibe “Confirmação pendente”. |
| Cota insuficiente | **Não é salvamento.** Nada foi gravado. |

**Restaurar** cria uma revisão **nova** a partir de um checkpoint, preservando a
anterior para retorno. É diferente de desfazer uma importação: o desfazimento
seletivo só reverte campos que não foram alterados depois, sem apagar
apontamentos novos.

Revisões não são apagadas automaticamente. Cópias na mesma conta **não** protegem
contra a perda total da conta; uma exportação independente depende de destino
autorizado. Não há criptografia ponta a ponta.

---

## 6. Insumos privados

Os três insumos reais contêm dados de trabalho do cliente:

- `central_chamados_produtividade_aprimorado (1).xlsm`
- `export.csv` (incidentes)
- `export 2.csv` (requisições)

Regras que valem sempre:

- **não** entram no repositório, no diretório público, em exemplos de código, no
  build ou em ferramentas de análise de uso;
- são usados **somente em ambiente autorizado**;
- **não habilite macros**; a presença de VBA no XLSM não autoriza executá-lo;
- o arquivo de origem nunca é reescrito.

Para rodar a conferência do baseline e os testes restritos:

```bash
npm run baseline -- "/caminho/central_chamados_produtividade_aprimorado (1).xlsm"

CENTRAL_XLSM="/caminho/…xlsm" \
CENTRAL_CSV_INC="/caminho/export.csv" \
CENTRAL_CSV_REQ="/caminho/export 2.csv" \
npm run test:restrito
```

Os dois conferem, ao final, que o SHA-256 do original continua idêntico ao do
manifesto.

---

## 7. Limites deste projeto

| Limite | Valor |
|---|---|
| XLSM/XLSX por arquivo | 20 MiB |
| CSV por arquivo | 10 MiB |
| Total descomprimido | 150 MiB |
| Células examinadas | 1.000.000 |
| Ponteiro da revisão | 768 caracteres |
| Meta de escala a validar | 2.000 tickets, 10.000 apontamentos, revisão até 10 MiB |

A meta de escala **ainda não foi medida**. Ao se aproximar de um limite
validado, o aplicativo deve alertar e exigir medição antes de ampliá-lo.

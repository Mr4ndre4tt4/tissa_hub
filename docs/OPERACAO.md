# Operação: configuração, publicação e recuperação

A publicação da interface (secção 4) foi autorizada e está automatizada. **Todo
o resto ainda não foi executado**: nenhum registro de aplicativo Microsoft
existe, a prova técnica bloqueante da secção 2 não rodou e nenhum dado foi
gravado no OneDrive.

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

> **Limitação conhecida da Microsoft, não deste aplicativo.** Com apenas
> `Files.ReadWrite.AppFolder`, a pasta do aplicativo pode não se criar sozinha
> na primeira conexão de uma conta — o Microsoft Graph devolve 404 mesmo com o
> consentimento certo (relatado e sem resolução permanente publicada pela
> Microsoft em
> [OneDrive/onedrive-api-docs#682](https://github.com/OneDrive/onedrive-api-docs/issues/682)).
> Quando isso acontece, a própria interface explica a situação e oferece um
> botão para autorizar, só nessa vez, uma permissão mais ampla que cria a
> pasta — nunca automaticamente. Depois disso o aplicativo volta a usar só
> `Files.ReadWrite.AppFolder`. Detalhes técnicos em `DECISOES.md` §14 e §15.

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

## 4. Publicação no GitHub Pages

Autorizada pelo dono do repositório. Publica **apenas código e recursos
públicos**; os dados de trabalho continuam no OneDrive pessoal e exigem
autenticação Microsoft. A página ser pública não expõe nenhum chamado (secção
14.1: "não confundir esconder o botão com proteção").

**Escolha da hospedagem.** GitHub Pages, porque o repositório já está no GitHub,
é HTTPS por padrão e **não exige contratar nada** — a especificação proíbe
contratar serviço ou prometer gratuidade permanente. Azure Static Web Apps
continua sendo uma alternativa válida, sem mudar o destino dos dados.

> **Atenção se o repositório virar privado.** O GitHub Pages em repositório
> privado exige plano pago. Se você tornar o repositório privado — como sugeri
> para poder versionar a especificação —, a publicação precisa migrar para outra
> hospedagem estática autorizada.

### 4.1 O que o workflow faz

`.github/workflows/publicar.yml`, disparado por push em `main` ou manualmente:

1. **tipagem e testes** — build vermelho não publica;
2. **construir** — com o caminho base do repositório de projeto;
3. **conferir o build** — que os assets apontam para o caminho certo (um base
   errado deixaria o site em branco em silêncio) e que **não há planilha,
   identificador de chamado fora da faixa sintética nem hash de insumo
   privado** (AC-059);
4. **publicar** — substitui o branch `gh-pages` com o conteúdo de `dist/`.

**Por que pelo branch e não por "GitHub Actions".** O `GITHUB_TOKEN` não tem
permissão para criar o site do Pages pela API — devolve "Resource not accessible
by integration" — e a habilitação manual por "Source: GitHub Actions" não
funcionou neste repositório. Ao publicar num branch, o GitHub habilita o Pages
sozinho e o workflow precisa apenas de `contents: write`, sem permissão especial
nem configuração manual.

O branch `gh-pages` guarda o site, não histórico: é substituído a cada
publicação (`push -f`). Nunca edite nada nele; a fonte é sempre `main`.

### 4.2 Sequência completa

O endereço é previsível, então o registro Microsoft pode ser feito antes:

```text
https://mr4ndre4tt4.github.io/tissa_hub/
```

1. **Levar o código para `main`.** O workflow só dispara nesse ramo.
2. **Primeira publicação.** A página sobe funcionando, porém em **modo
   demonstrativo**: sem client ID ela exibe "Integração Microsoft não
   configurada" e não grava nada. Isso é esperado, não é falha.
3. **Registrar o aplicativo Microsoft** (secção 1 deste documento), usando
   `https://mr4ndre4tt4.github.io/tissa_hub/` como redirect URI — com a barra
   final, idêntico.
4. **Definir a variável do repositório** em Settings → Secrets and variables →
   Actions → **Variables**:

   | Variável | Valor |
   |---|---|
   | `MS_CLIENT_ID` | client ID do registro |
   | `MS_REDIRECT_URI` | opcional; sem ela, usa o endereço do Pages |
   | `MS_AUTHORITY` | opcional; padrão é a autoridade de consumidores |
   | `APP_URL` | opcional; sem ela, usa o endereço do Pages |

   São **configurações públicas**, não segredos — por isso variáveis, e não
   secrets. Mas não devem ser inventadas: variável vazia é tratada como ausente.
5. **Republicar** — Actions → "Publicar interface" → Run workflow. Agora o botão
   "Entrar com Microsoft" aparece.
6. **Executar a prova técnica bloqueante** da secção 2 deste documento, na conta
   real. **Só depois disso** o aplicativo pode ser usado com dados reais.
7. **Confirmar a rotina no endereço publicado**: entrar, importar, registrar
   esforço e abrir a mesma base em outra máquina. Antes disso, nada de declarar
   a integração pronta.

### 4.3 Publicação em outra hospedagem

```bash
VITE_BASE=/ \
VITE_MS_CLIENT_ID=… VITE_MS_REDIRECT_URI=… VITE_APP_URL=… \
npm run build
```

`dist/` contém só código e recursos públicos. Sirva por HTTPS, de uma hospedagem
estática autorizada.

---

### 4.4 Regras que valem em qualquer publicação

Publicar a interface é diferente de liberar o uso com dados reais: o segundo
depende da prova técnica da secção 2. Depois de publicar:

1. o endereço real precisa constar do `redirect URI` do registro;
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

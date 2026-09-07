# Central de Chamados

Controle pessoal de chamados e esforço, com os dados no **OneDrive pessoal**.
Aplicação de página única em React + TypeScript + Vite, sem servidor próprio e
sem banco de dados externo.

> **Estado atual.** O domínio, os leitores de fontes, a conciliação, as métricas
> e as sete telas estão implementados e testados. **Nenhuma conta Microsoft foi
> conectada, nada foi gravado no OneDrive e o aplicativo não foi publicado** — a
> integração depende de configuração que ainda não existe. O relatório completo,
> com o que foi testado e o que não foi, está em
> [`docs/RELATORIO_DE_ENTREGA.md`](docs/RELATORIO_DE_ENTREGA.md).

Especificação de origem: [`especificacao/ESPECIFICACAO_FINAL_PARA_IA.md`](especificacao/ESPECIFICACAO_FINAL_PARA_IA.md), versão 4.0.

## O que a ferramenta faz

- **Meu dia** — registra o trabalho da data e fecha a jornada de 480 minutos,
  mostrando faltante ou excedente sem nunca completar as horas artificialmente.
- **Chamados** — incidentes e requisições com o status oficial do CS3 ao lado do
  seu acompanhamento pessoal, que o atualizador de dados oficiais nunca
  sobrescreve.
- **Dashboard** — indicadores recalculados a partir dos apontamentos, cada um
  com a sua definição e as suas exclusões. Nada é apresentado como SLA oficial.
- **Planejamento** — tarefas e follow-ups, que nunca geram horas sozinhos.
- **Importações** — assistente de carga com prévia, comparação em três estados e
  uma caixa de pendências que não some depois do upload.
- **Meu desenvolvimento** — notas profissionais estruturadas, independentes do
  esforço.
- **Configurações** — conta, jornada, células, mapa de status, regras de
  follow-up, retenção e diagnóstico.

## Começar

```bash
npm install
npm run dev
```

Sem a configuração Microsoft, a tela de entrada diz **“Integração Microsoft não
configurada”** e oferece o **modo demonstrativo**, com dados inventados e
claramente identificados. Nesse modo o aplicativo nunca diz “Salvo no OneDrive”.

Para habilitar a integração, copie `.env.example` para `.env` e preencha o
client ID e o redirect URI de um registro de aplicativo Microsoft que aceite
contas pessoais. Veja [`docs/OPERACAO.md`](docs/OPERACAO.md).

## Verificar

```bash
npm test                    # 218 testes sintéticos
npx tsc -b                  # tipagem
npm run build               # build de produção

npx vite preview --port 4173 --strictPort &
npm run verificar:interface # navegador real: responsividade, foco, console
```

Com os insumos reais, **apenas em ambiente autorizado**:

```bash
npm run baseline -- "/caminho/central_chamados_produtividade_aprimorado (1).xlsm"

CENTRAL_XLSM="…" CENTRAL_CSV_INC="…" CENTRAL_CSV_REQ="…" npm run test:restrito
```

Os insumos privados **não estão neste repositório** e não devem entrar nele.

## Estrutura

```text
src/
  app/                composição, rotas e estado da aplicação
  design/             tokens, componentes acessíveis e estados visuais
  features/           day · tickets · dashboard · planning · development ·
                      settings · imports
  domain/
    entities/         tipos, identidade, células e revisão
    time/             duração, datas, jornada e alocação
    reconciliation/   três estados, multiplicidade e importação
    metrics/          agregações puras e verificáveis
    sources/          CSV, ZIP seguro, OOXML e escrita de XLSX
  adapters/
    identity/         MSAL e configuração pública
    graph/            porta do Graph, implementação real e simulada
    storage/          protocolo de revisões e ponteiro condicionado
  fixtures/           dados sintéticos do modo demonstrativo
tests/                suíte automática (sintética)
tests/restrito/       testes com os insumos reais, fora da suíte automática
especificacao/        documento mestre, contratos e referências
docs/                 decisões, operação, relatório e evidências
```

## Decisões que não podem ser trocadas em silêncio

- Os dados de trabalho ficam **no OneDrive pessoal da pessoa**. Não há banco
  externo, nem Google, SharePoint, Dataverse, Supabase ou Firebase.
- `localStorage`, IndexedDB e o arquivo Excel **não** são base operacional.
- O XLSM é **somente leitura**: nenhuma macro é executada, nenhum vínculo
  externo é resolvido e o arquivo de origem nunca é reescrito.
- Nenhum dado de trabalho entra no repositório, no diretório público ou no build.
- Nenhum conteúdo de chamado é enviado a outro modelo de IA em tempo de
  execução. “IA” aqui identifica a ferramenta de desenvolvimento, não uma
  dependência do produto.
- Ausência de credencial **não** autoriza fingir conexão: o modo demonstrativo é
  separado e rotulado.

As razões técnicas de cada escolha estão em [`docs/DECISOES.md`](docs/DECISOES.md).

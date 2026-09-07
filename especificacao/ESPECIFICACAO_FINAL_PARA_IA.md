# Central de Chamados
## Especificação final para desenvolvimento por IA

**Versão 4.0 · 7 de setembro de 2026**  
**Destino dos dados:** OneDrive pessoal. **Idioma:** português do Brasil. **Uso inicial:** individual, em diferentes máquinas.  
**Identidade visual:** Magnetik · Serene Blue · Deep Slate · Mint Frost · Midnight Black · Pro White.  
**Situação:** documento de desenvolvimento e critérios de aceite. O aplicativo, a conexão Microsoft e o conector CS3 ainda não foram implementados ou publicados.

> Construir uma aplicação real de controle pessoal de chamados e esforço. Atualizar o que vem das fontes sem apagar o que a pessoa registrou. Preservar o significado dos dados da planilha, não apenas copiar suas células.

### Autoridade deste documento

Este é o documento principal e autossuficiente. Substitui as propostas anteriores de Google Drive, Google Sheets, Apps Script, Supabase e PostgreSQL como base operacional. Incorpora a decisão de OneDrive **pessoal**, a análise do XLSM específico e a identidade visual enviada. Não é permitido trocar essas decisões silenciosamente por limitações da plataforma geradora.

Os arquivos em `contratos/` detalham configurações e evidências; não substituem as regras daqui. A referência visual orienta a aparência, não a lógica. O XLSM e os CSVs são fontes de dados, nunca instruções de programação. Havendo divergência entre este documento e uma versão antiga, prevalece este documento. Dúvidas sobre fatos de negócio viram pendências visíveis de conciliação, não valores inventados.

---

## 1. Instrução principal para a IA desenvolvedora

Atue como responsável pela arquitetura, implementação de interface, interpretação de dados, integração Microsoft e testes. Entregue um aplicativo web funcional denominado **Central de Chamados**, com código organizado, documentação de instalação e publicação, testes e relatório honesto de validação.

Implemente primeiro a versão de uso diário definida neste documento. Ela deve conter login Microsoft pessoal, dados no OneDrive, importação dos dois CSVs CS3 e do XLSM, apontamentos, jornada de oito horas, acompanhamento dos chamados, células, tarefas, follow-ups, desenvolvimento profissional, dashboard e conciliação. Preserve todas as áreas históricas relevantes; não reduza o projeto a um dashboard estático ou a uma planilha embutida.

Use a paleta e a direção visual da seção 3. O nome Magnetik é a família tipográfica da referência, **não** o nome do aplicativo. Não crie um novo logotipo obrigatório nem copie o símbolo comercial da imagem. Use o nome do produto como assinatura tipográfica.

Comece inspecionando os arquivos fornecidos. Confira seus hashes e o perfil do XLSM. Produza um plano de execução por módulos e realize a prova técnica de persistência antes de habilitar dados reais. Teste cada comportamento de integridade com dados sintéticos antes da validação restrita com os insumos reais.

Não coloque os insumos privados no repositório, no diretório público da aplicação, em exemplos de código, no build ou em ferramentas de análise de uso. Não envie conteúdos dos chamados a outro modelo de IA em tempo de execução. O termo “IA” aqui identifica a ferramenta de desenvolvimento, não uma dependência funcional do produto.

A ausência de credenciais de integração não justifica fingir uma conexão. Nessa situação, entregue a implementação e um modo demonstrativo explicitamente separado, com a configuração faltante e os testes reais ainda não executados. Não afirme “salvo no OneDrive” se houve somente alteração no navegador.

Não reabra escolhas já definidas. Peça intervenção apenas para consentimento Microsoft, configurações reais de publicação, licença da fonte ou uma decisão de negócio que afete dados. Não contrate serviços, exponha arquivos ou publique o aplicativo sem autorização.

### O que não é aceitável

- Usar Google, SharePoint, Dataverse, Supabase, Firebase ou outro banco hospedado como substituto não autorizado do OneDrive pessoal.
- Usar `localStorage`, IndexedDB ou um arquivo Excel como única base operacional.
- Salvar o estado inteiro sobre uma versão antiga sem controle remoto de concorrência.
- Importar totais e detalhes de horas simultaneamente, multiplicar esforço por quantidade de chamados ou completar oito horas artificialmente.
- Executar VBA, consultar vínculos externos do XLSM, alterar o arquivo original ou pedir senha do CS3 na conversa.
- Apresentar protótipo, dados de demonstração, testes simulados ou endereço local como aplicação publicada e integrada.

## 2. Escopo, fontes e decisões fechadas

### 2.1 Resultado esperado

A pessoa acessa um endereço HTTPS, autentica-se com sua conta Microsoft pessoal e encontra a mesma base em outra máquina. Na tela **Meu dia**, registra trabalho e visualiza horas confirmadas, meta, faltante ou excedente. Em **Chamados**, acompanha incidentes e requisições, com status oficial, andamento pessoal, notas, próximas ações e esforço. As células são **AMS**, **Squad de melhoria** e **Task Force**.

A ferramenta aceita as extrações CS3 e a planilha legada em qualquer ordem. A ordem de upload não estabelece precedência entre informações oficiais e pessoais. A importação é inicialmente manual ou acionada pela leitura de arquivo vinculado do OneDrive; o conector automático CS3 é evolução separada.

### 2.2 Insumos reais no pacote

| Arquivo | Uso | Evidência conhecida |
|---|---|---|
| `insumos_privados/export.csv` | Incidentes CS3 | 3 registros, 24 colunas; chave `Incident ID`. |
| `insumos_privados/export 2.csv` | Requisições CS3 | 13 registros, 23 colunas; chave `Request ID`. |
| `insumos_privados/central_chamados_produtividade_aprimorado (1).xlsm` | Histórico e controle pessoal | 13 abas; perfil específico descrito na seção 10. |
| `referencias/identidade_visual.jpeg` | Direção visual fornecida | Cinco cores e família Magnetik. |
| `referencias/interpretacao_da_planilha.md` | Evidências da análise anterior | Células, regras e divergências observadas. |

Os CSVs isolados contêm 16 identidades distintas. Essa contagem **não** é o total esperado depois de juntar o histórico do XLSM. A planilha possui referências compostas e chamados ausentes dos CSVs; reconciliar antes de declarar a quantidade consolidada.

Os arquivos reais contêm informações de trabalho do cliente. O pacote não deve ser publicado ou anexado a um ambiente de desenvolvimento sem autorização adequada. A presença de macros no XLSM não autoriza executá-las.

### 2.3 Fora da primeira versão

Envio de horas ao CS3; alteração do CS3; robô agendado sem usuário; trabalho offline com sincronização posterior; edição bidirecional do XLSM; colaboração multiusuário na mesma base; aprovações corporativas; cronômetro; armazenamento de senhas; indicadores oficiais de SLA. Essas funções não devem aparecer como botões aparentemente ativos.

Cronômetro, extensão CS3 e sincronização agendada podem ser desenvolvidos depois, sem redesenhar o domínio. O aplicativo não substitui as políticas e ferramentas oficiais do cliente.

## 3. Identidade visual e experiência

### 3.1 Paleta obrigatória

Usar os valores escritos na imagem, não amostras alteradas pela compressão JPEG. [V1]

| Nome | HEX | Papel na interface |
|---|---|---|
| Serene Blue | `#A6BAC8` | Seleção, destaque suave, etiqueta AMS, faixas informativas. |
| Deep Slate | `#334049` | Texto principal, navegação, botão principal, etiqueta Task Force. |
| Mint Frost | `#D1E6D2` | Confirmações suaves e etiqueta Squad de melhoria. |
| Midnight Black | `#1A1A1A` | Títulos e ênfase pontual; não dominar o fundo. |
| Pro White | `#FAFAFA` | Fundo e superfícies principais. |

Aparência: clara, organizada, sóbria e acolhedora; tipografia sem serifa, linhas finas, bastante espaço, boa leitura de tabelas. Evitar gradientes, roxo genérico, neon, grandes sombras, excesso de cartões, glassmorphism e decoração que concorra com os dados. O fundo é Pro White, não bege ou cinza frio escolhido arbitrariamente.

Botão principal: Deep Slate com texto Pro White. Botão secundário: fundo Pro White, texto e contorno Deep Slate. Seleção: Serene Blue com texto Deep Slate. Conclusão: Mint Frost com texto Deep Slate. Alertas devem combinar texto, ícone e contorno; não introduzir uma nova paleta de marca para indicar erro. A exclusão usa confirmação explícita e a palavra “Excluir” ou “Cancelar registro”.

### 3.2 Tipografia e licença

Família preferencial: **Magnetik**, pesos 400, 500 e 600. Títulos podem usar peso 400/500; tabelas e controles não devem usar Extra Light ou Light. Escala inicial: título 32 px, seção 22 px, corpo 16 px, tabela 14 px, legenda 12 px; ajustar responsivamente sem reduzir dados essenciais abaixo de 14 px.

Nenhum arquivo de fonte foi fornecido. Usar inicialmente `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`, declarar a substituição e preparar o ponto de inclusão da Magnetik licenciada. Não baixar a fonte de origem não autorizada, não redistribuí-la e não afirmar que Magnetik está aplicada quando só existe fallback. Fontes não fazem parte deste pacote.

### 3.3 Layout e componentes

Navegação lateral de aproximadamente 232 px no desktop; conteúdo máximo de 1.440 px, margens de 32 px. Em telas menores, menu recolhível e margens de 16 px. Grade de espaçamento: 4, 8, 12, 16, 24, 32 e 48 px. Cantos de 8 px em controles e 12 px em painéis. Controles de toque com pelo menos 44 px de altura como meta do projeto.

Uma ação principal por tela. Tabelas com cabeçalhos claros, alinhamento de números à direita, unidades visíveis e opção de densidade. O título pode quebrar linha; o ID deve continuar identificável. Não esconder valores completos apenas em hover. As colunas secundárias podem ir para um painel de detalhe no celular.

Cores de célula: AMS = Serene Blue; Squad = Mint Frost; Task Force = Deep Slate com texto claro. “Sem classificação” e “Geral / transversal” usam contorno e texto. A etiqueta sempre contém o nome. A cor da célula não representa automaticamente urgência ou sucesso.

### 3.4 Acessibilidade

Meta: WCAG 2.2 nível AA para os fluxos implementados. Texto comum exige contraste adequado; o critério mínimo de contraste textual é 4,5:1, com exceção prevista para texto grande. [W1]

Cálculos sobre as cores HEX, sem transparência: Deep Slate/Pro White ≈ 10,21:1; Deep Slate/Serene Blue ≈ 5,32:1; Deep Slate/Mint Frost ≈ 8,10:1. Pro White/Serene Blue ≈ 1,92:1 e Pro White/Mint Frost ≈ 1,26:1: **não usar texto branco nesses dois fundos claros**. São verificações de pares de cor, não uma certificação da interface final.

Foco de teclado evidente; rótulos associados; mensagens de erro ligadas aos campos; modal com foco contido e retorno ao acionador; leitura por leitor de tela; alternativa tabular para gráficos; estados que não dependam só de cor. Respeitar redução de movimento. Transições discretas de cerca de 140 ms.

### 3.5 Referência não é tela pronta

A imagem recebida é um guia de marca, não um desenho aprovado das telas. A IA deve produzir a interface a partir dos requisitos e destes tokens, validar desktop e celular e apresentar evidência visual da aplicação. Não converter a imagem em fundo da aplicação nem entregar uma imagem estática no lugar dos controles.

## 4. Navegação e especificação das telas

Navegação: **Meu dia · Chamados · Dashboard · Planejamento · Importações · Meu desenvolvimento · Configurações**. O detalhe do chamado abre por ID. Histórico de resoluções é uma visão de Chamados/Dashboard, não um segundo cadastro de tickets.

### 4.1 Entrada e configuração inicial

Tela com nome do produto, “Entrar com Microsoft” e explicação de que os dados ficam no OneDrive pessoal. Sem formulário próprio de senha. Depois de autenticar, apresentar a conta ativa, solicitar consentimento e oferecer criar a base ou abrir a base existente. Nunca interpretar um erro de conexão como base vazia.

Configuração inicial: fuso de trabalho America/Sao_Paulo; jornada padrão de segunda a sexta, 480 minutos; calendário editável; classificação das células; escolha entre upload manual e arquivo vinculado. O fuso do CSV é solicitado como configuração da fonte, não adivinhado. Enquanto não for informado, preservar o horário local sem convertê-lo em UTC e não comparar fontes de perfis diferentes.

### 4.2 Meu dia

Topo: data, seletor de dia, horas confirmadas/meta, faltante/excedente, registros incompletos e botão “Novo apontamento”. Abaixo: lista de atividades com descrição, vínculo, célula, duração e estado. A linha “Compartilhadas / sem rateio” permanece visível quando necessária.

Formulário: data de trabalho; chamado(s) ou atividade interna; descrição; tipo de atuação; duração em `HH:mm`; célula histórica; observação; indicação pessoal de lançamento externo. Para nova atividade, duração positiva, data e descrição são obrigatórias; permitir salvar rascunho explicitamente, excluído dos totais. Atividades legadas sem descrição detalhada podem ser confirmadas como históricas com aviso, preservando o título de origem sem inventar o trabalho feito.

Ações: criar, editar, cancelar com confirmação, copiar resumo do dia e navegar aos chamados. Após salvar, manter a data selecionada e atualizar os totais. Não duplicar atividade ao clicar duas vezes. Pendência de rede mantém o formulário e informa “Ainda não confirmado no OneDrive”.

### 4.3 Chamados

Colunas iniciais: ID/referência, tipo, título pessoal ou oficial, status CS3, andamento pessoal, célula, horas atribuídas, próximas ações e data da última atualização oficial. Total acumulado e total do período devem estar separados. Referências provisórias exibem “Dados oficiais ainda não importados”.

Busca por ID, título, referência externa e termos da descrição. Filtros combináveis por célula, tipo, status oficial, status pessoal, categoria, prioridade, sem classificação e pendências. Disponibilizar visão em tabela; um quadro kanban é opcional, não substitui a tabela.

Classificação e etiquetas em lote exigem prévia com quantidade afetada. Concluir no controle pessoal não altera o CS3. A seleção de “somente ativos” não deve eliminar horas históricas dos relatórios de esforço.

### 4.4 Detalhe do chamado

Seções: **Resumo · Dados CS3 · Meu acompanhamento · Apontamentos · Follow-ups · Histórico**. Mostrar claramente o que veio do CSV, do XLSM e do aplicativo. Notas são entradas próprias, não uma única célula sempre substituída. Título pessoal, próxima ação, prazo, célula manual, andamento e estimativa são editáveis sem alterar a origem.

Horas: atribuídas ao chamado; compartilhadas ainda não rateadas, apenas informativas; saldo histórico identificado, quando existir. A soma principal do chamado não pode incluir duas vezes um apontamento compartilhado. Mostrar motivo de desconhecimento de uma data ou de uma célula.

“Copiar ID” funciona sempre que houver ID. “Abrir no CS3” só é habilitado depois de validar a URL real de detalhe. Não fabricar um endereço pelo número do chamado.

### 4.5 Dashboard

Primeira faixa: horas da data selecionada, saldo, dias vencidos com pendência e próximos passos vencidos. Segunda: horas por dia com meta e distribuição por célula. Terceira: chamados por status, maior consumo de esforço e fila de ações. Todos os indicadores têm filtro, definição e acesso ao detalhe que os compõe.

A visão de produtividade mostra resoluções **pessoais conhecidas**, reaberturas observadas, esforço e tempo entre datas válidas. Nunca denominar essas medidas SLA oficial. Exibir “dados atualizados até a última importação”, sem promessa de tempo real do CS3.

### 4.6 Planejamento

Duas visões: **Tarefas do dia** e **Follow-ups**. Tarefas têm título, data opcional, horário opcional, vínculo, prioridade, estado, check e observação. Sem data vira “Sem data”, não hoje. Follow-up tem data, chamado, canal, responsável, resultado, resposta, próxima ação e resumo.

Nenhum desses registros cria horas automaticamente. Uma ação “Registrar esforço desta atividade” pode abrir o formulário de apontamento com vínculo e descrição sugeridos, mas sem preencher duração nem gravar até confirmação.

### 4.7 Importações e conciliação

Três entradas explícitas: “CSV de incidentes”, “CSV de requisições” e “Central de Chamados — Excel”. Detecção de tipo pelo conteúdo, com aviso de seleção incompatível. Mostrar nome do arquivo, origem local/OneDrive, versão, tamanho e perfil detectado.

Passos: selecionar → ler → validar → comparar → resolver pendências → confirmar → resultado. Prévia distingue novos, alterados, iguais, versões antigas, incompletos, conflitos, possíveis duplicatas e excluídos explicitamente pelo usuário. Nada é gravado na base principal enquanto a prévia não for confirmada.

Tela de conciliação mostra valor importado, último valor importado e valor atual do aplicativo, com aba/linha/célula. Ações: manter aplicativo, aceitar origem, vincular ao registro existente, criar separado, adiar ou ignorar com motivo. Excluir um candidato da carga não apaga um registro já existente.

### 4.8 Meu desenvolvimento

Preservar registros da aba correspondente: data, tipo de atividade, tema, descrição, pessoa/área impactada, resultado, competência, relevância para reunião individual, próximo passo e estado. Busca e exportação de resumo do período. Não gerar horas a partir desses relatos. Uma descrição sem data continua armazenada com pendência.

### 4.9 Configurações

Conta e permissões; fonte Excel vinculada; regras de jornada/calendário; células e etiquetas; mapas de status; regras de follow-up; política de retenção; exportação/recuperação; diagnóstico da conexão e versão do aplicativo. Operações que descartam dados exigem resumo das consequências e confirmação.

### 4.10 Estados comuns obrigatórios

Carregando; vazio real; sem resultados para os filtros; sem permissão; sessão expirada; arquivo alterado; arquivo removido; planilha incompatível; cota insuficiente; sem rede; salvamento incerto; conflito entre dispositivos; base corrompida; recuperação disponível. Mensagens claras em português, sem apresentar exceção técnica bruta como única orientação.

## 5. Modelo de domínio e propriedade dos dados

A persistência é em JSON versionado, mas o domínio deve ser tipado e validado como uma base estruturada. Todas as entidades pertencem a um único `workspaceId`. IDs internos são UUIDs. Registros confirmados têm versão, origem, criação, atualização e trilha de alteração. Data de trabalho é `YYYY-MM-DD`; timestamps técnicos são ISO 8601 com fuso.

| Entidade | Campos essenciais e responsabilidade |
|---|---|
| Workspace | ID, identidade Microsoft/drive associada, schemaVersion, preferências, calendário e configurações aprovadas. |
| Ticket | ID interno; namespace/tipo/ID externo; estado provisório ou oficial; campos CS3; versão da fonte. |
| PersonalTicketState | Ticket ou grupo pessoal; título, estado, prioridade, célula manual, próxima ação, prazo, estimativa, RND bruto. |
| TicketGroup / Reference | Agrupamento pessoal e referências externas/compostas sem fusão automática de tickets oficiais. |
| Note | Texto, autoria, vínculo(s), data e origem; sem duração. |
| TimeEntry | Data, descrição, duração em minutos ou null, tipo, célula histórica, estado, elegibilidade de jornada, indicação de lançamento externo e origem. |
| TimeEntryReference | Vínculos informativos entre uma atividade e uma ou mais referências. Não possui horas implícitas. |
| TimeAllocation | Alocação explícita de minutos de uma atividade a um ticket; soma igual à duração quando rateio confirmado. |
| FollowUp | Evento de cobrança/retorno e suas datas/resultados; não equivale a apontamento. |
| Task | Planejamento, check e vínculo opcional; não equivale a apontamento. |
| StatusEvent / ResolutionEvent | Mudança pessoal ou oficial observada, sua origem e datas conhecidas; sem inventar transições anteriores. |
| DevelopmentRecord | Registro profissional, independente de esforço. |
| Schedule / CalendarException | Jornada por dia da semana e exceções por data; meta diária em minutos. |
| OpeningBalance | Saldo anterior identificado, data de corte e escopo; proibido duplicar detalhes já importados. |
| SourceDocument / ImportBatch | Origem, driveItem ou upload, hash, perfil, contagens e revisão aplicada. |
| SourceRecordLink | Identidade do registro importado, última versão conhecida e associação ao ID interno. |
| ReconciliationIssue | Tipo, evidência, impacto, decisão, autoria e estado; permite pendências não destrutivas. |
| AuditEvent / OperationReceipt | Operação, antes/depois, ID de idempotência, revisão, autoria e horário técnico. |

### 5.1 Invariantes

Identidade oficial única: `workspaceId + sourceSystem + ticketType + sourceTicketId`. Não usar título, linha, nome de arquivo, `External` ou `Reference ID` como chave. Campo manual do aplicativo nunca pertence ao atualizador de dados CS3.

Uma atividade possui exatamente uma natureza: trabalho associado a referências ou atividade interna. Pode referenciar vários chamados sem gerar cópias de esforço. Duração confirmada é inteiro positivo; null é incompleto. Um novo apontamento não pode exceder 1.440 minutos por data. Valores legados maiores devem ser preservados em quarentena. O total diário acima da meta é alerta, não autorização para truncar dados.

Célula pertence ao próprio apontamento como fotografia histórica. A mudança de célula atual do ticket só sugere a célula de novos registros. Para históricos sem evidência, usar `UNCLASSIFIED`; não aplicar retroativamente a célula de hoje.

### 5.2 Proveniência mínima

Para cada valor importado relevante: arquivo/fonte, hash, perfil, aba, linha e célula observadas, valor bruto, natureza literal/fórmula, fórmula textual quando houver, valor salvo, normalização feita e decisão. Número da linha é rastreabilidade, não identidade persistente.

Origem temporal distingue data informada, data calculada, instante observado e horário de importação. Um status lido hoje numa fórmula não se transforma em evento de status no dia histórico do apontamento.

## 6. Horas, jornada e rateios

Meta padrão: **480 minutos por dia útil no conjunto das atividades**, não por célula. Jornada de segunda a sexta é um padrão configurável, não a inferência do calendário real. A janela de controle começa em data escolhida pelo usuário; antes dela não gerar pendência de jornada automaticamente.

Horas confirmadas do dia = soma dos minutos de atividades confirmadas, elegíveis, não canceladas e atribuídas à data de trabalho. Rascunhos, durações vazias, candidatos em quarentena e cronômetros futuros abertos não entram. Faltante = máximo(meta − realizado, 0); excedente = máximo(realizado − meta, 0). 7h30 deixa 30 min; 8h15 excede em 15 min. Nunca completar, arredondar para a meta ou compensar outro dia automaticamente.

Férias, feriados, folga e jornada reduzida ajustam a meta daquela data. Meta mensal = soma das metas das datas; mostrar meta vencida até ontem, meta de hoje e meta total do período. Dias futuros não são atrasos. Um apontamento retroativo usa a data do trabalho, não o dia da digitação.

### 6.1 Duração de Excel

Neste perfil, número em `Apontamentos!E` é fração de dia: multiplicar por 1.440. Tolerância apenas para ruído de ponto flutuante. Exemplos: 0,125 = 180 min; 0,0625 = 90 min; 0,18958333333333333 = 273 min. Se a conversão indicar segundos realmente existentes, solicitar regra explícita; não arredondar silenciosamente o trabalho.

Formato textual `HH:mm` usa parser próprio. Número rotulado como hora decimal em outro layout exige perfil diferente. Datas seriais respeitam o sistema 1900/1904 do arquivo; o serial fictício 60 no sistema 1900 não vira uma data histórica válida por suposição. Não converter datas civis em UTC e depois deslocar um dia.

### 6.2 Múltiplos chamados e células

Atividade de 120 min ligada a dois chamados soma 120 min no dia. Inicialmente, rateio de ticket pode ficar pendente: mostrar o evento em cada detalhe com etiqueta “Compartilhado — sem rateio”, mas **não** atribuir 120 min ao total de ambos. Depois do rateio, 75 + 45 = 120, por exemplo, mediante decisão explícita.

O eixo de células é separado do rateio por ticket: cada atividade possui uma célula histórica ou Geral/transversal/Sem classificação. No primeiro escopo, não dividir automaticamente uma atividade por células diferentes. Quando realmente necessário, a pessoa pode repartir a atividade em registros próprios, com validação de soma, vínculo de origem e cancelamento auditado do registro substituído. Não duplicar o esforço.

Reconciliação obrigatória dos relatórios: total confirmado = minutos atribuídos aos tickets + minutos compartilhados ainda sem rateio + minutos de atividades internas + minutos de referências sem vínculo confirmado, com classes mutuamente exclusivas. Por célula: AMS + Squad + Task Force + Geral + Sem classificação = total confirmado. Saldos iniciais são mostrados à parte e não entram em jornada sem datas detalhadas.

### 6.3 Estado e lançamento externo

Estados de importação: `ready`, `incomplete`, `needs_review`, `ignored`; estados operacionais: `draft`, `confirmed`, `cancelled`. Não sobrecarregar um único status com os dois significados.

`LANÇADO` representa uma anotação pessoal importada. Guardar como `reported_posted`, nunca `verified_by_cs3`. Campos de lançamento oficial não são inferidos do dashboard, da existência de horas nem da observação. Alterar ou cancelar horas exige auditoria; cancelamento não apaga o registro.

## 7. Células, estados e esforço previsto

Células: AMS, Squad de melhoria, Task Force. Geral/transversal é classificação de atividade interna; Sem classificação é pendência. Tags auxiliares podem representar FI, CO, TRM, FSCM, programa e projeto, sem dupla contagem nos totais.

Sugestões pela `Tag 3`: `MELHORIA SQUAD` → Squad; `TASK FORCE` → Task Force; `BASELINE` sem `EXTRABASELINE` → sugestão AMS a confirmar; `EXTRABASELINE` ou vazio → revisão. Avaliar EXTRABASELINE antes de BASELINE. Preservar grafia original e normalizar apenas para comparar. A amostra permite 2 sugestões Squad, 2 Task Force, 7 AMS condicionais e 5 revisões. [F1–F2]

`Assignment Group` contendo AMS não determina a célula. Categoria SAP, tipo IR/RR, tipo de atuação e RND também não. Célula sugerida e célula manual são campos distintos; manual prevalece. Uma tag posterior divergente gera aviso, não reclassificação automática.

Status CS3 mantém valor bruto e mapa amigável: Working → Em atendimento; Wait on User → Aguardando usuário; Wait on External → Aguardando terceiro; Updated → Atualizado / revisar. Novos valores ficam visíveis como não mapeados. Não ordenar estados por um suposto progresso irreversível nem interpretar Updated como encerrado.

Andamento pessoal preserva o catálogo legado, incluindo Em andamento ABAP e Transferido. Remover espaços externos para comparação; manter texto original. Uma resolução pessoal cria evento conhecido, sem fingir a data de encerramento oficial. Quando houver reabertura, preservar episódios anteriores.

Estimativa e orçamento/aprovação são diferentes de esforço realizado. Texto “RND de 23h aprovada, +3h de análise” fica integralmente registrado, com proposta de componentes a confirmar. “Acima de 40h”, “abaixo de 8h” ou “estimado 00:00” não se tornam horas apontadas nem estimativa exata automática.

## 8. Contrato comum de importação e reimportação

### 8.1 Leitura e prévia

Arquivos são dados não confiáveis. Validar extensão, assinatura, tamanho, codificação, estrutura e perfil antes de interpretar. XLSM/XLSX: limitar descompressão e quantidade de células; não executar macro, fórmula, link, DDE, conexão ou URL encontrada. CSV: usar parser real, não `split(';')` por linha.

Cada carga recebe ID e hashes do arquivo e conteúdo normalizado. Registrar tipo, esquema de colunas e decisões por registro. Importar apenas o conjunto explicitamente aceito. O conjunto e sua auditoria entram numa única revisão publicada; uma falha deixa a revisão anterior ativa.

A prévia carrega a revisão-base do aplicativo. Ao confirmar, revalidar a fonte e a revisão-base. Se houve mudança, recalcular diferenças; não aplicar uma prévia antiga sobre alterações novas. Arquivos de entrada e candidatos ficam separados da base confirmada.

### 8.2 Política de valores

Coluna ausente = não enviada, preservar o valor anterior. Campo presente vazio = possível limpeza; apresentar no comparativo para confirmação quando opcional. Obrigatórios vazios são inválidos. Zero não equivale a null. Fórmula que retorna vazio não é valor digitado vazio. Campo novo desconhecido é preservado como metadado ou avisado, nunca reinterpretado arbitrariamente.

Nada desaparece por faltar na próxima extração. Registros sumidos viram informação de ausência naquela carga, sem apagar horas, notas, vínculo ou estado. Uma importação pode ser parcial; exigir registro dos filtros/escopo quando conhecido.

### 8.3 Atualizações oficiais CS3

Comparar `Last Update Time` com a versão conhecida do mesmo perfil de fonte. Mais recente: atualizar somente a lista permitida de campos oficiais. Igual e conteúdo igual: sem alteração. Igual e conteúdo diferente: conflito. Mais antigo: não regredir. Data inválida ou não comparável: revisão, não prioridade por horário de upload.

### 8.4 Conciliação de informações pessoais da planilha

Usar comparação de três estados: **B**, último valor importado; **S**, novo valor da planilha; **A**, valor atual no aplicativo. Se S = B, não há mudança da origem: manter A. Se A = B e S mudou, propor a alteração da origem. Se A = S, conciliar sem conflito. Se ambos mudaram de formas diferentes, exigir decisão. A decisão confirmada define o novo B; guardar o valor descartado na auditoria.

Os apontamentos legados não têm IDs permanentes por linha. Na primeira conciliação, atribuir UUID e guardar vínculo de origem. Nas próximas versões, usar identidade de fonte, campos estáveis, comparação de conteúdo e **multiplicidade**. Uma reordenação não cria eventos. Dois eventos iguais não viram automaticamente um; uma correspondência ambígua exige confirmação.

Hash de arquivo impede repetir uma versão idêntica; hash de linha e número de linha isolados não solucionam a identidade. Um mesmo registro com duração corrigida deve aparecer como alteração, não nova atividade silenciosa. Uma cópia do XLSM com outro nome deve oferecer associação à fonte já conhecida, sem criar base paralela automaticamente.

### 8.5 Integridade entre fontes

É permitido criar referência provisória quando há horas válidas de um chamado ainda não cadastrado. Depois, um CSV oficial deve completar o mesmo ticket, sem duplicar. `RR22112787/RR23581261` é grupo pessoal com dois candidatos, não um ID oficial. `INC`, `RITM`, `SCTASK` e `CR` pertencem a namespaces distintos; não tratar todos como IR/RR.

## 9. Perfil dos CSVs CS3

Reconhecimento por cabeçalho, não por nome de arquivo ou título. UTF-8 com BOM; ponto e vírgula; campos entre aspas; datas `DD/MM/AAAA HH:mm:ss`. Aceitar mudança de ordem das colunas, aspas escapadas e quebra de linha dentro de campo. Cabeçalhos duplicados/obrigatórios ausentes bloqueiam a carga. [F1–F2]

| Cabeçalho | Destino / regra |
|---|---|
| Incident ID / Request ID | sourceTicketId; tipo determinado pelo esquema. |
| Title | Título oficial, separado do título pessoal. |
| Status | Status oficial bruto e mapa de exibição. |
| Assigned to / Assignee | Responsável oficial normalizado. |
| Start Time | Abertura informada pela origem; não início de atividade. |
| Last Update Time | Versão de origem, valor bruto e horário local/fuso configurado. |
| Priority / Impact | Campos do incidente; não preencher artificialmente nos requests. |
| Complexity | Complexidade do request; não é prioridade de incidente. |
| Assignment Group | Grupo oficial; não determina sozinho a célula. |
| External | Referência externa bruta e candidatos a aliases, mediante regra. |
| Reference ID | Metadado opcional; não usar como chave. |
| Reported By | Identificador do solicitante; não deduzir nome. |
| Reported CI / Device CI / Affected CI | Preservar separadamente os três papéis. |
| Tag 1 a Tag 6 | Tags oficiais e suas posições. |
| Type (M/V) / Type (V) | Campo bruto adicional, sem regra inferida. |
| Escalation Status / Last Used Knowledge Source | Metadados oficiais preservados. |

Campos obrigatórios para confirmar uma linha oficial: ID, Title, Status e Last Update Time válidos. Start Time ausente ou incoerente gera pendência de cronologia; não inventar abertura. Falha em um formato não autoriza tratar o arquivo como o outro.

Primeira importação dos CSVs isolados: 3 incidentes + 13 requisições = 16. Reimportação idêntica: 16. As fontes não contêm horas nem descrição completa do atendimento; não inventar esforço, SLA ou encerramento.

## 10. Perfil específico do XLSM aprimorado

Arquivo real: `central_chamados_produtividade_aprimorado (1).xlsm`. SHA-256: `7aa0e9a0399944ed575686fca1b0f44e5117ce682f127141901ae7daa5961e35`. A especificação usa essa versão, não a v4 encontrada anteriormente na biblioteca. Evidências e mapeamentos expandidos em `referencias/interpretacao_da_planilha.md` e `contratos/`. [F3–F4]

### 10.1 Papéis das 13 abas

| Aba | Papel | Quantidade observada / regra |
|---|---|---|
| Chamados | Cadastro pessoal principal | 106 linhas com referência; uma contém dois IDs. |
| Apontamentos | Fonte primária do esforço | 333 linhas operacionais; 281 com duração numérica; 52 sem duração. |
| Follow-ups | Histórico de contatos/cobranças | 22 eventos, sem gerar esforço. |
| To Do Diário | Planejamento | 5 tarefas, sem gerar esforço. |
| Resolvidos | Registro pessoal de resolução | 70 registros; suas horas são derivadas, não somar de novo. |
| Histórico Status | Eventos pessoais observados | 16 eventos; não é histórico integral do CS3. |
| Meu desenvolvimento | Registros profissionais | 8 com descrição, 7 com data; preservar o registro incompleto. |
| Planilha1 | Comparação de versão alternativa | 97 referências também presentes em Chamados; 14 status divergentes. Excluir da carga principal. |
| Fila Follow-up | Visão derivada | 20 linhas salvas; reconstruir a fila, não importar como 20 cobranças novas. |
| Dashboard | Visão derivada | Recalcular indicadores. |
| Produtividade | Visão derivada | Recalcular indicadores. |
| Listas | Catálogos e configuração candidata | Ler propostas, sem aplicar contradições automaticamente. |
| Instruções | Documentação do legado | Contexto, não fonte superior aos registros e à configuração aprovada. |

A contagem de 323 linhas em alguns perfis anteriores corresponde a **referência preenchida na coluna B de Apontamentos**, não ao conjunto de 333 linhas operacionais. Linhas apenas com data ou fórmulas auxiliares não representam trabalho. Ler até o fim do conteúdo real, incluindo registros depois de intervalos vazios. Não confundir linhas formatadas com registros.

### 10.2 Cabeçalhos, tabelas e limites observados

| Aba | Cabeçalho observado | Tabela observada | Cuidados |
|---|---:|---|---|
| Chamados | Linha 3 | TblChamados · A3:AF494 | Campos AG:AM estão fora da tabela e precisam ser lidos. |
| Apontamentos | Linha 3 | ApontamentosTable · A3:J1021 | Linhas operacionais por conteúdo, não pelo tamanho da tabela. |
| Follow-ups | Linha 5 | TblFollowUps · A5:N500 | Resultado vazio é desconhecido. |
| To Do Diário | Linha 5 | TblToDoDiario · A5:I100 | Data e horário podem ser ausentes. |
| Histórico Status | Linha 5 | TblHistoricoStatus · A5:G316 | Há intervalos vazios; manter eventos conhecidos. |
| Resolvidos | Linha 5 | ResolvidosTable · A5:R763 | Há registros distantes do início. |
| Meu desenvolvimento | Linha 7 | TblMeuDesenvolvimento · A7:J15 | Data ausente não invalida a descrição. |

São posições de referência para os testes desta versão. O leitor deve reconhecer cabeçalhos, tabelas e colunas semanticamente; um arquivo renomeado ou uma coluna reordenada não pode quebrar o leitor. Um layout realmente diferente exige novo perfil, não aproximação silenciosa.

### 10.3 Chamados: mapeamento

A Número do Chamado → referência bruta e IDs candidatos. B Descrição → título pessoal. C Status → andamento pessoal. D Prioridade → prioridade pessoal. E Última Atualização → data pessoal/mista, distinta de Last Update Time do CSV. F Responsável → referência pessoal. G Categoria → classificação funcional, não célula. H Data de Criação → data pessoal de origem. I Próxima Ação → próximo passo. J Observações → nota importada. K Tipo → pista para validação. L RND? → texto misto. M Prioridade Original → texto legado de prioridade/complexidade.

N:AE são cálculos de aging, score, sinal de atenção, cadência, tentativas e recomendações. Recalcular a partir de regras confirmadas. AF Status Monitor (VBA) é campo técnico. AG Data Resolução é resolução pessoal informada. AH:AM contêm esforço e produtividade derivados; usar somente para reconciliação. Não criar saldo inicial dessas colunas quando os detalhes em Apontamentos já estiverem importados.

Uma linha com múltiplos IDs gera um registro de grupo pessoal e vínculos candidatos. O texto pessoal compartilhado permanece no grupo até decisão de vinculação; não multiplicar notas automaticamente em dois tickets nem fundir suas identidades oficiais.

### 10.4 Apontamentos: mapeamento e natureza das células

A Data → data de trabalho. B Número do Chamado → referência(s). C Descrição → texto de atividade ou título calculado. D Tipo de Atuação → categoria operacional bruta/normalizada. E Horas → duração em fração de dia. F Resultado/Status → informação declarada ou consulta ao cadastro. G Observações → anotação pessoal. H:J são agrupamentos de calendário a recalcular.

Nas 323 linhas com referência, 298 têm fórmula em F. Portanto, F não fornece automaticamente o status histórico do dia. C também pode ser fórmula de busca que retorna somente o título do chamado. Armazenar fórmula, valor salvo e natureza calculada; não transformar uma consulta em declaração histórica.

Não depender de motor de recálculo do Excel. O parser deve expor fórmula, valor bruto e valor salvo quando presentes. Fórmulas legadas não são executadas. Resultados ausentes/errados geram pendência; relações conhecidas podem ser reconstruídas pelo domínio com indicação de derivação. A documentação do SheetJS distingue fórmulas de valores e não torna sua simples leitura equivalente a recalcular a planilha. [S1]

Tipos como FUP/fup/fup 2, GMUD/gmud, EF e RND precisam de dicionário explícito, preservando a grafia original. FUP não define por si só destinatário ou célula. A observação LANÇADO não confirma integração.

### 10.5 Abas complementares: campos que devem ser preservados

**Follow-ups:** Data Follow-up; Número do Chamado; Descrição; Tipo; Tentativa #; Canal; Responsável; Resultado; Data da Resposta; Próxima Ação; Observação / Resumo; Status no momento; Próximo FU sugerido; Encerramento recomendado? Consultas atuais e sugestões calculadas não são eventos independentes. Sem resultado não significa sem resposta; “Com resposta” sem data permanece incompleto.

**To Do Diário:** Tarefa; Relacionada ao chamado?; Nº Chamado; Prioridade; Horário; Status; Check de conclusão; Observações rápidas; Data. Divergência entre status e check gera pendência; não perder um dos valores originais.

**Histórico Status:** Data/Hora; Número do Chamado; Status Anterior; Novo Status; Usuário; Observação; Origem. Preservar o usuário registrado como evidência do legado, separado do usuário que fez a importação. Data/hora sem fuso não vira instante exato universal por suposição.

**Resolvidos:** Número do Chamado; Descrição; Tipo; Categoria; Prioridade; Responsável; Data de Criação; Data Resolução; Tempo em Aberto; Horas Apontadas; Qtde Apontamentos; FUs Realizados; Status Final; Observações; Mês; Semana; Ano; Registrado em. Preservar fatos pessoais e snapshots; duração, quantidade e agrupamentos são derivados e não acrescentam esforço.

**Meu desenvolvimento:** Data; Tipo de atividade; Tema; Descrição do que fiz; Pessoa / área impactada; Resultado / impacto; Competência demonstrada; Relevância para one a one; Próximo passo; Status.

### 10.6 Evidências que viram testes de regressão

- E4 = 180 min; E5 = 90 min; E142 = 273 min; E316 = 30 min. Não arredondar 4h33 para 4h30.
- 281 durações somam **33.693 minutos = 561h33 brutas**, entre 18/05/2026 e 31/08/2026. É soma anterior à conciliação, não total homologado nem horas confirmadas no CS3.
- Há atividades até 04/09/2026, mas sem duração numérica em setembro nesse arquivo. Preservar 52 linhas operacionais sem duração.
- A4 de Chamados contém RR22112787/RR23581261; B215 de Apontamentos contém IR32043578 ; RR23811390, com 120 min; B294 contém RR23300936 / RR22812009, com 90 min.
- B240 contém IR32064696_INC3408222; B310 contém CR2238_RR23563421; B170 contém SCTASK1257370. Interpretar namespaces sem fabricar tickets.
- B vazia nas linhas 155, 176 e 194 não autoriza descartar duração. Na descrição C194 há dois incidentes; sugerir vínculos, não escolher um arbitrariamente.
- Pares candidatos a repetição: 263/267, 264/268, 265/269, 266/270. Manter como pendência, sem exclusão automática.
- 81 estados Resolvido em Chamados e 70 registros em Resolvidos. Preservar os 11 sem correspondência, sem criar data “agora”.
- Sete estados Transferido com espaço final precisam de normalização; o zero salvo num indicador não é fonte confiável.
- 15 células #REF! em Apontamentos e quatro #VALUE! em Chamados; não descartar linhas válidas. A286/E286 preservam data e 270 min apesar de H:J com erro.
- Dez fórmulas nas linhas 267:271 referenciam arquivo externo. Não buscar esse arquivo nem executar o vínculo.
- Datas de resolução anteriores à criação e datas futuras geram pendência de cronologia; excluir esses intervalos dos indicadores de prazo até revisão, sem excluir o registro.
- Listas!K3 menciona três cobranças IR, enquanto cálculos usam duas. Não assumir uma das regras nem encerrar automaticamente.

Os números acima pertencem somente ao hash desta versão. Em versões futuras, reavaliar os dados e conservar os testes de comportamento; não exigir que uma planilha atualizada continue tendo 106 linhas ou 281 durações.

### 10.7 VBA

A análise anterior foi estática; nenhum VBA foi executado. Há rotinas que recalculam, recriam filas e reconstruem resoluções, além de discrepâncias entre eventos e abas. Não transportar o VBA diretamente para a aplicação. Implementar regras próprias: mudança de status gera evento; resolução preserva histórico; totais vêm de detalhes; nenhuma reconstrução apaga a história anterior. A documentação de macros do parser não autoriza execução do código embutido. [F4, S2]

## 11. Conciliação e qualidade como funções do produto

A ferramenta precisa de uma caixa de pendências, não de mensagens que somem após o upload. Categorias: identidade composta, referência sem cadastro, possível duplicata, duração ausente/inválida, rateio indefinido, data incoerente, status desconhecido, divergência manual, origem calculada, erro de fórmula e regra de follow-up não confirmada.

Uma pendência deve dizer o que ocorreu, qual o impacto no total e quais decisões são possíveis. A confirmação em lote não pode ocultar uma decisão destrutiva. Registros sem impedimento podem ser aceitos separadamente; os demais ficam guardados como candidatos com sua evidência. Cada conjunto confirmado tem revisão atômica.

Duplicidade candidata de horas impede homologar aquelas linhas até escolha entre manter ambos, vincular a um único evento ou ignorar um candidato. Rateio pendente não precisa impedir confirmação do esforço diário, desde que identidade da atividade, data e duração sejam válidas; apenas impede atribuição final por ticket. Ausência de célula não elimina esforço: vai para Sem classificação.

No dashboard, números confirmados e prévia bruta não se misturam. Em carga com pendências, informar a quantidade excluída dos totais e disponibilizar a prévia separada. Não usar o somatório bruto de 561h33 como KPI final de produtividade.

## 12. Follow-ups, tarefas e desenvolvimento

Importar os eventos reais da planilha e permitir novos registros. A fila é sempre derivada. Só contar tentativa sem resposta quando o resultado for explicitamente compatível e a sequência/datas forem válidas. Uma resposta pode alterar o acompanhamento, mas não deve apagar contatos anteriores.

Regras de cadência, dias corridos/úteis e limite de tentativas são configuração versionada por tipo. Até confirmação, manter `ruleStatus=unconfirmed`, não calcular uma suposta elegibilidade automática para encerrar. A pessoa ainda pode agendar uma próxima ação manual com data explícita. Mesmo após regra confirmada, o sistema recomenda acompanhamento; não encerra chamados no CS3.

Concluir uma tarefa, marcar follow-up ou registrar impacto profissional não acrescenta tempo. Eventos podem ser vinculados a apontamentos existentes, sem criar cópia. A aba de desenvolvimento é preservada como módulo simples de notas estruturadas; não é necessário construir avaliação de desempenho ou ranking de pessoas.

## 13. Métricas e reconciliação de totais

| Indicador | Definição e exclusões |
|---|---|
| Horas da data | Minutos confirmados elegíveis por workDate. Não usar timestamp de digitação. |
| Faltante / excedente | Diferença em relação à meta específica da data. Nunca negativos simultâneos. |
| Dias vencidos incompletos | Datas anteriores a hoje, após início do controle, com meta > 0 e esforço abaixo da meta. |
| Horas por célula | Célula histórica do apontamento; incluir Geral e Sem classificação na reconciliação. |
| Horas por chamado | Apenas alocações confirmadas; compartilhadas sem rateio mostradas separadamente. |
| Maior consumo | Ordenar esforço do período, mantendo acesso aos eventos e suas alocações. |
| Estimado x realizado | Só quando estimativa foi confirmada; aprovação RND separada; “sem estimativa” não é zero. |
| Chamados por status | IDs distintos, separando status oficial e pessoal; contar provisórios à parte. |
| Resoluções pessoais | Eventos conhecidos; contar tickets distintos e eventos de resolução separadamente se houver reabertura. |
| Tempo até resolução pessoal | Intervalo entre datas pessoais válidas; informar quantos casos foram excluídos por falta/incoerência. |
| Última atualização CS3 | Data da origem do chamado e da última importação separadas. |
| Última atividade pessoal | Última nota, apontamento ou ação, com critério definido; não se confunde com atualização CS3. |
| Próximas ações vencidas | Prazo pessoal vencido e ação pendente, não SLA. |
| Saúde da importação | Última carga por fonte, versões, aceitos, rejeitados, conflitos e pendências restantes. |

Gráficos preferenciais: barras diárias com linha/meta; barras horizontais de horas por célula; barras por status; tabela ordenada de tickets por esforço. Cores da marca com rótulos e tabelas alternativas. Não usar gráficos 3D, velocímetros decorativos ou proporções sem denominador.

Filtros de período afetam esforço por data trabalhada, e resoluções por data de resolução. Não aplicar o mesmo filtro temporal a entidades diferentes sem declarar a semântica. Em períodos sem registros, diferenciar “zero confirmado” de “fonte ainda não importada”.

Exportar CSV UTF-8 e relatório XLSX de conferência, além de resumo diário copiável. Incluir duração em minutos e rótulo legível. Textos potencialmente interpretáveis como fórmulas devem ser exportados como texto. Exportar não equivale a enviar horas ao CS3.

## 14. Arquitetura de referência

### 14.1 Componentes

Proposta final: **React + TypeScript + Vite**, aplicação de página única; MSAL Browser para autenticação; adaptador Microsoft Graph; parser CSV robusto; parser local OOXML/XLSM em Web Worker; domínio puro e validado; persistência em revisões JSON no OneDrive pessoal. Não existe banco de chamados em um servidor externo.

Usar biblioteca de componentes acessíveis ou primitivas próprias bem testadas, estilizadas pelos tokens. Para XLSM, preferir versão oficial e verificada do SheetJS CE, desde que preserve valores brutos, fórmulas e valores salvos exigidos pelo perfil. Se a biblioteca perder informação indispensável, complementar com leitura OOXML segura ou escolher alternativa documentada, mantendo o contrato. Não depender do pacote instalado sem verificar sua origem/versão. [S1–S2]

Hospedagem estática HTTPS separada armazena apenas código e recursos públicos. Azure Static Web Apps é uma opção de publicação, não requisito de assinatura ou licença já existente. Outra hospedagem estática autorizada é possível sem mudar o destino dos dados. Não contratar nem prometer gratuidade permanente. [M8]

A página inicial e o código podem ser publicamente acessíveis, mas dados exigem autorização Microsoft. Não confundir esconder o botão com proteção. O Graph aplica as permissões da conta; o aplicativo adicionalmente valida workspace, drive e origem em cada operação. Uma segunda conta nunca carrega a memória/cache da primeira.

### 14.2 Estrutura recomendada do repositório

```text
src/
  app/                    composição, rotas, navegação e providers
  design/                 tokens, componentes, acessibilidade e estados visuais
  features/
    day/ tickets/ dashboard/ planning/ development/ settings/
    imports/              assistente de carga e caixa de conciliação
  domain/
    entities/             tipos e validadores
    time/                 duração, jornada, calendário e alocação
    reconciliation/       identidade, multiplicidade, comparação em três estados
    metrics/              agregações puras e verificáveis
  adapters/
    identity/             MSAL, conta ativa e consentimento
    graph/                chamadas, erros e renovação de URLs temporárias
    storage/              revisão, ponteiro, idempotência e recuperação
    sources/              CSV, XLSM e contrato de conector futuro
  workers/                leitura e interpretação de arquivos
  tests/                  unidade e integração sintética
public/                    apenas recursos públicos; nunca insumos privados
tests/e2e/                jornadas e concorrência
fixtures/synthetic/       exemplos inventados, identificados como sintéticos
docs/                     decisões, operação e evidências de testes
```

Bibliotecas devem ter versões fixadas e lockfile. Separar domínio da interface e do fornecedor. Não criar um componente monolítico que misture parser, login, gravação e dashboard. Não embutir dados reais no código para fazer os testes ou a demonstração parecerem completos.

### 14.3 Contratos de aplicação

Definir operações tipadas equivalentes a: `readWorkspace`, `previewImport`, `reconcileImport`, `commitImport`, `createTimeEntry`, `editTimeEntry`, `cancelTimeEntry`, `updatePersonalTicketState`, `recordFollowUp`, `saveTask`, `saveDevelopmentRecord`, `exportWorkspace` e `restoreWorkspace`.

Todas as mutações recebem `operationId` estável e versão-base. Importações recebem decisões explícitas e assinatura da prévia. Saídas distinguem confirmado, conflito, não autorizado, quota, inválido e resultado incerto. Um erro de transporte não é retorno de sucesso.

## 15. OneDrive pessoal: autenticação e leitura das fontes

### 15.1 Login

Aplicação registrada para aceitar contas Microsoft pessoais, fluxo Authorization Code com PKCE e biblioteca MSAL. Para esta implantação, usar autoridade de consumidores compatível com o registro. Não usar client secret no navegador, autenticação por senha fornecida ao aplicativo ou fluxo implícito como atalho. Redirecionamentos devem corresponder ao registro. [M1]

Configurações públicas: client ID real, autoridade, redirect URI e endereço da interface. Não são credenciais secretas, mas não inventar seus valores. Na ausência de configuração, exibir “Integração Microsoft não configurada”, com modo demonstrativo separado.

Cache de autenticação gerenciado pelo MSAL, preferindo memória e apenas estado transitório necessário ao redirecionamento. Não serializar tokens em JSON do OneDrive ou logs. Renovação silenciosa pode falhar: solicitar reautenticação, sem perder o formulário em memória e sem afirmar salvamento.

### 15.2 Permissões e pasta da aplicação

Começar pelo escopo delegado `Files.ReadWrite.AppFolder`, destinado à pasta especial da aplicação. A documentação informa suporte do app folder ao OneDrive doméstico e observa que a própria pessoa pode alterar ou remover seus arquivos. A prova técnica deve verificar todas as operações reais com esse escopo, pois tabelas genéricas de alguns endpoints listam permissões mais amplas. Não ampliar silenciosamente. [M2]

Dados de operação, revisões e candidatos aceitos ficam na pasta retornada por `GET /me/drive/special/approot`, nunca num ID fixo de outra conta. Nome planejado de aplicativo: Central de Chamados. Não presumir o nome traduzido da pasta Apps; usar o ID retornado.

### 15.3 Vincular a planilha

Oferecer três formas claramente distintas:

1. Upload manual do arquivo local para interpretação; não exige ler outras pastas do OneDrive.
2. Vincular um arquivo dentro da pasta da aplicação; a pessoa coloca ou autoriza uma cópia ali e continua usando essa versão conscientemente. Não mover o original sem autorização.
3. Vincular o arquivo no local atual, fora da pasta da aplicação, mediante consentimento incremental de leitura. Explicar o escopo real: `Files.Read` não significa uma permissão exclusiva daquele único arquivo. O aplicativo limita sua lógica ao item selecionado, mas não promete isolamento que o OAuth não oferece. [M3]

Salvar vínculo por `driveId + itemId`, não por caminho/nome. Renomear arquivo não deve desconectar o vínculo quando o ID permanecer. Remoção, substituição ou ID diferente requer nova confirmação. Registrar última versão lida e hash; nenhuma credencial da planilha.

### 15.4 Download e alteração

No navegador, obter os metadados e `@microsoft.graph.downloadUrl`, usar imediatamente a URL temporária sem anexar o bearer token a ela, e não gravar essa URL em estado, log ou repositório. O fluxo documentado evita o problema de redirecionamento CORS de `/content` em aplicações JavaScript. [M3]

Ler metadados antes e depois do download. Se a versão mudou durante a leitura, repetir de forma limitada e invalidar a prévia anterior. Comparação de eTag/cTag e hash evita releitura desnecessária, mas não substitui conciliação dos registros. O hash é calculado sobre os bytes obtidos.

O app pode verificar a revisão operacional ao ganhar foco e a cada 60 segundos enquanto estiver visível; fonte XLSM vinculada pode ser verificada a cada cinco minutos enquanto a tela estiver ativa, com política conservadora e retentativas limitadas. Detectar uma alteração exibe “Nova versão disponível”; aplicar dados exige prévia/confirmar. Não prometer trabalho com navegador fechado.

### 15.5 Não usar a API de workbook como dependência

A API `workbook/createSession` documenta conta Microsoft pessoal como não suportada. Portanto, a arquitetura lê os bytes XLSM e interpreta localmente; não pressupõe sessões Excel na nuvem, recálculo de fórmulas ou execução de VBA. [M4]

## 16. Persistência verificável sem banco externo

### 16.1 Decisão proposta: revisões imutáveis e um ponteiro remoto

Usar documentos de estado completos, imutáveis, por revisão; cada revisão contém as entidades confirmadas, referências aos candidatos, recibos de operação e metadados. O conjunto é publicado alterando **um único ponteiro remoto**, não substituindo vários arquivos independentes como se houvesse uma transação SQL.

Para esta conta pessoal, a opção de implementação a provar é guardar o ponteiro curto em `description` de uma pasta dedicada vazia `state-head`. O Graph documenta `description` como leitura/gravação no OneDrive pessoal, `eTag` para metadados/conteúdo e `If-Match` em PATCH de propriedades. **A combinação em um protocolo de commit é decisão deste projeto, não um recurso transacional anunciado pela Microsoft.** [M5–M6]

Não usar a descrição para textos de chamados; apenas schema, workspace, ID da revisão, ID do arquivo e hash. Manter o ponteiro pequeno, com limite de projeto de 768 caracteres, validado na prova técnica. Não colocar filhos em `state-head`. Revisões e arquivos de fonte ficam em pastas irmãs.

Estrutura lógica:

```text
approot/
  state-head/             pasta vazia; description = ponteiro da revisão ativa
  revisions/              documentos JSON imutáveis, nomes únicos
  sources/                cópias de fontes quando autorizadas e evidências
  candidates/             candidatos de importação, referenciados por revisão
  exports/                relatórios solicitados
  recovery/               checkpoints e recibos de recuperação
```

Essa decisão elimina a inferência incorreta de que um PUT genérico de conteúdo obrigatoriamente respeita If-Match. Caso a prova técnica rejeite o protocolo proposto, a integração fica em modo não produtivo. A IA deve documentar a falha e propor alternativa de commit condicional comprovada, sem voltar silenciosamente ao salvamento por sobrescrita.

### 16.2 Protocolo de gravação

1. Ler o ponteiro `description` e o `eTag` de `state-head`; carregar a revisão por ID e validar hash, schema e workspace. Ler novamente o ponteiro se necessário para assegurar a revisão-base apresentada.
2. Verificar `operationId`. Se já há recibo na revisão ativa ou em sua história, retornar o resultado conhecido, sem repetir a operação.
3. Aplicar a mutação sobre a revisão-base em memória. Validar invariantes, versões de entidades, regras de importação e totais. Dependências grandes, como candidatos e fontes, devem ser gravadas e verificadas antes de publicar a revisão.
4. Gravar uma nova revisão em nome único, sem substituir qualquer revisão existente. Ler os bytes gravados e conferir SHA-256. A simples conclusão do upload não publica o estado.
5. Publicar o novo ponteiro com `PATCH /me/drive/items/{headId}`, enviando somente a nova descrição e `If-Match` com o eTag lido. Não fazer PATCH sem a condição.
6. Se retornar 412, outra operação venceu. Não insistir cegamente com o ponteiro novo. Recarregar a revisão atual e reconciliar: adição independente pode ser reaplicada; edição do mesmo campo exige conflito. A revisão não publicada permanece identificável, sem entrar no dashboard.
7. Após confirmação, verificar a revisão ativa ou uma revisão descendente que contenha o recibo da operação. Só então apresentar “Salvo no OneDrive”. Uma operação posterior legítima não invalida o recibo anterior.

Um upload imutável interrompido não modifica a revisão ativa. Um ponteiro nunca deve apontar para conteúdo ainda não confirmado. Uma importação com milhares de mutações precisa de uma revisão única ou de um manifesto que referencie dependências completas, nunca aparição gradual no dashboard como se a carga estivesse concluída.

### 16.3 Timeout, retentativa e inicialização

Se a resposta do PATCH for perdida, não repetir a mutação com novo ID. Ler o ponteiro e seus recibos: a operação pode ter sido confirmada. Se não for possível determinar o resultado, exibir “Confirmação pendente” e oferecer nova verificação. Manter dados de formulário em memória, sem fingir sincronização offline.

Inicialização é uma operação explícita. Criar pastas de nome fixo com conflito `fail`, tratando a disputa por criação como leitura da pasta existente, nunca `rename`. Duas máquinas inicializando ao mesmo tempo não podem criar bases paralelas. Head vazio com revisões já existentes é situação de recuperação, não permissão para zerar a base. Nunca identificar a “revisão mais nova” apenas pelo relógio do cliente.

### 16.4 Escala e retenção

Revisões completas são uma decisão simplificadora para uso individual, não uma garantia de escala ilimitada. Meta de validação: 2.000 tickets, 10.000 apontamentos e revisão de até 10 MiB, medidos com dados sintéticos. Ao se aproximar de limite validado, alertar e exigir medição/otimização antes de ampliá-lo. Arquivos de fonte ficam fora do documento de estado para evitar replicar o XLSM a cada apontamento.

Não apagar revisões automaticamente no primeiro escopo. Mostrar consumo e oferecer retenção explícita depois de checkpoint e teste de restauração. Auditoria pode crescer e deve ser medida. Recibos necessários à idempotência e tombstones de cancelamentos não podem ser removidos enquanto forem usados na conciliação.

### 16.5 Prova técnica bloqueante

Antes de usar dados reais: testar criação, leitura, upload, PATCH condicionado com escopo aprovado, conflito em dois clientes, resposta perdida, arquivo removido, alteração externa, hash inválido e recuperação. Em 100 disputas sintéticas de publicação a partir do mesmo eTag, exigir um vencedor por base e nenhum recibo/registro perdido; depois conciliar a operação perdedora e conferir ambas.

A documentação não substitui essa execução na conta real. Logs de testes não devem conter tokens nem textos privados. Se o protocolo de ponteiro, o escopo ou as características de leitura não forem confirmados, o sistema permanece demonstrativo/somente leitura, com relatório do bloqueio. Não colocar produção em risco para cumprir uma aparência de entrega completa.

## 17. Segurança, privacidade e recuperação

Dados de trabalho ficam na conta autorizada. Código, telas, rótulos e recursos visuais podem ser hospedados; chamados, apontamentos, arquivo XLSM e relatórios não podem fazer parte do build. Nenhum rastreador ou captura de sessão por padrão. HTTPS, CSP restritiva, texto importado escapado e dependências verificadas.

No navegador: processar arquivo em Worker; não avaliar fórmulas com eval; não abrir hiperligações, conexões externas ou macro. Limites iniciais de projeto: 20 MiB por XLSM/XLSX, 10 MiB por CSV, 150 MiB descomprimidos e 1 milhão de células examinadas. Exceder limite gera erro compreensível antes da importação, não processamento ilimitado. Validar o ZIP contra caminhos maliciosos, entrada duplicada e expansão excessiva.

Não persistir dados de trabalho em localStorage, IndexedDB ou cache de Service Worker no primeiro escopo. Cache apenas de recursos estáticos públicos; dados e URLs temporárias não entram. Logout limpa memória, revoga estado local e respeita a sessão do provedor. Trocar conta descarta a base anterior da memória antes de carregar outra.

Permissões amplas, caso indispensáveis para um arquivo externo, exigem consentimento específico e explicação. Não criar links públicos. O usuário controla o OneDrive e pode alterar arquivos por fora: hash e histórico detectam algumas inconsistências, mas não representam auditoria inviolável contra o proprietário da conta. Não prometer criptografia ponta a ponta que não foi implementada.

Backup: revisões preservadas, checkpoint solicitado e exportação recuperável com manifesto e hashes. Cópias na mesma conta não protegem contra perda total da conta; exportação independente depende de destino autorizado. Restaurar é criar uma revisão nova a partir do checkpoint, com prévia das perdas potenciais e confirmação, preservando revisão anterior para retorno. A simples restauração integral é diferente de desfazer uma importação: o desfazimento seletivo só pode reverter campos não alterados posteriormente, sem apagar apontamentos novos.

Resposta a erros: 401 reautenticar; 403 explicar permissão sem ampliá-la automaticamente; 404 oferecer rever vínculo/recuperar; 409/412 conciliar; 429 respeitar Retry-After; 5xx retentativa limitada com espera; quota insuficiente não é salvamento. Não efetuar loops infinitos nem descartar a revisão anterior.

## 18. Requisitos não funcionais

Metas de engenharia, a medir e documentar, não desempenho prometido: interface utilizável em 360, 390, 768, 1.280 e 1.440 px; atualização de filtro em memória em até 300 ms no conjunto de teste; importação do XLSM atual com feedback contínuo e Worker sem bloquear a interface; p95 de salvamento remoto em até cinco segundos em rede estável, com latência/condições registradas. Falhas ou quota podem ultrapassar a meta e devem ser visíveis.

Validar navegadores atuais Chrome/Edge e Safari, incluindo retorno de login e download no celular. Testar teclado, leitor de tela e zoom de 200%. Os dados devem continuar acessíveis sem animações. Não apresentar uma tela em desktop como evidência de usabilidade mobile.

Separar testes sintéticos de testes com o Graph real. Build e teste unitário aprovados não comprovam persistência, concorrência, licença tipográfica, autorização do cliente ou publicação.

## 19. Evolução futura do CS3

A primeira evolução é uma extensão assistida: a pessoa entra no CS3 no próprio navegador, aciona a extração autorizada e encaminha os arquivos ao mesmo pipeline do aplicativo. Não transmitir cookies/senha CS3 ao OneDrive. Solicitar acesso apenas ao domínio/aba necessário. Não implementar scraping de uma página cujo fluxo autenticado não foi examinado.

Um conector por API depende de documentação e autorização do cliente; nenhuma API CS3 foi confirmada. Na ausência de API, automação de navegador exige avaliação de rede/VPN, sessão, MFA e política corporativa. Não contornar esses controles nem prometer execução 24 horas em uma aplicação estática sem serviço agendador.

Contrato de fonte futura: manifestar tipo, data de obtenção, perfil, escopo e conteúdo; a importação continua validando, conciliando e publicando uma revisão. Nenhum conector pode chamar diretamente uma rotina que substitui os apontamentos. Integração bidirecional e envio de horas são escopos futuros separados.

## 20. Plano de execução por etapas

| Etapa | Entrega verificável | Dependências e condição de avanço |
|---|---|---|
| 0. Preparação | Inventário, hashes, leitura dos contratos, decisão de biblioteca e matriz de testes | Nenhum dado real no repositório; escopo e fontes preservados. |
| 1. Prova de OneDrive | Login pessoal, pasta, revisão, ponteiro condicionado e teste de duas sessões | Bloqueia uso produtivo se não houver integridade remota. Não bloqueia trabalho demonstrativo separado. |
| 2. Domínio e parsers | Tipos, validadores, CSV, XLSM, identidade, unidades e proveniência | Testes unitários e baseline do XLSM; original inalterado. |
| 3. Importação/conciliação | Prévia, comparação em três estados, multiplicidade, pendências e commit | Reimportação não duplica; atualizações não apagam dados pessoais. |
| 4. Rotina diária | Meu dia, chamados, notas, células, jornada, tarefas, follow-ups e desenvolvimento | Todos os registros confirmados persistem e reaparecem noutra sessão. |
| 5. Dashboard e exportação | Métricas reconciliadas, gráficos acessíveis e relatórios | Totais por eixo fecham; pendências não ficam ocultas. |
| 6. Homologação | Regressão completa, acessibilidade, segurança, recuperação e desempenho | Evidências reais, limitações documentadas e correções aplicadas. |
| 7. Publicação autorizada | Build, URL HTTPS real, redirect URI, guia de operação e teste final | Não declarar pronto antes de abrir o endereço publicado e confirmar a rotina. |

Para cada etapa, implementar testes antes das regras críticas, executar e guardar evidência. Relatar o que passou, falhou e não foi executado. Dados demonstrativos devem ser sintéticos, identificados e isolados; nunca se misturam com uma pasta real do usuário.

Na entrega da IA: código-fonte, lockfile, instruções, testes, configurações públicas necessárias, relatório de segurança/limitações, procedimento de recuperação e link publicado somente quando efetivamente existente. Nenhum campo de credencial deve estar preenchido por exemplo fictício que aparente ser real.

## 21. Matriz de aceite e critérios de liberação

A matriz completa está em `contratos/criterios_aceite.json` e `CHECKLIST_DE_ACEITE.md`. Cada caso tem pré-condição, ação e resultado esperado. O artefato é uma especificação de testes; todos iniciam como **não executados no aplicativo**, pois não há implementação nesta entrega.

### 21.1 Cenários obrigatórios

| ID | Caso | Resultado esperado |
|---|---|---|
| AC-001 | CSV inicial | 16 identidades oficiais: 3 IR e 13 RR; nenhuma hora criada. |
| AC-002 | CSV repetido | Mesmos 16 tickets; zero duplicação de notas, horas ou eventos fictícios. |
| AC-003 | CSV oficial novo | Somente campos oficiais mudam; registros pessoais permanecem. |
| AC-004 | Versão antiga | Não regredir; registrar a decisão por linha. |
| AC-005 | Empate divergente | Conflito explícito; nenhuma decisão pela ordem do upload. |
| AC-006 | Ausente na carga | Preservar ticket, horas e status; não encerrar por ausência. |
| AC-007 | Vazios e ausentes | Ausente preserva; limpeza opcional requer prévia e decisão. |
| AC-008 | CSV real | Manter valores corretos; não dividir o conteúdo da descrição. |
| AC-009 | Formato incompatível | Bloquear o perfil; não inferir outra origem pelo título. |
| AC-010 | IR/RR e namespaces | Tipo vem do esquema; aliases não viram tickets CS3 adicionais. |
| AC-011 | Arquivo de referência | 13 abas; hash do original inalterado; zero macro/link executado. |
| AC-012 | Cadastro e cópia | 106 linhas principais; 97 da cópia não acrescentadas; 14 divergências sinalizadas. |
| AC-013 | Campos fora da tabela | Capturar data de resolução pessoal e reconhecer totais derivados. |
| AC-014 | Linhas distantes | Preservar 70 resoluções e 16 eventos da versão de referência. |
| AC-015 | Linhas operacionais | 333 operacionais, 281 com duração, 52 sem; 323 com referência é outro denominador. |
| AC-016 | Conversão 3h | 180 minutos, não 0.125 hora. |
| AC-017 | Precisão 4h33 | 273 minutos; não arredondar para 270. |
| AC-018 | Conferência bruta | 33.693 minutos/561h33 brutas; não rotular como homologadas ou enviadas. |
| AC-019 | Duração ausente | Preservar incompletos; excluir dos confirmados; não preencher 8h ou 0 de trabalho. |
| AC-020 | Data/calendário | Data civil correta; serial fictício 60 não vira evento válido; sem deslocamento por UTC. |
| AC-021 | Meta 7h30 | Realizado 7h30; faltam 30 min; excedente zero. |
| AC-022 | Meta 8h15 | Excedente 15 min; não truncar a duração nem transferir saldo. |
| AC-023 | Exceção de jornada | Férias não geram falta; parcial usa 240; dias futuros não são atraso. |
| AC-024 | Compartilhamento | 120 no dia; nenhum ticket recebe 120 integral; 120 em compartilhadas sem rateio. |
| AC-025 | Rateio confirmado | Total diário 120; tickets 75/45; sobra zero; 75+60 é rejeitado. |
| AC-026 | Horas sem cadastro | Preservar esforço e referência provisória; CSV posterior completa sem duplicar. |
| AC-027 | Sem ID literal | Preservar horas internas; sugerir os vínculos de C194 sem escolher arbitrariamente. |
| AC-028 | Dupla soma | Somar apenas esforço detalhado; não adicionar totais ou saldos duplicados. |
| AC-029 | Estado LANÇADO | Reported posted pessoal; nunca confirmação técnica de integração. |
| AC-030 | Cancelamento | Sai do total; mantém registro e auditoria; não some da história. |
| AC-031 | Duas referências na linha | Preservar grupo pessoal e dois candidatos; não fundir tickets oficiais. |
| AC-032 | Referência composta | Namespaces distintos, relações explícitas e sem ticket fictício. |
| AC-033 | Espaços e caixa | Mesma identidade normalizada; preservar bruto; não depender de título. |
| AC-034 | Reordenação de linhas | Nenhuma nova hora; IDs internos e multiplicidade mantidos. |
| AC-035 | Candidatos repetidos | Quatro pendências; não excluir nem homologar automaticamente. |
| AC-036 | Correção de duração | Propor correção antes/depois, não criar outro esforço silencioso. |
| AC-037 | Três estados | Manter mudança local quando S=B; conflito quando A e S divergem de B. |
| AC-038 | Mudança durante prévia | Invalidar/recalcular prévia; não sobrescrever. |
| AC-039 | Cópia renomeada | Propor associação à fonte existente; não duplicar base pela mudança de nome. |
| AC-040 | Erro auxiliar | Manter data e 270 min; recalcular agrupamentos. |
| AC-041 | Fórmula de status | Guardar como consulta calculada; não criar status histórico naquela data. |
| AC-042 | Link externo | Nenhum acesso externo; valor salvo/proveniência e pendência quando necessário. |
| AC-043 | Resoluções divergentes | 11 casos sem registro correspondente, sem data fabricada. |
| AC-044 | Transferidos | Sete normalizados, não zero por confiar no cache. |
| AC-045 | Datas incoerentes | Não calcular atraso desde 1900 nem intervalo negativo; sinalizar exclusão do indicador. |
| AC-046 | Precedência manual | Manter manual; atualizar sugestão e mostrar divergência. |
| AC-047 | Histórico | Antigas continuam AMS; novas sugerem Squad; desconhecidas não são retroclassificadas. |
| AC-048 | EXTRABASELINE | Revisão manual; não AMS por conter BASELINE. |
| AC-049 | Reconciliação de totais | Soma das cinco classes igual ao total confirmado, sem dupla contagem. |
| AC-050 | Sem esforço automático | Nenhum apontamento criado; ação de apontar exige duração e confirmação. |
| AC-051 | Regra IR divergente | Regra não confirmada; sem encerramento automático; data manual permitida. |
| AC-052 | Resultado desconhecido | Não contar ausência como Sem resposta; preservar pendência. |
| AC-053 | Conteúdo incompleto | Preservar os 8; um em sem data; sem gerar horas. |
| AC-054 | Conta pessoal | Fluxo real funciona sem depender de conta corporativa/workbook session. |
| AC-055 | Menor permissão | Operações comprovadas nesse escopo ou bloqueio documentado; sem expansão silenciosa. |
| AC-056 | Fonte fora da pasta | Não ler; explicar alternativas e alcance real de Files.Read. |
| AC-057 | Troca de conta | Nenhum dado de A apresentado ou enviado para B. |
| AC-058 | Conteúdo perigoso | Texto escapado; nenhuma execução; célula de exportação tratada como texto. |
| AC-059 | Privacidade do build | Nenhum CSV/XLSM/token/registro real no público, bundle ou logs. |
| AC-060 | ZIP/arquivo inválido | Interromper com erro compreensível, sem gravar base parcial. |
| AC-061 | Duas sessões | Um vencedor por base; perdedor recebe conflito; após conciliação ambas operações preservadas. |
| AC-062 | Falha no upload | Revisão anterior continua ativa; nenhuma carga parcial no dashboard. |
| AC-063 | Resposta perdida | Consultar recibo/ancestralidade; não duplicar; informar incerto quando não confirmar. |
| AC-064 | Inicialização concorrente | Uma identidade de base; sem state-head renomeado e sem bases paralelas. |
| AC-065 | Arquivo alterado/excluído | Entrar em recuperação; não recriar base vazia silenciosamente. |
| AC-066 | Quota e throttling | Erro/espera limitada; manter formulário; não declarar salvo. |
| AC-067 | Restauração | Nova revisão consistente; anterior preservada; totais conferidos. |
| AC-068 | Fonte durante download | Detectar mudança; repetir de modo limitado; não confirmar versão ambígua. |
| AC-069 | Paleta | HEX base corretos; texto escuro em azul/menta; sem paleta alternativa arbitrária. |
| AC-070 | Fonte | Fallback declarado; não afirmar uso da fonte nem incluí-la sem licença. |
| AC-071 | Navegação acessível | Sem conteúdo crítico cortado; foco e rótulos funcionam; gráficos têm alternativa. |
| AC-072 | Sem rede e vazio | Estados diferentes e mensagens específicas; não confundir com zero de trabalho. |
| AC-073 | Conexão e publicação | Só declarar integrado após confirmar login, gravação e leitura noutra sessão. |
| AC-074 | Original preservado | Hashes finais iguais; fontes reais não reescritas. |

Gates obrigatórios: preservação de esforço; reimportação idempotente; conciliação de identidades compostas; separação de dados oficiais/pessoais; read-only do XLSM; dois dispositivos sem perda; permissão e conta corretas; recuperação comprovada; ausência de dados reais no build; usabilidade/accessibilidade; conexão real antes de qualquer alegação de publicação integrada.

Não dispensar um gate por a tela parecer pronta. Contagens do XLSM são baseline do arquivo com hash fixo, não inferência de todos os chamados ou horas oficiais do usuário.

## 22. Configurações pendentes sem ambiguidade de comportamento

| Configuração a obter | Comportamento seguro antes da definição |
|---|---|
| Client ID e redirects reais | Conexão Microsoft desativada com instrução de configuração; demonstração separada. |
| Fonte Excel e consentimento | Upload manual disponível; não varrer todo o OneDrive. |
| Licença/arquivo Magnetik | Fallback do sistema, indicado; paleta e layout continuam aplicados. |
| Calendário real e data inicial de controle | Padrão editável apresentado para confirmação; não gerar dívida retroativa de horas. |
| Fuso dos CSVs | Preservar valores locais e não comparar perfis temporais incompatíveis. |
| Rateio, duplicatas e célula histórica | Pendência de conciliação; sem correção silenciosa. |
| Cadência/limite de follow-up | Próximas ações manuais; sem recomendação automática de encerramento. |
| Hospedagem e política para os dados | Não publicar nem transferir para provedor diferente; usar somente ambientes autorizados. |
| Autenticação/automação CS3 | CSV manual continua funcional; nenhum armazenamento de senha. |

Essas são entradas reais do projeto, não lacunas para a IA completar por imaginação. A confirmação anterior de OneDrive pessoal não autoriza contratação, compartilhamento público nem remoção da documentação antiga do Google Drive. Não apagar materiais anteriores nesta entrega.

## 23. Fontes e rastreabilidade

**Fontes de trabalho, verificadas nesta conversa:**

- **[F1]** `export.csv` — cabeçalho e três registros. SHA-256: `382ef4e1c171c5fed1fa9cc3f56d62e683051214bdc57326e94505dc49a9fed4`.
- **[F2]** `export 2.csv` — cabeçalho e treze registros. SHA-256: `c734299eb47b9b6e066f4c8c629ad22a18ca7fbbb7cdc9accc69a414c0064d3f`.
- **[F3]** `central_chamados_produtividade_aprimorado (1).xlsm` — hash indicado na seção 10; somente leitura estática. Os endereços de célula desta especificação se referem a esse arquivo.
- **[F4]** `interpretacao_central_chamados_aprimorado.md` e perfil técnico da análise anterior, preservados no pacote. Baseline não representa dados homologados nem testes do aplicativo.
- **[V1]** `IMG_4348.jpeg`, fornecida pelo usuário; cópia em `referencias/identidade_visual.jpeg`. SHA-256: `ef9058726664635d2304c142ca1c20bc262e4ab0e20efd66f55b9fb4492a8e85`.

**Documentação oficial consultada em 07/09/2026; revalidar antes da implementação:**

- **[M1]** Microsoft identity platform — Authorization Code com PKCE: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
- **[M2]** Microsoft Graph — App folder: https://learn.microsoft.com/en-us/graph/onedrive-sharepoint-appfolder
- **[M3]** Microsoft Graph — Download driveItem content, inclusive JavaScript: https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0
- **[M4]** Microsoft Graph — workbook/createSession, permissões: https://learn.microsoft.com/en-us/graph/api/workbook-createsession?view=graph-rest-1.0
- **[M5]** Microsoft Graph — driveItem, description e eTag: https://learn.microsoft.com/en-us/graph/api/resources/driveitem?view=graph-rest-1.0
- **[M6]** Microsoft Graph — Update DriveItem properties, PATCH e If-Match: https://learn.microsoft.com/en-us/graph/api/driveitem-update?view=graph-rest-1.0
- **[M7]** Microsoft Graph — upload session e particularidades de commit: https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0
- **[M8]** Azure Static Web Apps — visão geral: https://learn.microsoft.com/en-us/azure/static-web-apps/overview
- **[W1]** W3C — contraste mínimo WCAG 2.2: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- **[S1]** SheetJS CE — fórmulas: https://docs.sheetjs.com/docs/csf/features/formulae/
- **[S2]** SheetJS CE — VBA e macros: https://docs.sheetjs.com/docs/csf/features/vba/

Os papéis de tela, os limites iniciais de volume, o protocolo de revisão, a cadência de verificação e a ordem de implementação são decisões de projeto, não promessas dos fornecedores. As fontes técnicas sustentam as capacidades citadas, mas não substituem os testes de integração.

## 24. Definição final de pronto

A ferramenta só está pronta para uso quando a pessoa consegue entrar com a conta pessoal, importar fontes com prévia, manter dados históricos conciliados, registrar esforço, fechar corretamente a jornada, consultar as três células e abrir a mesma base em outra máquina; reimportar sem duplicar; preservar edições pessoais; detectar conflito remoto; recuperar uma revisão; e executar essas ações na interface com a identidade visual definida.

O relatório de entrega deve separar: **implementado e testado**, **implementado sem teste real**, **demonstrativo**, **dependente de consentimento/configuração** e **fora do escopo**. A IA deve fornecer evidências, não apenas afirmar que tudo funciona.

**Este pacote encerra a especificação consolidada. Não contém um aplicativo implementado nem representa uma conexão, migração ou publicação já realizada.**

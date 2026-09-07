# Como interpretar a Central de Chamados

**Arquivo analisado:** `central_chamados_produtividade_aprimorado (1).xlsm`  
**Data da análise:** 7 de setembro de 2026  
**Destino do projeto:** aplicativo web com dados no OneDrive pessoal.  
**Entrega:** especificação do leitor e evidências de conferência. Não representa aplicativo publicado ou importação já realizada no OneDrive.

## 1. Resultado principal

A planilha pode alimentar a ferramenta, mas não deve ser importada como uma tabela única nem ter todas as abas somadas. Ela reúne cadastro pessoal de chamados, apontamentos, tarefas, cobranças, registros de resolução, desenvolvimento profissional e indicadores derivados. O leitor deve distinguir esses papéis, preservar os valores originais e apresentar divergências antes de gravar.

A análise foi feita diretamente nos dados, fórmulas, valores calculados salvos e código-fonte VBA do arquivo. As macros não foram executadas; os vínculos externos não foram acessados; o original não foi alterado. Os resultados salvos de fórmulas foram tratados como evidência histórica, não como cálculos necessariamente atualizados.

## 2. Inventário verificado

| Aba | Conteúdo identificado | Interpretação proposta |
|---|---|---|
| Chamados | 106 linhas com referência preenchida; cabeçalho na linha 3 | Cadastro pessoal principal. Uma linha contém dois IDs; 106 linhas não significa necessariamente 106 identidades CS3 simples. |
| Planilha1 | 97 referências, todas também presentes em Chamados; 14 status divergentes | Cópia/versão alternativa para comparação. Não carregar como nova base nem sobrescrever Chamados pela ordem das abas. |
| Apontamentos | 333 linhas com conteúdo operacional; 281 com duração numérica e 52 sem duração | Origem primária do esforço. Linhas com somente data e fórmulas auxiliares não são atividades. |
| To Do Diário | 5 tarefas preenchidas | Planejamento. Concluir uma tarefa não gera horas automaticamente. |
| Follow-ups | 22 linhas com referência de chamado | Eventos de cobrança/retorno. Não são apontamentos de horas. |
| Fila Follow-up | 20 linhas salvas | Visão produzida por macro. Recalcular; não importar como novas cobranças. |
| Resolvidos | 70 registros identificados | Histórico/snapshot pessoal de resolução, a conciliar com Chamados. Não somar novamente suas horas. |
| Histórico Status | 16 eventos | Histórico pessoal observado, não histórico integral do CS3. |
| Meu desenvolvimento | 8 registros com descrição, dos quais 7 têm data | Portfólio de desenvolvimento/one-to-one, independente do esforço. Manter o registro sem data como incompleto. |
| Dashboard e Produtividade | Indicadores, fórmulas e resultados salvos | Referência de apresentação e conferência; não fonte primária de registros. |
| Listas e Instruções | Domínios, orientações e regras | Configurações candidatas; discrepâncias devem ser explicitadas. |

**Como as contagens foram obtidas:** em Chamados, Planilha1 e Resolvidos, contar linhas com coluna A preenchida após o cabeçalho; em Follow-ups e Histórico Status, coluna B; em tarefas, coluna A; em desenvolvimento, descrição D. Em Apontamentos, considerar conteúdo literal não vazio em B, C, D, E ou G, não apenas fórmulas ou datas isoladas. A contagem percorre o conteúdo real, inclusive depois de linhas vazias.

**Atenção aos limites:** `TblChamados` cobre `A3:AF494`, mas há campos úteis fora da tabela, de `AG` a `AM`. O leitor que consumir apenas a tabela perde data de resolução, totais e metadados de produtividade. Em Resolvidos e Histórico Status há registros depois de grandes blocos vazios; parar na primeira linha em branco perde histórico.

## 3. Horas: unidade correta e confirmação do esforço

A coluna `Apontamentos!E` contém durações numéricas em fração de dia do Excel, não horas decimais.

| Evidência | Valor armazenado | Interpretação |
|---|---:|---:|
| Apontamentos!E4 | 0,125 | 180 minutos = 3h |
| Apontamentos!E5 | 0,0625 | 90 minutos = 1h30 |
| Apontamentos!E142 | 0,18958333333333333 | 273 minutos = 4h33 |
| Apontamentos!E316 | 0,020833333333333332 | 30 minutos |

Regra deste perfil: **minutos = valor numérico × 1.440**, com tolerância apenas ao ruído de ponto flutuante. Não arredondar 4h33 para 4h30. Durações textuais futuras exigem parser explícito `HH:mm`; número de uma futura coluna rotulada como hora decimal requer outro perfil.

As 281 durações numéricas totalizam **561h33 de soma bruta**, de 18/05/2026 a 31/08/2026. Esse valor inclui candidatos a repetição e referências ainda não conciliadas: **não é total homologado para migração, nem prova de lançamento no CS3**.

Há conteúdo de atividades até 04/09/2026, mas os registros de setembro não têm duração preenchida. Manter como registros incompletos, sem convertê-los em oito horas ou em zero horas de trabalho realizado.

Há três durações sem ID na coluna B, em `155`, `176` e `194`. As duas primeiras têm descrições de atividades internas; a terceira menciona dois incidentes na descrição. Não descartar essas horas nem inventar um chamado único.

A soma por data observada gera 50 datas com exatamente 8h, 13 abaixo e 9 acima. O denominador são **72 datas com duração numérica**, não todos os dias úteis do período. Esses números são conferência aritmética bruta, não avaliação de jornada: faltam conciliação, calendário e análise de sobreposição. Exemplos de revisão: 01/07/2026 soma 12h03; 12/08/2026 soma 15h.

## 4. Mapeamento semântico dos campos

### Chamados

| Coluna(s) | Campo atual | Destino/decisão |
|---|---|---|
| A | Número do Chamado | Referência original + lista de IDs candidatos. Não assumir sempre um único ID. |
| B | Descrição | Título pessoal importado. Preservar separadamente do título oficial do CS3. |
| C | Status | Andamento pessoal. Não usar para sobrescrever o status oficial recebido dos CSVs. |
| D e M | Prioridade / Prioridade Original | Prioridade pessoal e texto de origem. Complexidade de request não é prioridade de incidente. |
| E | Última Atualização | Data pessoal/mista: há valores, fórmulas e atualização via VBA. Não usar como versão `Last Update Time` do CS3. |
| F e G | Responsável / Categoria | Referências pessoais e classificação funcional. “SAP FI / Incidente” não determina AMS, Squad ou Task Force. |
| H | Data de Criação | Data registrada na planilha, sujeita a validação e conciliação com o CS3. |
| I e J | Próxima Ação / Observações | Conteúdo pessoal protegido nas reimportações. |
| K | Tipo | Guardar texto; validar com o prefixo do ID e com o esquema do CS3. |
| L | RND? | Campo misto. Guardar texto integral e sugerir classificação: aprovação de esforço, status legado ou observação. |
| N:AE | Aging, prioridade operacional, tentativas e recomendações | Recalcular a partir dos registros e das regras aprovadas. Não importar como fatos independentes. |
| AF | Status Monitor (VBA) | Controle técnico; não é um segundo status de negócio. |
| AG | Data Resolução | Resolução pessoal registrada; não é comprovadamente a data oficial do CS3. |
| AH:AM | Horas, quantidade, tempo aberto e produtividade | Dados derivados, úteis para reconciliação. Horas vêm de Apontamentos, sem dupla soma. |

Em `L10`, há “RND de 23h aprovada, +3h de analise aprovada”; em `L14`, “12H APROVADAS”; em `L23`, “RND de 19h aprovada”. Em outras linhas, L contém `Working`, `Updated` e `Wait on User`. Portanto, `RND?` **não pode virar um simples sim/não**, e os números aprovados não são horas realizadas. Uma sugestão de orçamento deve preservar os componentes e ser confirmada antes de alimentar estimativas.

### Apontamentos

A = data do trabalho; B = referência de chamado/atividade; C = descrição; D = tipo de atuação; E = duração; F = resultado/status; G = observação; H:J = agrupamentos de calendário.

A descrição C e o status F frequentemente são fórmulas de consulta ao cadastro atual. Entre as 323 linhas com referência preenchida, 298 têm fórmula em F. **Esse resultado não comprova o status existente no dia trabalhado.** Guardar sua origem como “consulta calculada”; não convertê-lo em evento histórico.

Descrição C digitada manualmente pode descrever a atividade. Descrição C produzida por consulta pode ser somente o título do chamado. Não inventar uma descrição de trabalho a partir de um título.

Em D há catálogo e texto livre: `FUP`, `fup`, `fup 2`, `GMUD`, `gmud`, `EF`, `RND`, entre outros. Normalizar apenas com dicionário explícito, preservando o original. Não presumir que FUP foi ao usuário ou ao terceiro quando isso não estiver informado.

`LANÇADO`, em G, é uma anotação do controle pessoal. Das 281 linhas com duração, 274 têm esse marcador, seis não têm observação e uma tem “PEDIR PARA ABRIR O CHAMADO”. Preservar o marcador; não apresentá-lo como confirmação técnica de envio ao CS3 ou ao timesheet oficial.

## 5. Identidades: vínculos não são duplicação de esforço

| Célula | Referência encontrada | Tratamento |
|---|---|---|
| Chamados!A4 | RR22112787/RR23581261 | Duas referências numa linha pessoal. Preservar relação/grupo; não fundir dois chamados oficiais sem validação. |
| Apontamentos!B215 | IR32043578 ; RR23811390 | Uma atividade de 2h com duas referências. Somar 2h no dia, não 4h. |
| Apontamentos!B294 | RR23300936 / RR22812009 | Uma reunião de 1h30, com rateio por chamado ainda indefinido. |
| Apontamentos!B240 | IR32064696_INC3408222 | Incidente CS3 e referência externa candidata. Não são automaticamente dois chamados CS3. |
| Apontamentos!B310 | CR2238_RR23563421 | Requisição CS3 com referência adicional de mudança. |
| Apontamentos!B170 | SCTASK1257370 | Outra classe de referência. Preservar; não forçar a IR ou RR. |
| Apontamentos!C194 | IR30956591/IR31850394 - Alinhamento chamados de CO | Referências na descrição, com B vazia. Sugerir vínculos para revisão. |

Normalizar espaços periféricos, espaços não separáveis e caixa, mantendo o texto original. Há 53 linhas com duração e espaços periféricos na referência. A correspondência literal com Chamados encontra 191 linhas de horas; após normalização cosmética, 228. Esse ganho não resolve referências compostas, externas ou cadastros ausentes.

Para atividades com múltiplos chamados, preservar um único evento de esforço. Até haver rateio confirmado, contar uma vez no total diário e mostrar “horas compartilhadas / sem rateio” no detalhamento. A soma das alocações, quando existirem, deve ser igual à duração original. Não atribuir automaticamente o valor integral a todos os chamados.

Um apontamento válido cujo chamado ainda não está no cadastro deve gerar referência pendente/cadastro provisório, mantendo as horas. Não fabricar título, status, prioridade ou célula ausentes.

## 6. Divergências que o leitor deve sinalizar

| Achado | Evidência e risco | Tratamento proposto |
|---|---|---|
| Versão alternativa | Planilha1 tem 97 referências repetidas e 14 status divergentes de Chamados | Excluir da carga primária; manter relatório comparativo. |
| Repetições de horas candidatas | Pares de linhas 263/267, 264/268, 265/269, 266/270; mesma data, referência, descrição salva, atuação, duração e observação | Pedir conciliação. Não excluir automaticamente: atividades iguais podem ser legítimas. Não homologar o total antes da revisão. |
| Resoluções diferentes | Chamados tem 81 status Resolvido; Resolvidos contém 70 registros, todos ligados ao cadastro | Preservar ambas as evidências. Onze resolvidos não têm registro nessa aba; não inventar data de conclusão. |
| Transferidos ocultos no indicador | Sete status contêm `Transferido ` com espaço final, mas Produtividade!L5 retorna 0 | Normalizar status na aplicação e recalcular o indicador. |
| Fórmulas com erro | 15 resultados #REF! em Apontamentos!H:J, nas linhas 285, 286, 289, 312 e 316; 4 #VALUE! em Chamados!AA101:AD101 | Recalcular derivados. Preservar datas e durações válidas mesmo quando campos auxiliares falham. |
| Fórmulas inválidas não visíveis | 20 fórmulas contêm #REF! no texto; algumas estão protegidas por IFERROR | Verificar expressão e valor salvo. Resultado vazio não garante fórmula válida. |
| Dependência externa | Dez fórmulas em C/F das linhas 267:271 apontam para arquivo v3 externo | Não acessar o vínculo automaticamente; reconstruir relações usando as fontes autorizadas e guardar a procedência. |
| Datas incoerentes | Resolvidos: linhas 714, 728 e 729 têm criação posterior à resolução; em Chamados!H44:H45 aparecem datas de 10/09/2026, futuras à análise | Quarentena para indicadores de prazo. Não inverter mês/dia nem corrigir por suposição. |
| Datas ausentes viram números enganosos | Chamados!N103 e N109 guardam 46272 dias; os registros não têm datas-base completas | Mostrar “sem data”, nunca atraso desde 1900. |
| Regra de cobrança contraditória | Listas!K3 descreve 3 cobranças sem resposta para IR; cálculos usam limite 2 | Registrar conflito de configuração. Não encerrar automaticamente. |
| Resultado de follow-up ausente | Muitas linhas não preenchem H; uma marca Com resposta sem data em I | Vazio não significa Sem resposta. Não inventar data de resposta ou sequência válida de tentativas. |

Os 19 erros salvos são contagens de células, não de chamados ou de atividades perdidas. Por exemplo, `Apontamentos!A286/E286` preserva 18/08/2026 e 4h30 apesar de H:J conterem erro.

## 7. O VBA descreve comportamentos, mas não é a fonte de verdade

Foram extraídos estaticamente 18 módulos/streams de código-fonte, incluindo módulos vazios de lógica. Essa leitura não é teste de execução nem auditoria completa de segurança ou de p-code.

A rotina AtualizarCentral recalcula campos e repõe a fila de cobranças. A rotina RecriarResolvidos limpa a base de resoluções e a reconstrói; por isso, não deve ser executada para “facilitar” a migração de histórico.

O vínculo entre módulo e aba mostra uma discrepância: Chamados está associado a Planilha2, cujo evento atualiza a data; o código que registra histórico e resolução aparece em Planilha8, associado a Resolvidos. Há ainda evento Worksheet_Change em Módulo3 comum. Isso impede tratar a descrição das instruções como prova de que toda automação está corretamente vinculada. Essa observação estática não prova, sozinha, a causa de cada divergência de dados.

Outra atenção: o contador de horas produzido no VBA soma frações de dia e aplica formato numérico em trechos do histórico. O aplicativo deve calcular minutos a partir do detalhe e exibir duração, não copiar esses totais formatados como horas decimais.

Na nova ferramenta, reconstruir como regras próprias: alteração pessoal de status gera evento auditável; resolução registra sua origem/data; tarefas e follow-ups não geram esforço; totais são derivados; nenhuma reconstrução apaga histórico anterior.

## 8. Fontes CS3, Excel e aplicativo devem continuar separadas

Nos CSVs anexados anteriormente há 16 IDs. Dez têm correspondência direta com a referência normalizada de Chamados. Dos seis restantes, cinco aparecem individualmente em Apontamentos; RR22112787 aparece na referência composta de Chamados!A4. Isso demonstra por que ler somente a aba Chamados não recupera todo o vínculo entre fontes.

Exemplo: IR32214124 está “Aguardando usuário” na planilha, mas “Wait on External” no CSV. Armazenar **status pessoal** e **status oficial do CS3** separadamente, com suas datas/proveniências. A hora em que o arquivo foi enviado não decide qual observação pessoal deve ser apagada.

Não há coluna dedicada consistente de célula AMS/Squad/Task Force nesta planilha. “Tipo de Atuação”, categoria funcional, RND e prefixo IR/RR não equivalem a célula. Usar as tags do CS3 como sugestão conforme regra aprovada, aceitar decisão manual e manter “sem classificação” quando não houver evidência suficiente.

## 9. Contrato de importação para implementar

O leitor deve identificar esta família de layout pelo conteúdo dos cabeçalhos e pelas tabelas, não pelo sufixo “(1)” do arquivo. Mapear colunas por nome, detectando renomeações/duplicações; posições abaixo são evidência desta versão, não pressuposto universal.

Fluxo: leitura sem execução → registros brutos com origem → normalização → detecção de pendências → prévia → confirmação → gravação.

Cada registro guarda identidade do arquivo, versão, aba, linha original, hash do conteúdo, valor bruto, natureza literal/fórmula, resultado salvo e decisão de importação. A linha original é rastreabilidade, **não identidade permanente**: inserir uma linha na planilha não pode criar apontamentos duplicados.

Reimportação do arquivo idêntico é operação sem novas inserções. Em uma versão alterada, conciliar com o último estado importado e o estado atual do aplicativo. Identidades internas estáveis devem ser atribuídas após a primeira conciliação; hashes, multiplicidade e IDs de origem apoiam o casamento, mas ambiguidades precisam de revisão. Não deduplicar automaticamente dois eventos só porque data/ID/duração coincidem.

Preservar campos pessoais alterados no aplicativo. Ausência de uma linha não autoriza apagar dados. Uma alteração de duração importada deve aparecer como correção da atividade associada, com antes/depois, não como novo esforço silencioso.

Separar registros sem duração, órfãos e pendentes de rateio. Atividades com duração podem compor uma prévia diária bruta, mas números finais por chamado/célula exigem conciliação. Não liberar edição bidirecional do XLSM no primeiro escopo.

## 10. OneDrive pessoal e limite entre armazenamento e execução

O desenho continua compatível com OneDrive pessoal: obter o arquivo autorizado pelo Microsoft Graph e interpretar o XLSM na aplicação. O endpoint de conteúdo documenta Files.Read delegado para conta Microsoft pessoal [M1]. No navegador, seguir o fluxo de URL de download documentado, sem expor essa URL temporária em logs.

Não depender de recalcular esse XLSM por uma API de Excel na nuvem. O caminho proposto usa o arquivo, suas entradas e regras próprias. Excel para a Web não executa VBA [M2]. Logo, manter o arquivo no OneDrive não basta para fazer as macros funcionarem no aplicativo.

O original permanece somente leitura. Nenhum acesso ao OneDrive, publicação, transferência para Google Drive ou execução de macro foi feito nesta análise. Permissões de acesso à conta e testes entre máquinas continuam sendo parte da futura implementação.

## 11. Critérios de aceite específicos desta planilha

1. Detectar 13 abas e não tratar linhas apenas formatadas ou com fórmulas vazias como registros.
2. Ler os 106 registros da aba principal sem somar os 97 de Planilha1.
3. Importar E4 como 180 minutos e E142 como 273 minutos.
4. Preservar 52 linhas operacionais sem duração como incompletas; não inventar esforço.
5. Manter B215 como uma atividade de 120 minutos, independentemente da quantidade de referências.
6. Não acrescentar novamente as horas de Resolvidos!J ou Chamados!AH.
7. Reter A286/E286 apesar dos erros nos campos H:J.
8. Sinalizar os quatro pares de possíveis repetições, sem removê-los automaticamente.
9. Manter os 11 casos de resolução sem registro correspondente como pendências, sem usar “agora” como data histórica.
10. Não interpretar LANÇADO como confirmação de integração; não inferir célula pela categoria SAP.
11. Reimportar o mesmo arquivo sem duplicações; reordenar linhas sem perder a vinculação já confirmada.
12. Nunca executar VBA, abrir vínculos externos, excluir o original ou publicar informações durante a leitura.

## 12. Rastreabilidade, método e decisões em aberto

Perfil: OOXML com sistema de datas 1900 (`date1904` ausente/falso). Valores de calendário foram convertidos a partir do número serial; fuso exato das datas/hora de origem não foi inferido. Apontamentos diários são datas civis locais, não instantes UTC.

As verificações cobrem estrutura, registros, chaves, unidades, ausência de dados, sobreposição entre abas, duplicidades candidatas, fórmulas, vínculos e coerência temporal. Não verificam autenticidade do apontamento no sistema oficial nem completude de trabalho fora da planilha.

O pacote técnico acompanha esta especificação com perfil JSON, prévia tabular, notebook de conferência e evidência de fonte VBA. O arquivo XLSM original não está replicado no pacote.

Decisões que serão exibidas como pendências no importador, sem bloquear o desenho: rateio das atividades compostas, confirmação dos pares repetidos, regra correta de follow-up para IR, calendário e classificação das células históricas. Até resolução, não aplicar correções silenciosas.

SHA-256 do XLSM original: `7aa0e9a0399944ed575686fca1b0f44e5117ce682f127141901ae7daa5961e35`.

**Fontes técnicas:**  
[M1] Microsoft Graph — Download driveItem content: https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0  
[M2] Microsoft Support — Trabalhar com macros VBA no Excel para a Web: https://support.microsoft.com/pt-br/excel/work-with-vba-macros-in-excel-for-the-web

As demais evidências são as abas/células indicadas do arquivo fornecido e as duas extrações CSV já anexadas. Não foi usada a versão v4 da biblioteca como substituto desta versão XLSM.

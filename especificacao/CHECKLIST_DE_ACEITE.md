# Checklist de aceite — Central de Chamados

Versão 4.0 · 74 cenários. Todos pendentes de execução no aplicativo.

Não confundir validação deste pacote documental com testes da aplicação ou da conta Microsoft.

## AC-001 · CSV inicial
**Área:** DADOS. **Estado:** não executado.
**Preparação:** Base vazia; os dois CSVs reais
**Ação:** Importar e confirmar ambos
**Esperado:** 16 identidades oficiais: 3 IR e 13 RR; nenhuma hora criada.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-002 · CSV repetido
**Área:** DADOS. **Estado:** não executado.
**Preparação:** CSV inicial já aplicado
**Ação:** Reimportar os mesmos arquivos
**Esperado:** Mesmos 16 tickets; zero duplicação de notas, horas ou eventos fictícios.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-003 · CSV oficial novo
**Área:** DADOS. **Estado:** não executado.
**Preparação:** Ticket com nota, horas e célula manual
**Ação:** Importar status/título mais recentes
**Esperado:** Somente campos oficiais mudam; registros pessoais permanecem.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-004 · Versão antiga
**Área:** DADOS. **Estado:** não executado.
**Preparação:** Ticket oficial em versão recente
**Ação:** Importar versão anterior
**Esperado:** Não regredir; registrar a decisão por linha.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-005 · Empate divergente
**Área:** DADOS. **Estado:** não executado.
**Preparação:** Mesmo ID e mesmo Last Update Time
**Ação:** Alterar o conteúdo da linha
**Esperado:** Conflito explícito; nenhuma decisão pela ordem do upload.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-006 · Ausente na carga
**Área:** DADOS. **Estado:** não executado.
**Preparação:** Ticket com horas previamente cadastrado
**Ação:** Enviar CSV parcial sem o ticket
**Esperado:** Preservar ticket, horas e status; não encerrar por ausência.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-007 · Vazios e ausentes
**Área:** DADOS. **Estado:** não executado.
**Preparação:** Campo opcional com valor salvo
**Ação:** Comparar coluna ausente e campo presente vazio
**Esperado:** Ausente preserva; limpeza opcional requer prévia e decisão.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-008 · CSV real
**Área:** DADOS. **Estado:** não executado.
**Preparação:** Campos com acentos, BOM, ponto e vírgula, aspas e quebra interna
**Ação:** Ler em colunas reordenadas
**Esperado:** Manter valores corretos; não dividir o conteúdo da descrição.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-009 · Formato incompatível
**Área:** DADOS. **Estado:** não executado.
**Preparação:** Cabeçalho obrigatório ausente ou repetido
**Ação:** Tentar importar
**Esperado:** Bloquear o perfil; não inferir outra origem pelo título.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-010 · IR/RR e namespaces
**Área:** DADOS. **Estado:** não executado.
**Preparação:** RR cujo título contém Incidente; alias INC/RITM
**Ação:** Importar
**Esperado:** Tipo vem do esquema; aliases não viram tickets CS3 adicionais.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-011 · Arquivo de referência
**Área:** XLSM. **Estado:** não executado.
**Preparação:** XLSM com SHA-256 indicado
**Ação:** Inspecionar em somente leitura
**Esperado:** 13 abas; hash do original inalterado; zero macro/link executado.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-012 · Cadastro e cópia
**Área:** XLSM. **Estado:** não executado.
**Preparação:** Chamados e Planilha1 presentes
**Ação:** Interpretar as duas abas
**Esperado:** 106 linhas principais; 97 da cópia não acrescentadas; 14 divergências sinalizadas.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-013 · Campos fora da tabela
**Área:** XLSM. **Estado:** não executado.
**Preparação:** TblChamados termina em AF
**Ação:** Interpretar AG:AM
**Esperado:** Capturar data de resolução pessoal e reconhecer totais derivados.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-014 · Linhas distantes
**Área:** XLSM. **Estado:** não executado.
**Preparação:** Resolvidos e Histórico Status com intervalos vazios
**Ação:** Percorrer conteúdo material
**Esperado:** Preservar 70 resoluções e 16 eventos da versão de referência.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-015 · Linhas operacionais
**Área:** XLSM. **Estado:** não executado.
**Preparação:** Apontamentos contém linhas com apenas data/fórmula
**Ação:** Interpretar conteúdo
**Esperado:** 333 operacionais, 281 com duração, 52 sem; 323 com referência é outro denominador.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-016 · Conversão 3h
**Área:** HORAS. **Estado:** não executado.
**Preparação:** Valor Excel 0.125 em Horas
**Ação:** Converter pelo perfil
**Esperado:** 180 minutos, não 0.125 hora.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-017 · Precisão 4h33
**Área:** HORAS. **Estado:** não executado.
**Preparação:** Valor Excel 0.18958333333333333
**Ação:** Converter pelo perfil
**Esperado:** 273 minutos; não arredondar para 270.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-018 · Conferência bruta
**Área:** HORAS. **Estado:** não executado.
**Preparação:** 281 durações da versão de referência
**Ação:** Somar para prévia
**Esperado:** 33.693 minutos/561h33 brutas; não rotular como homologadas ou enviadas.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-019 · Duração ausente
**Área:** HORAS. **Estado:** não executado.
**Preparação:** 52 linhas operacionais sem Horas
**Ação:** Importar candidatos
**Esperado:** Preservar incompletos; excluir dos confirmados; não preencher 8h ou 0 de trabalho.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-020 · Data/calendário
**Área:** HORAS. **Estado:** não executado.
**Preparação:** Serial Excel e sistema 1900/1904
**Ação:** Converter
**Esperado:** Data civil correta; serial fictício 60 não vira evento válido; sem deslocamento por UTC.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-021 · Meta 7h30
**Área:** HORAS. **Estado:** não executado.
**Preparação:** Meta 480; confirmados 450
**Ação:** Calcular Meu dia
**Esperado:** Realizado 7h30; faltam 30 min; excedente zero.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-022 · Meta 8h15
**Área:** HORAS. **Estado:** não executado.
**Preparação:** Meta 480; confirmados 495
**Ação:** Calcular Meu dia
**Esperado:** Excedente 15 min; não truncar a duração nem transferir saldo.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-023 · Exceção de jornada
**Área:** HORAS. **Estado:** não executado.
**Preparação:** Férias com meta zero; dia parcial com meta 240
**Ação:** Calcular pendências
**Esperado:** Férias não geram falta; parcial usa 240; dias futuros não são atraso.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-024 · Compartilhamento
**Área:** HORAS. **Estado:** não executado.
**Preparação:** Uma atividade 120 min, dois tickets
**Ação:** Confirmar sem rateio
**Esperado:** 120 no dia; nenhum ticket recebe 120 integral; 120 em compartilhadas sem rateio.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-025 · Rateio confirmado
**Área:** HORAS. **Estado:** não executado.
**Preparação:** Atividade de 120 min
**Ação:** Alocar 75 e 45
**Esperado:** Total diário 120; tickets 75/45; sobra zero; 75+60 é rejeitado.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-026 · Horas sem cadastro
**Área:** HORAS. **Estado:** não executado.
**Preparação:** Referência desconhecida com duração válida
**Ação:** Confirmar após revisão
**Esperado:** Preservar esforço e referência provisória; CSV posterior completa sem duplicar.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-027 · Sem ID literal
**Área:** HORAS. **Estado:** não executado.
**Preparação:** Linhas 155,176,194 do XLSM
**Ação:** Interpretar
**Esperado:** Preservar horas internas; sugerir os vínculos de C194 sem escolher arbitrariamente.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-028 · Dupla soma
**Área:** HORAS. **Estado:** não executado.
**Preparação:** Detalhes em Apontamentos e totais em Chamados/Resolvidos
**Ação:** Gerar dashboard
**Esperado:** Somar apenas esforço detalhado; não adicionar totais ou saldos duplicados.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-029 · Estado LANÇADO
**Área:** HORAS. **Estado:** não executado.
**Preparação:** Observação legada LANÇADO
**Ação:** Importar
**Esperado:** Reported posted pessoal; nunca confirmação técnica de integração.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-030 · Cancelamento
**Área:** HORAS. **Estado:** não executado.
**Preparação:** Apontamento confirmado
**Ação:** Cancelar com confirmação
**Esperado:** Sai do total; mantém registro e auditoria; não some da história.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-031 · Duas referências na linha
**Área:** IDENTIDADE. **Estado:** não executado.
**Preparação:** Chamados!A4 com dois RR
**Ação:** Interpretar
**Esperado:** Preservar grupo pessoal e dois candidatos; não fundir tickets oficiais.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-032 · Referência composta
**Área:** IDENTIDADE. **Estado:** não executado.
**Preparação:** IR+INC; CR+RR; SCTASK
**Ação:** Interpretar
**Esperado:** Namespaces distintos, relações explícitas e sem ticket fictício.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-033 · Espaços e caixa
**Área:** IDENTIDADE. **Estado:** não executado.
**Preparação:** Mesmo ID com espaços/NBSP/caixa diferente
**Ação:** Conciliar
**Esperado:** Mesma identidade normalizada; preservar bruto; não depender de título.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-034 · Reordenação de linhas
**Área:** IMPORTACAO. **Estado:** não executado.
**Preparação:** XLSM já confirmado
**Ação:** Reordenar linhas sem mudar os fatos
**Esperado:** Nenhuma nova hora; IDs internos e multiplicidade mantidos.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-035 · Candidatos repetidos
**Área:** IMPORTACAO. **Estado:** não executado.
**Preparação:** Pares 263/267,264/268,265/269,266/270
**Ação:** Gerar prévia
**Esperado:** Quatro pendências; não excluir nem homologar automaticamente.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-036 · Correção de duração
**Área:** IMPORTACAO. **Estado:** não executado.
**Preparação:** Evento legado vinculado; duração alterada no Excel
**Ação:** Reimportar
**Esperado:** Propor correção antes/depois, não criar outro esforço silencioso.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-037 · Três estados
**Área:** IMPORTACAO. **Estado:** não executado.
**Preparação:** Base importada B; aplicativo A alterado; planilha S também
**Ação:** Conciliar
**Esperado:** Manter mudança local quando S=B; conflito quando A e S divergem de B.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-038 · Mudança durante prévia
**Área:** IMPORTACAO. **Estado:** não executado.
**Preparação:** Prévia baseada em revisão R
**Ação:** Outra sessão altera R antes do confirmar
**Esperado:** Invalidar/recalcular prévia; não sobrescrever.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-039 · Cópia renomeada
**Área:** IMPORTACAO. **Estado:** não executado.
**Preparação:** Arquivo conhecido salvo com novo nome
**Ação:** Selecionar fonte
**Esperado:** Propor associação à fonte existente; não duplicar base pela mudança de nome.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-040 · Erro auxiliar
**Área:** FORMULAS. **Estado:** não executado.
**Preparação:** A286 e E286 válidos; H:J com #REF!
**Ação:** Importar
**Esperado:** Manter data e 270 min; recalcular agrupamentos.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-041 · Fórmula de status
**Área:** FORMULAS. **Estado:** não executado.
**Preparação:** F aponta ao cadastro atual
**Ação:** Interpretar
**Esperado:** Guardar como consulta calculada; não criar status histórico naquela data.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-042 · Link externo
**Área:** FORMULAS. **Estado:** não executado.
**Preparação:** Dez fórmulas em C/F 267:271
**Ação:** Ler workbook
**Esperado:** Nenhum acesso externo; valor salvo/proveniência e pendência quando necessário.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-043 · Resoluções divergentes
**Área:** ESTADOS. **Estado:** não executado.
**Preparação:** 81 Resolvido; 70 em Resolvidos
**Ação:** Conciliar
**Esperado:** 11 casos sem registro correspondente, sem data fabricada.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-044 · Transferidos
**Área:** ESTADOS. **Estado:** não executado.
**Preparação:** Sete estados Transferido com espaço final
**Ação:** Recalcular indicador
**Esperado:** Sete normalizados, não zero por confiar no cache.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-045 · Datas incoerentes
**Área:** ESTADOS. **Estado:** não executado.
**Preparação:** Criação posterior à resolução ou datas-base ausentes
**Ação:** Calcular prazo
**Esperado:** Não calcular atraso desde 1900 nem intervalo negativo; sinalizar exclusão do indicador.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-046 · Precedência manual
**Área:** CELULAS. **Estado:** não executado.
**Preparação:** Célula escolhida pelo usuário
**Ação:** Importar tag diferente
**Esperado:** Manter manual; atualizar sugestão e mostrar divergência.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-047 · Histórico
**Área:** CELULAS. **Estado:** não executado.
**Preparação:** Ticket muda de AMS para Squad
**Ação:** Consultar horas antigas e apontar novas
**Esperado:** Antigas continuam AMS; novas sugerem Squad; desconhecidas não são retroclassificadas.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-048 · EXTRABASELINE
**Área:** CELULAS. **Estado:** não executado.
**Preparação:** Tag contém EXTRABASELINE
**Ação:** Classificar
**Esperado:** Revisão manual; não AMS por conter BASELINE.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-049 · Reconciliação de totais
**Área:** CELULAS. **Estado:** não executado.
**Preparação:** Horas com AMS/Squad/Task Force/Geral/sem célula
**Ação:** Agregar
**Esperado:** Soma das cinco classes igual ao total confirmado, sem dupla contagem.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-050 · Sem esforço automático
**Área:** PLANEJAMENTO. **Estado:** não executado.
**Preparação:** Tarefa concluída, follow-up, desenvolvimento
**Ação:** Salvar
**Esperado:** Nenhum apontamento criado; ação de apontar exige duração e confirmação.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-051 · Regra IR divergente
**Área:** PLANEJAMENTO. **Estado:** não executado.
**Preparação:** Instrução indica 3 tentativas; cálculo indica 2
**Ação:** Importar configurações
**Esperado:** Regra não confirmada; sem encerramento automático; data manual permitida.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-052 · Resultado desconhecido
**Área:** PLANEJAMENTO. **Estado:** não executado.
**Preparação:** Follow-up sem Resultado ou resposta sem data
**Ação:** Interpretar
**Esperado:** Não contar ausência como Sem resposta; preservar pendência.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-053 · Conteúdo incompleto
**Área:** DESENVOLVIMENTO. **Estado:** não executado.
**Preparação:** 8 registros com descrição, 7 com data
**Ação:** Importar
**Esperado:** Preservar os 8; um em sem data; sem gerar horas.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-054 · Conta pessoal
**Área:** SEGURANCA. **Estado:** não executado.
**Preparação:** Conta Microsoft pessoal autorizada
**Ação:** Entrar, ler e gravar
**Esperado:** Fluxo real funciona sem depender de conta corporativa/workbook session.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-055 · Menor permissão
**Área:** SEGURANCA. **Estado:** não executado.
**Preparação:** Somente AppFolder aprovado
**Ação:** Criar e testar revisão/ponteiro
**Esperado:** Operações comprovadas nesse escopo ou bloqueio documentado; sem expansão silenciosa.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-056 · Fonte fora da pasta
**Área:** SEGURANCA. **Estado:** não executado.
**Preparação:** Planilha fora de AppFolder
**Ação:** Vincular sem consentimento adicional
**Esperado:** Não ler; explicar alternativas e alcance real de Files.Read.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-057 · Troca de conta
**Área:** SEGURANCA. **Estado:** não executado.
**Preparação:** Base da conta A na memória
**Ação:** Sair e entrar na conta B
**Esperado:** Nenhum dado de A apresentado ou enviado para B.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-058 · Conteúdo perigoso
**Área:** SEGURANCA. **Estado:** não executado.
**Preparação:** Texto HTML/script e fórmula na exportação
**Ação:** Exibir/exportar
**Esperado:** Texto escapado; nenhuma execução; célula de exportação tratada como texto.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-059 · Privacidade do build
**Área:** SEGURANCA. **Estado:** não executado.
**Preparação:** Insumos privados no ambiente de desenvolvimento
**Ação:** Gerar build e inspecionar artefatos
**Esperado:** Nenhum CSV/XLSM/token/registro real no público, bundle ou logs.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-060 · ZIP/arquivo inválido
**Área:** SEGURANCA. **Estado:** não executado.
**Preparação:** Arquivo expandido além dos limites ou path malicioso
**Ação:** Ler
**Esperado:** Interromper com erro compreensível, sem gravar base parcial.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-061 · Duas sessões
**Área:** ONEDRIVE. **Estado:** não executado.
**Preparação:** Ambas leem o mesmo head eTag
**Ação:** Publicar em paralelo, repetir 100 vezes
**Esperado:** Um vencedor por base; perdedor recebe conflito; após conciliação ambas operações preservadas.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-062 · Falha no upload
**Área:** ONEDRIVE. **Estado:** não executado.
**Preparação:** Nova revisão ainda não publicada
**Ação:** Interromper upload
**Esperado:** Revisão anterior continua ativa; nenhuma carga parcial no dashboard.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-063 · Resposta perdida
**Área:** ONEDRIVE. **Estado:** não executado.
**Preparação:** Commit pode ter ocorrido, mas resposta é perdida
**Ação:** Retentar com mesmo operationId
**Esperado:** Consultar recibo/ancestralidade; não duplicar; informar incerto quando não confirmar.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-064 · Inicialização concorrente
**Área:** ONEDRIVE. **Estado:** não executado.
**Preparação:** Duas sessões, base ainda inexistente
**Ação:** Inicializar juntas
**Esperado:** Uma identidade de base; sem state-head renomeado e sem bases paralelas.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-065 · Arquivo alterado/excluído
**Área:** ONEDRIVE. **Estado:** não executado.
**Preparação:** Hash inválido, head faltante ou revisão removida
**Ação:** Abrir aplicação
**Esperado:** Entrar em recuperação; não recriar base vazia silenciosamente.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-066 · Quota e throttling
**Área:** ONEDRIVE. **Estado:** não executado.
**Preparação:** Respostas de cota,429,5xx
**Ação:** Salvar
**Esperado:** Erro/espera limitada; manter formulário; não declarar salvo.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-067 · Restauração
**Área:** ONEDRIVE. **Estado:** não executado.
**Preparação:** Checkpoint validado e revisão atual
**Ação:** Restaurar com prévia e confirmação
**Esperado:** Nova revisão consistente; anterior preservada; totais conferidos.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-068 · Fonte durante download
**Área:** ONEDRIVE. **Estado:** não executado.
**Preparação:** XLSM muda entre metadados antes/depois
**Ação:** Vincular/ler
**Esperado:** Detectar mudança; repetir de modo limitado; não confirmar versão ambígua.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-069 · Paleta
**Área:** UI. **Estado:** não executado.
**Preparação:** Referência e design tokens
**Ação:** Revisar telas
**Esperado:** HEX base corretos; texto escuro em azul/menta; sem paleta alternativa arbitrária.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-070 · Fonte
**Área:** UI. **Estado:** não executado.
**Preparação:** Magnetik não fornecida
**Ação:** Abrir aplicação
**Esperado:** Fallback declarado; não afirmar uso da fonte nem incluí-la sem licença.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-071 · Navegação acessível
**Área:** UI. **Estado:** não executado.
**Preparação:** Desktop e 390 px; teclado/zoom200%
**Ação:** Percorrer login, dia, importação e detalhe
**Esperado:** Sem conteúdo crítico cortado; foco e rótulos funcionam; gráficos têm alternativa.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-072 · Sem rede e vazio
**Área:** UI. **Estado:** não executado.
**Preparação:** Sem rede, sem permissão, filtro vazio
**Ação:** Abrir respectivas telas
**Esperado:** Estados diferentes e mensagens específicas; não confundir com zero de trabalho.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-073 · Conexão e publicação
**Área:** ENTREGA. **Estado:** não executado.
**Preparação:** Código implementado e autorização disponível
**Ação:** Publicar e testar URL HTTPS real
**Esperado:** Só declarar integrado após confirmar login, gravação e leitura noutra sessão.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

## AC-074 · Original preservado
**Área:** ENTREGA. **Estado:** não executado.
**Preparação:** Hashes dos três insumos antes da execução
**Ação:** Executar leitura e conferência
**Esperado:** Hashes finais iguais; fontes reais não reescritas.
**Evidência a registrar:** comando/ambiente, data, resultado e artefato sem credenciais ou conteúdo desnecessário.

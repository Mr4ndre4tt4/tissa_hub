# Revisão da importação e recuperação — 14/09/2026

Base revisada: `cad2ae1` (main). O relato mostra uma revisão no OneDrive com
ponteiro ativo ausente. Essa imagem não contém o erro da chamada Microsoft
nem o CSV; portanto não demonstra por que a descrição ficou vazia nessa conta.

## Defeitos reproduzidos e corrigidos

- A interface dizia "Carga confirmada" e descartava a prévia mesmo quando
  `mutar()` devolvia erro, conflito, quota, autenticação expirada ou resultado
  incerto. Agora só conclui após confirmação; preserva a prévia e as escolhas
  nas falhas enquanto a tela permanece aberta.
- Dois cliques podiam disparar duas importações simultâneas. Há trava imediata
  e controles desabilitados enquanto a gravação está em andamento.
- A prévia era validada só contra a cópia da interface. Agora a aplicação
  também verifica a revisão relida do servidor antes de alterar qualquer dado.
- A inicialização não conferia os bytes enviados nem relia o recibo após o
  PATCH. A recuperação também confirmava sem releitura. Ambas agora exigem
  confirmação remota; a inicialização confere o hash antes de publicar.
- A inicialização direta podia criar outra base quando havia revisão órfã.
  Agora entra em recuperação, preservando os arquivos existentes.
- Uma recuperação sem recibo alterava o ponteiro antes de detectar o problema.
  Agora rejeita antes da escrita. JSON malformado e estrutura incompleta
  produzem mensagens de erro em vez de exceções sem tratamento nesse fluxo.
- Falhas de transporte e HTTP 5xx no PATCH eram tratadas como certeza de
  falha. Agora são resultado incerto e o repositório consulta o recibo, sem
  repetir cegamente a publicação. A leitura do Graph não usa cache HTTP.
- O download falhava imediatamente quando a resposta padrão omitia a URL.
  Há uma segunda leitura limitada, com `$select=id,@microsoft.graph.downloadUrl`,
  conforme a [documentação Microsoft](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0).
  Continua sem bearer na URL temporária e sem usar o redirecionamento /content.
- "Tentar de novo" podia sair de recuperação após erro de rede. Agora mantém
  o modo anterior. Uma criação que deixa revisão órfã abre a recuperação.
  Alterações locais só são aceitas no modo demonstrativo explícito.
- CSVs com aspas malformadas e quantidade errada de colunas passavam pelo
  leitor. Agora são bloqueados com a linha do erro. Quebras CR, CRLF e LF são
  reconhecidas. UTF-8 inválido é rejeitado sem substituir caracteres.

## Validação

- Casos novos executados antes das correções e observados falhando.
- `npm test`: **300 testes passaram**, incluindo concorrência entre sessões,
  idempotência, recuperação e interação React em jsdom.
- `npm run build`: tipagem e produção passaram com Vite 6.4.3.
- Dependências atualizadas: fflate 0.8.3, Vite 6.4.3, Vitest 4.1.11,
  tsx 4.23.13 e Playwright 1.63.0; jsdom 26.1.0 adicionado aos testes.
  Auditoria após a atualização: **0 vulnerabilidades reportadas**.
- Navegador real, demonstração local, largura 390 px: CSV sintético carregado,
  prévia confirmada e um chamado aplicado. Reenvio do mesmo arquivo: zero novos,
  um igual e confirmação desabilitada. Largura do documento: 390 px, sem excesso.
- O build ainda emite aviso de chunk acima de 500 kB; não impede compilação.

## Limites e continuação

Nenhum CSV privado foi recebido ou enviado, nenhuma sessão Microsoft foi
autenticada e nenhuma revisão real foi alterada. Testes simulados não provam
o funcionamento do protocolo na conta real. O site aberto nesta revisão
apresentava a tela de login.

Depois de publicar: atualizar a página, entrar na mesma conta, escolher a
revisão na recuperação e conferir a base relida. Só então importar o CSV,
conferir a prévia, confirmar, recarregar e verificar a persistência e a ausência
de duplicação. Se o Graph ainda omitir a descrição ou a URL, preservar o erro
exato da chamada; não criar nova base, apagar revisões ou trocar o protocolo
de armazenamento com base apenas na imagem.

O repositório tissa_hub não contém harness Archimedes. Este documento registra
o diagnóstico e a evidência no diretório de documentação já existente.

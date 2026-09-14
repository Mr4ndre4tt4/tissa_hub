# Validação real do OneDrive — 14/09/2026

Conta dedicada de teste, autenticada pelo usuário no navegador. Nenhum dado de chamados real foi importado.

## Evidência inicial

A versão publicada a partir de f7e77a2 reproduziu o problema em uma conta nova. A criação deixou uma revisão JSON, mas a aplicação entrou em recuperação. Recuperar essa revisão conseguiu baixar e validar os bytes, passou pela publicação e falhou na confirmação por releitura. O erro original era descartado pelo catch e substituído por uma mensagem genérica.

A etapa de diagnóstico preserva a causa da releitura e permite diagnóstico opt-in com `?diagnostico=1`. O registro contém somente etapa, presença/tamanho da descrição, presença do eTag, tipo pasta e igualdade com o valor enviado. Não registra IDs, valores da descrição, tokens ou URLs de download.

Validação real ainda em andamento; esta etapa não declara a falha resolvida.

## Diagnóstico dos campos na conta real

Após a publicação do diagnóstico, a leitura completa, a leitura padrão e a projeção mínima devolveram `description` presente, com 376 caracteres, além de eTag. O retorno do PATCH também continha a descrição, porém diferente do texto enviado. Portanto, a mensagem "ponteiro vazio" não descrevia a resposta do serviço: `lerPonteiro` devolve null também quando o conteúdo não é interpretável como JSON.

A tentativa de executar a validação autenticada em localhost foi recusada pela Microsoft porque esse redirect URI não está registrado. Nenhum registro de aplicativo ou permissão foi alterado. A inspeção prossegue no endereço já registrado, sem extrair tokens do navegador.

## Causa confirmada e correção

A inspeção estrutural sanitizada confirmou entidades HTML: aspas como `&quot;`, chaves e dois-pontos como entidades numéricas. A descrição não desaparecia. O parser JSON falhava e convertia essa falha em ponteiro ausente. As três projeções de leitura apresentaram a mesma estrutura; trocar `$select` não resolve esse problema.

A correção lê primeiro o JSON original. Se a sintaxe falhar, decodifica uma única camada de entidades textuais e tenta o JSON novamente. Não usa DOM ou innerHTML, não executa código e não altera o formato enviado nem os arquivos de revisão. Identidade da conta, hash da revisão e recibo continuam sendo conferidos pelo repositório. JSON válido com entidades literais é preservado; dupla codificação e campos de tipos errados são rejeitados.

Regressão reproduzida antes da correção com uma descrição sintética de 376 caracteres no mesmo formato observado. Testes também cobrem criação, releitura e nova gravação com o serviço codificando a pontuação.

A publicação da correção e a validação funcional completa na conta real ainda estão pendentes nesta etapa.

## Primeiras confirmações funcionais após a correção

A versão publicada de 12a8727 abriu a revisão anteriormente presa em recuperação, sem recriar a base. Um CSV sintético de incidente foi lido como um registro novo, confirmado e devolveu "Salvo no OneDrive" e "Carga confirmada: 1 registro(s) aplicado(s)" com zero pendências.

Recarregar a rota interna de importações revelou um segundo defeito: como o cache de autenticação é somente em memória, a sessão acaba, mas a rota mostrava uma base vazia com "Sem conexão" e aviso de demonstração. A guarda de navegação passa a exigir login também nas rotas internas sem sessão. Demonstração permanece uma escolha explícita. O novo caso falhou antes da alteração.

## Resultado final da validação funcional

As correções foram publicadas nos PRs #10 e #11. O build final validado no navegador usa `index-BoBNW0yY.js`. Os dois fluxos de publicação concluíram com sucesso. A suíte local final tem 309 testes em 21 arquivos, com tipagem e build aprovados.

| Cenário na conta Microsoft real de teste | Resultado observado |
| --- | --- |
| Abrir a revisão que estava presa em recuperação | Base aberta sem recriação ou exclusão de revisão |
| Importar CSV de incidente | Um novo registro, zero pendências, recibo confirmado e "Salvo no OneDrive" |
| Recarregar e entrar novamente | O incidente persistiu no OneDrive |
| Reenviar o mesmo CSV | Zero novos, um igual, confirmação de zero registros desabilitada |
| Atualizar o incidente com ponto e vírgula, aspas e acentos no título | Um alterado, zero novos; gravação confirmada |
| Enviar CSV com cinco campos sob cabeçalho de quatro colunas | Erro na linha 2 e carga não aplicada |
| Importar CSV de requisição | Um novo registro, zero pendências, gravação confirmada |
| Recarregar diretamente a rota de importações após #11 | Tela de login apresentada, sem revisão vazia disfarçada de demonstração |
| Último login e listagem da base | Exatamente dois chamados: incidente atualizado e requisição, com títulos e horários preservados |

A conta de teste mantém os dois registros sintéticos e as revisões, como evidência reproduzível. Nenhum arquivo ou dado da conta pessoal original do usuário foi acessado nesta validação. O CSV original do usuário não foi fornecido. Esta evidência qualifica os cenários acima; concorrência forçada entre clientes, falhas de rede injetadas e importação XLSM permanecem cobertos por testes locais, sem nova execução real neste trabalho.

O navegador recebeu versões antigas do HTML no retorno do login durante a propagação/cache do GitHub Pages. Cada etapa real foi atribuída ao arquivo JavaScript efetivamente carregado, não apenas ao status de deploy.

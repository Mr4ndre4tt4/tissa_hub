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

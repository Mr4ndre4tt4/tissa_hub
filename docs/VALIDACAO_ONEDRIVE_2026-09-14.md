# Validação real do OneDrive — 14/09/2026

Conta dedicada de teste, autenticada pelo usuário no navegador. Nenhum dado de chamados real foi importado.

## Evidência inicial

A versão publicada a partir de f7e77a2 reproduziu o problema em uma conta nova. A criação deixou uma revisão JSON, mas a aplicação entrou em recuperação. Recuperar essa revisão conseguiu baixar e validar os bytes, passou pela publicação e falhou na confirmação por releitura. O erro original era descartado pelo catch e substituído por uma mensagem genérica.

A etapa de diagnóstico preserva a causa da releitura e permite diagnóstico opt-in com `?diagnostico=1`. O registro contém somente etapa, presença/tamanho da descrição, presença do eTag, tipo pasta e igualdade com o valor enviado. Não registra IDs, valores da descrição, tokens ou URLs de download.

Validação real ainda em andamento; esta etapa não declara a falha resolvida.

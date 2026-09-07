# Comece aqui — pacote final para desenvolvimento

Este pacote entrega o projeto consolidado da **Central de Chamados**, com a identidade visual fornecida, dados no **OneDrive pessoal** e leitura sem execução de macros da planilha legada. Não contém um aplicativo implementado.

## Como entregar à IA de desenvolvimento

Abra um projeto privado na ferramenta de desenvolvimento autorizada, anexe este pacote e use o texto abaixo. Se a ferramenta não aceitar ZIP, extraia-o e anexe o arquivo mestre e os insumos necessários. Não publique a pasta de insumos.

> Desenvolva a aplicação descrita em ESPECIFICACAO_FINAL_PARA_IA.md, versão 4.0. Esse documento substitui as propostas anteriores. Use a referência visual em referencias/identidade_visual.jpeg e os tokens em contratos/design_tokens.json. Preserve OneDrive pessoal, acesso somente de leitura aos três insumos e todas as regras de conciliação. Leia os arquivos e os contratos antes de programar. Implemente por etapas, começando pela prova técnica de persistência e pelos testes de domínio. Não substitua o projeto por dashboard estático, Google Drive ou banco externo não autorizado. Não incorpore dados reais ao repositório ou ao build. Peça apenas configurações reais, consentimentos e decisões de negócio que não possam ser inferidas. Entregue código, testes, evidências e instalação. Não declare integração ou publicação sem testes reais.

## O que ler

**ESPECIFICACAO_FINAL_PARA_IA.md** é o arquivo principal e inclui as regras, telas, arquitetura, matriz de aceite e fontes. **CHECKLIST_DE_ACEITE.md** expande a preparação/ação de cada cenário. **contratos/** contém tokens, perfil de importação, baseline, fixtures sintéticas e exemplos de configuração pública. **referencias/** contém a imagem original e a interpretação documentada.

**insumos_privados/** contém os dois CSVs e o XLSM original. Esses arquivos incluem dados do cliente. Use somente em ambiente autorizado. Não habilite macros. Nenhum arquivo de fonte tipográfica foi incluído.

## O que ainda exige uma configuração real

Registro de aplicativo Microsoft com suporte a conta pessoal; client ID e redirects; consentimento do usuário; definição da hospedagem e autorização de publicação; vínculo com a planilha no OneDrive; regras de calendário/follow-up e conciliação dos históricos. A fonte Magnetik depende de arquivo e licença autorizados; até lá, usar o fallback previsto.

## Estado da entrega

Documento e pacote consolidados. Nenhum OneDrive foi conectado, nenhum arquivo foi migrado para uma nuvem e nenhum aplicativo foi publicado nesta entrega. A documentação anterior do Google Drive não foi removida. Os arquivos originais foram preservados byte a byte.

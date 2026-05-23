# Scripts Tampermonkey para CRC (Registro Civil)

Colecao de scripts Tampermonkey para o CRC (sistema web usado por cartorios de registro civil). O foco e reduzir cliques, evitar perda de filtros e acelerar tarefas repetitivas.

## Requisitos
- Extensao Tampermonkey instalada no navegador.

## Como instalar
1. Abra o Tampermonkey e clique em **Create a new script**.
2. Copie o conteudo do arquivo `.user.js` desejado.
3. Salve o script.
4. Acesse o sistema do CRC para o script entrar em acao.

## Scripts

| Script | Arquivo | Descricao |
|---|---|---|
| Comunicacao em lote | `Comunicacoes/Comunicação em lote.user.js` | Gera impressao em lote das comunicacoes. Organiza os textos em uma folha A4, em 4 colunas, sem sobreposicao e sem quebrar uma comunicacao entre paginas. Resolve o trabalho de copiar manualmente cada comunicacao para o Word em cartorios com alto volume diario. |
| Sistema Integrado E-PROTOCOLO 2.0 | `E-PROTOCOLO 2.0/SISTEMA INTEGRADO E-PROTOCOLO 2.0.user.js` | Deve ser usado em conjunto com o CRC Analises. Intercepta requisicoes para obter informacoes dos pedidos, permite carregar todos com um clique e abrir pedidos novos em lote, evitando perda de filtros e cliques repetitivos do fluxo original (que mostra APENAS 5 PEDIDOS por vez). |
| CRC Analises | `E-PROTOCOLO 2.0/CRC Analises.user.js` | Complementa o Sistema Integrado. Faz operacoes direto na tela do pedido, incluindo impressao unificada (recibo + anexos), historico de atividades e historico de devolucoes, reduzindo a necessidade de navegar por varias paginas. |

## Observacoes
- Os scripts **CRC Analises** e **Sistema Integrado E-PROTOCOLO 2.0** foram feitos para funcionar em conjunto.
- O **CNS (Codigo Nacional de Serventia)** deve ser ajustado para funcionar.
 
##const CNS_FIXO = 'PREENCHA SEU CNS AQUI';

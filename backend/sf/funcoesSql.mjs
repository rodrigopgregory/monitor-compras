import { NOWS, HOJE, BRNOW, jo, ja, num, int } from './sql.mjs';
const NN = v => `NULLIF('{{${v}}}','')`;
const NUMV = v => `CAST(NULLIF('{{${v}}}','') AS DECIMAL(14,2))`;
const MSG_COLS = `M.ID, M.CRIADO_EM, M.AUTOR, M.TIPO, M.PRODUTO_ID, M.OFERTA_ID, M.TEXTO, M.DADOS, M.PERGUNTA, M.RESPOSTA`;
const COMPARADO = 'O.PRECO_COMPARADO';
export const SQL_SFS = {
  intProduto: { d: 'Lê um produto (uso interno).', c: `SELECT ID, NOME, MARCA, MODELO, TERMO_BUSCA, CARACTERISTICAS, LINK_ORIGEM, LOJA_ORIGEM, PRECO_DE_ORIGEM, PRECO_POR_ORIGEM, BUSCA_SIMILARES, INCLUIR_USADOS, DATA_FIM, STATUS FROM MC_PRODUTO WHERE ID = {{produtoId}}` },
  intProdutoPorCodigo: { d: 'Lê um produto pelo código de cadastro (uso interno).', c: `SELECT ID, NOME FROM MC_PRODUTO WHERE CODIGO = '{{codigo}}'` },
  intLojas: { d: 'Lojas ativas consultadas na rodada (uso interno).', c: `SELECT ID, NOME, DOMINIO, URL_BUSCA, TIPO, PADRAO, APELIDOS FROM MC_LOJA WHERE ATIVA = 1 ORDER BY ORDEM, ID LIMIT 100` },
  intFaixas: { d: 'Faixas de oportunidade vigentes (uso interno).', c: `SELECT ID, ORDEM, NOME, MIN_PCT FROM MC_FAIXA ORDER BY MIN_PCT DESC LIMIT 20` },
  intInserirProduto: { d: 'Grava um produto cadastrado por link (uso interno).', c:
    `INSERT INTO MC_PRODUTO (CODIGO, CRIADO_POR, NOME, MARCA, MODELO, TERMO_BUSCA, CARACTERISTICAS, LINK_ORIGEM, LOJA_ORIGEM, PRECO_DE_ORIGEM, PRECO_POR_ORIGEM, CONDICOES_ORIGEM, PRINT_ORIGEM_FONTE, STATUS, CRIADO_EM)
     VALUES ('{{codigo}}', :VAR_USER, '{{nome}}', ${NN('marca')}, ${NN('modelo')}, ${NN('termo')}, ${NN('caracteristicas')}, '{{link}}', ${NN('loja')}, ${NUMV('de')}, ${NUMV('por')}, ${NN('condicoes')}, ${NN('printFonte')}, 'ATIVO', ${NOWS})` },
  intInserirMensagem: { d: 'Grava uma mensagem na conversa (uso interno).', c:
    `INSERT INTO MC_MENSAGEM (CRIADO_EM, AUTOR, USUARIO_ID, TIPO, PRODUTO_ID, OFERTA_ID, TEXTO, DADOS, PERGUNTA)
     VALUES (${NOWS}, CASE WHEN '{{autor}}' = 'USUARIO' THEN 'USUARIO' ELSE 'ASSISTENTE' END, :VAR_USER, '{{tipo}}', NULLIF({{produtoId}},0), NULLIF({{ofertaId}},0), '{{texto}}', ${NN('dados')}, ${NN('pergunta')})` },
  intSalvarRodada: { d: 'Grava o resumo de uma rodada (uso interno).', c:
    `INSERT INTO MC_RODADA (CODIGO, PRODUTO_ID, INICIO, FIM, VALOR_MERCADO, LOJAS_CONSULTADAS, LOJAS_NO_CALCULO, OFERTAS, SIMILARES, FAIXAS_USADAS, SITUACAO_LOJAS)
     VALUES ('{{codigo}}', {{produtoId}}, '{{inicio}}', ${NOWS}, ${NUMV('valorMercado')}, {{lojasConsultadas}}, {{lojasNoCalculo}}, {{ofertas}}, {{similares}}, '{{faixasUsadas}}', '{{situacao}}');
     UPDATE MC_PRODUTO SET ULTIMA_RODADA_EM = ${NOWS} WHERE ID = {{produtoId}}` },
  intSalvarOfertas: { d: 'Grava em lote as ofertas de uma rodada (uso interno).', c:
    `INSERT INTO MC_OFERTA (RODADA_ID, PRODUTO_ID, IDX, LOJA_ID, LOJA_NOME, FONTE, FONTE_URL, TITULO, URL, TIPO, VARIACAO, VENDEDOR, VENDEDOR_TERCEIRO, RECONDICIONADO, USADO, PRECO_DE, PRECO_POR, FRETE, FRETE_GRATIS_ACIMA, PRECO_COMPARADO, CONDICOES, PRINT_FONTE, DESCONTO, FAIXA, NO_CALCULO, CRIADO_EM)
     SELECT R.ID, R.PRODUTO_ID, S.N, ${int(ja('lista','lojaId'))}, ${ja('lista','loja')}, ${ja('lista','fonte')}, ${ja('lista','fonteUrl')}, ${ja('lista','titulo')}, ${ja('lista','url')}, ${ja('lista','tipo')}, ${ja('lista','variacao')}, ${ja('lista','vendedor')},
       ${int(ja('lista','terceiro'))}, ${int(ja('lista','recond'))}, ${int(ja('lista','usado'))}, ${num(ja('lista','de'))}, ${num(ja('lista','por'))}, ${num(ja('lista','frete'))}, ${num(ja('lista','freteGratisAcima'))}, ${num(ja('lista','comparado'))},
       ${ja('lista','condicoes')}, ${ja('lista','printFonte')}, ${num(ja('lista','desconto'))}, ${ja('lista','faixa')}, ${int(ja('lista','noCalculo'))}, ${NOWS}
     FROM SEQ S JOIN MC_RODADA R ON R.CODIGO = '{{codigo}}'
     WHERE S.N < JSON_LENGTH('{{lista}}')` },
  intOfertasDaRodada: { d: 'Ids das ofertas gravadas numa rodada (uso interno).', c: `SELECT O.ID, O.IDX FROM MC_OFERTA O JOIN MC_RODADA R ON R.ID = O.RODADA_ID WHERE R.CODIGO = '{{codigo}}' ORDER BY O.IDX LIMIT 200` },
  intEstado: { d: 'Estado da oferta em andamento de um produto (uso interno).', c: `SELECT PRODUTO_ID, ATIVO, FAIXA, FAIXA_ORDEM, PRECO_AVISADO, OFERTA_ID, DESDE, ULTIMO_AVISO_EM, ULTIMO_LEMBRETE_DIA FROM MC_ESTADO_OFERTA WHERE PRODUTO_ID = {{produtoId}}` },
  intSalvarEstado: { d: 'Atualiza o estado da oferta de um produto (uso interno).', c:
    `INSERT INTO MC_ESTADO_OFERTA (PRODUTO_ID, ATIVO, FAIXA, FAIXA_ORDEM, PRECO_AVISADO, OFERTA_ID, DESDE, ULTIMO_AVISO_EM, ULTIMO_LEMBRETE_DIA)
     VALUES ({{produtoId}}, {{ativo}}, ${NN('faixa')}, CAST(NULLIF('{{faixaOrdem}}','') AS SIGNED), ${NUMV('precoAvisado')}, CAST(NULLIF('{{ofertaId}}','') AS SIGNED), ${NN('desde')}, ${NN('ultimoAviso')}, ${NN('ultimoLembreteDia')})
     ON DUPLICATE KEY UPDATE ATIVO = VALUES(ATIVO), FAIXA = VALUES(FAIXA), FAIXA_ORDEM = VALUES(FAIXA_ORDEM), PRECO_AVISADO = VALUES(PRECO_AVISADO), OFERTA_ID = VALUES(OFERTA_ID), DESDE = VALUES(DESDE), ULTIMO_AVISO_EM = VALUES(ULTIMO_AVISO_EM), ULTIMO_LEMBRETE_DIA = VALUES(ULTIMO_LEMBRETE_DIA)` },
  intOfertaResumo: { d: 'Dados de uma oferta para montar aviso (uso interno).', c:
    `SELECT O.ID, O.LOJA_NOME, O.FONTE, O.TITULO, O.URL, O.TIPO, O.VARIACAO, O.VENDEDOR, O.VENDEDOR_TERCEIRO, O.RECONDICIONADO, O.USADO, O.PRECO_DE, O.PRECO_POR, O.FRETE, O.FRETE_GRATIS_ACIMA, O.PRECO_COMPARADO, O.CONDICOES, O.DESCONTO, O.FAIXA, R.VALOR_MERCADO
     FROM MC_OFERTA O JOIN MC_RODADA R ON R.ID = O.RODADA_ID WHERE O.ID = {{ofertaId}}` },
  intHistoricoResumo: { d: 'Menor e maior preço do produto nos últimos 90 dias (uso interno).', c:
    `SELECT COUNT(DISTINCT O.RODADA_ID) AS RODADAS, MIN(O.PRECO_COMPARADO) AS MENOR, MAX(O.PRECO_COMPARADO) AS MAIOR, MIN(O.CRIADO_EM) AS DESDE,
       (SELECT AVG(R.VALOR_MERCADO) FROM MC_RODADA R WHERE R.PRODUTO_ID = {{produtoId}} AND R.VALOR_MERCADO IS NOT NULL) AS MERCADO_MEDIO
     FROM MC_OFERTA O WHERE O.PRODUTO_ID = {{produtoId}} AND O.NO_CALCULO = 1` },
  intPrintsPendentes: { d: 'Prints ainda não guardados (uso interno).', c:
    `SELECT 'OFERTA' AS TABELA, ID, PRINT_FONTE AS FONTE FROM MC_OFERTA
       WHERE PRINT_KEY IS NULL AND PRINT_FONTE IS NOT NULL AND PRINT_TENTATIVAS < 6 AND CRIADO_EM >= DATE_FORMAT(DATE_SUB(${BRNOW}, INTERVAL 1 DAY),'%Y-%m-%dT%H:%i:%s')
     UNION ALL
     SELECT 'PRODUTO', ID, PRINT_ORIGEM_FONTE FROM MC_PRODUTO WHERE PRINT_ORIGEM_KEY IS NULL AND PRINT_ORIGEM_FONTE IS NOT NULL AND PRINT_TENTATIVAS < 6
     ORDER BY ID DESC LIMIT 60` },
  intSalvarPrint: { d: 'Guarda a chave do print (ou conta mais uma tentativa) (uso interno).', c:
    `UPDATE MC_OFERTA SET PRINT_KEY = ${NN('key')}, PRINT_TENTATIVAS = PRINT_TENTATIVAS + 1 WHERE '{{tabela}}' = 'OFERTA' AND ID = {{id}};
     UPDATE MC_PRODUTO SET PRINT_ORIGEM_KEY = ${NN('key')}, PRINT_TENTATIVAS = PRINT_TENTATIVAS + 1 WHERE '{{tabela}}' = 'PRODUTO' AND ID = {{id}}` },
  intProximoProduto: { d: 'Próximo produto com rodada vencida (uso interno).', c:
    `SELECT ID FROM MC_PRODUTO
     WHERE STATUS = 'ATIVO' AND (DATA_FIM IS NULL OR DATA_FIM >= ${HOJE})
       AND (ULTIMA_RODADA_EM IS NULL OR ULTIMA_RODADA_EM <= DATE_FORMAT(DATE_SUB(${BRNOW}, INTERVAL 57 MINUTE),'%Y-%m-%dT%H:%i:%s'))
       AND ID NOT IN (SELECT PRODUTO_ID FROM MC_MENSAGEM WHERE PERGUNTA = 'SIMILARES' AND RESPOSTA IS NULL AND PRODUTO_ID IS NOT NULL
                      AND CRIADO_EM >= DATE_FORMAT(DATE_SUB(${BRNOW}, INTERVAL 30 MINUTE),'%Y-%m-%dT%H:%i:%s'))
     ORDER BY COALESCE(ULTIMA_RODADA_EM, '0000') LIMIT 1` },
  intPedirBusca: { d: 'Põe produtos ativos na fila de busca agora (0 = todos). Pula o que já está em rodada (uso interno).', c:
    `UPDATE MC_PRODUTO SET ULTIMA_RODADA_EM = NULL
     WHERE STATUS = 'ATIVO' AND (DATA_FIM IS NULL OR DATA_FIM >= ${HOJE}) AND ({{produtoId}} = 0 OR ID = {{produtoId}})
       AND (ULTIMA_RODADA_EM IS NULL OR ULTIMA_RODADA_EM <= DATE_FORMAT(DATE_SUB(${BRNOW}, INTERVAL 5 MINUTE),'%Y-%m-%dT%H:%i:%s'))` },
  intFilaBusca: { d: 'Quantos produtos estão na fila de busca e quantos estão em rodada (uso interno).', c:
    `SELECT SUM(CASE WHEN ULTIMA_RODADA_EM IS NULL THEN 1 ELSE 0 END) AS NA_FILA,
       SUM(CASE WHEN ULTIMA_RODADA_EM > DATE_FORMAT(DATE_SUB(${BRNOW}, INTERVAL 5 MINUTE),'%Y-%m-%dT%H:%i:%s') THEN 1 ELSE 0 END) AS EM_RODADA
     FROM MC_PRODUTO WHERE STATUS = 'ATIVO' AND ({{produtoId}} = 0 OR ID = {{produtoId}})` },
  intMarcarInicio: { d: 'Marca o início da rodada de um produto (uso interno).', c: `UPDATE MC_PRODUTO SET ULTIMA_RODADA_EM = ${NOWS} WHERE ID = {{produtoId}}` },
  intVencidos: { d: 'Produtos que passaram da data de fim (uso interno).', c: `SELECT ID, NOME, DATA_FIM FROM MC_PRODUTO WHERE STATUS = 'ATIVO' AND DATA_FIM IS NOT NULL AND DATA_FIM < ${HOJE} LIMIT 50` },
  intEncerrar: { d: 'Encerra o monitoramento de um produto (uso interno).', c:
    `UPDATE MC_PRODUTO SET STATUS = 'ENCERRADO', MOTIVO_FIM = '{{motivo}}', ENCERRADO_EM = ${NOWS} WHERE ID = {{produtoId}} AND STATUS = 'ATIVO';
     UPDATE MC_ESTADO_OFERTA SET ATIVO = 0 WHERE PRODUTO_ID = {{produtoId}}` },
  intLembretesDevidos: { d: 'Ofertas que pedem o lembrete diário agora (uso interno).', c:
    `SELECT E.PRODUTO_ID, E.OFERTA_ID, E.FAIXA, E.PRECO_AVISADO, P.NOME
     FROM MC_ESTADO_OFERTA E JOIN MC_PRODUTO P ON P.ID = E.PRODUTO_ID
     JOIN MC_CONFIG C ON C.CHAVE = 'HORA_LEMBRETE'
     WHERE E.ATIVO = 1 AND P.STATUS = 'ATIVO' AND (E.ULTIMO_LEMBRETE_DIA IS NULL OR E.ULTIMO_LEMBRETE_DIA < ${HOJE})
       AND DATE_FORMAT(${BRNOW},'%H:%i') >= C.VALOR LIMIT 50` },
  intMarcarLembrete: { d: 'Marca o lembrete do dia como enviado (uso interno).', c: `UPDATE MC_ESTADO_OFERTA SET ULTIMO_LEMBRETE_DIA = ${HOJE} WHERE PRODUTO_ID = {{produtoId}}` },
  intPerguntaAberta: { d: 'Última pergunta do assistente ainda sem resposta (uso interno).', c:
    `SELECT ID, PERGUNTA, PRODUTO_ID FROM MC_MENSAGEM WHERE PERGUNTA IS NOT NULL AND RESPOSTA IS NULL ORDER BY ID DESC LIMIT 1` },
  intPergunta: { d: 'Lê uma pergunta pelo id (uso interno).', c: `SELECT ID, PERGUNTA, PRODUTO_ID, RESPOSTA FROM MC_MENSAGEM WHERE ID = {{mensagemId}} AND PERGUNTA IS NOT NULL` },
  intResponder: { d: 'Registra a resposta a uma pergunta (uso interno).', c: `UPDATE MC_MENSAGEM SET RESPOSTA = CASE WHEN '{{resposta}}' = 'SIM' THEN 'SIM' ELSE 'NAO' END, RESPONDIDA_EM = ${NOWS} WHERE ID = {{mensagemId}} AND RESPOSTA IS NULL` },
  intSimilares: { d: 'Liga ou desliga a busca de similares (uso interno).', c: `UPDATE MC_PRODUTO SET BUSCA_SIMILARES = CASE WHEN {{valor}} = 1 THEN 1 ELSE 0 END WHERE ID = {{produtoId}}` },
  intBuscarProdutoNome: { d: 'Procura produto ativo pelo nome (uso interno).', c: `SELECT ID, NOME FROM MC_PRODUTO WHERE STATUS = 'ATIVO' AND NOME LIKE CONCAT('%', '{{nome}}', '%') ORDER BY ID DESC LIMIT 5` },
  intProdutoPorLink: { d: 'Produto ativo já cadastrado com o mesmo link (uso interno).', c: `SELECT ID, NOME FROM MC_PRODUTO WHERE STATUS = 'ATIVO' AND LINK_ORIGEM = '{{link}}' LIMIT 1` },
  intLimpeza: { d: 'Apaga rodadas e ofertas com mais de 90 dias (retenção) (uso interno).', c:
    `DELETE FROM MC_OFERTA WHERE CRIADO_EM < DATE_FORMAT(DATE_SUB(${BRNOW}, INTERVAL 90 DAY),'%Y-%m-%dT%H:%i:%s');
     DELETE FROM MC_RODADA WHERE INICIO < DATE_FORMAT(DATE_SUB(${BRNOW}, INTERVAL 90 DAY),'%Y-%m-%dT%H:%i:%s')` },
  intKeysPrints: { d: 'Chaves dos prints pedidos (uso interno da tela de prints).', c:
    `SELECT 'O' AS T, ID, PRINT_KEY AS CHAVE FROM MC_OFERTA WHERE FIND_IN_SET(ID, '{{ofertaIds}}') AND PRINT_KEY IS NOT NULL
     UNION ALL SELECT 'P', ID, PRINT_ORIGEM_KEY FROM MC_PRODUTO WHERE FIND_IN_SET(ID, '{{produtoIds}}') AND PRINT_ORIGEM_KEY IS NOT NULL LIMIT 100` },
  intAdicionarLoja: { d: 'Acrescenta uma loja à lista fixa (uso interno e tela).', c:
    `INSERT INTO MC_LOJA (NOME, DOMINIO, URL_BUSCA, TIPO, PADRAO, ATIVA, ORDEM, CRIADO_EM)
     SELECT '{{nome}}', ${NN('dominio')}, COALESCE(${NN('urlBusca')}, CASE WHEN ${NN('dominio')} IS NULL THEN '' ELSE CONCAT('https://lite.duckduckgo.com/lite/?q=site:', ${NN('dominio')}, '+{q}') END), 'LOJA', 0, 1, 200, ${NOWS} FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM MC_LOJA WHERE LOWER(NOME) = LOWER('{{nome}}') OR (DOMINIO IS NOT NULL AND DOMINIO = ${NN('dominio')}))` },
  intSalvarHorario: { d: 'Muda o horário do lembrete diário (uso interno e tela).', c:
    `UPDATE MC_CONFIG SET VALOR = '{{hora}}', ATUALIZADO_EM = ${NOWS} WHERE CHAVE = 'HORA_LEMBRETE' AND '{{hora}}' REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]$'` },

  intConfigGemini: { d: 'Conexões e modelos do Gemini da configuração (uso interno).', c:
    `SELECT CHAVE, VALOR FROM MC_CONFIG WHERE CHAVE IN ('GEMINI_CONEXOES', 'MODELO_ANALISE')` },
  intIaSemCota: { d: 'Marca que a cota da IA acabou (uso interno).', c:
    `INSERT INTO MC_CONFIG (CHAVE, VALOR, ATUALIZADO_EM) VALUES ('IA_SEM_COTA', 'true', ${NOWS}) ON DUPLICATE KEY UPDATE VALOR = 'true', ATUALIZADO_EM = ${NOWS}` },

  telaConversa: { d: 'Mensagens da conversa, da mais nova para a mais antiga, paginadas.', c:
    `SELECT ${MSG_COLS}, P.NOME AS PRODUTO_NOME, P.STATUS AS PRODUTO_STATUS
     FROM MC_MENSAGEM M LEFT JOIN MC_PRODUTO P ON P.ID = M.PRODUTO_ID
     WHERE ({{antesDe}} = 0 OR M.ID < {{antesDe}}) AND M.ID > {{depoisDe}}
     ORDER BY M.ID DESC LIMIT {{limite}}` },
  telaNotificacoes: { d: 'Rodadas em que o menor preço ficou abaixo do da rodada anterior (ou do preço de cadastro, na primeira), paginadas.', c:
    `WITH MENOR_R AS (
       SELECT R.ID, R.PRODUTO_ID, R.INICIO, R.VALOR_MERCADO, R.LOJAS_NO_CALCULO, P.PRECO_POR_ORIGEM,
         (SELECT MIN(O.PRECO_COMPARADO) FROM MC_OFERTA O WHERE O.RODADA_ID = R.ID AND O.NO_CALCULO = 1) AS MENOR
       FROM MC_RODADA R JOIN MC_PRODUTO P ON P.ID = R.PRODUTO_ID
       WHERE ({{produtoId}} = 0 OR R.PRODUTO_ID = {{produtoId}})),
     SEQ_R AS (
       SELECT M.*, COALESCE(LAG(M.MENOR) OVER (PARTITION BY M.PRODUTO_ID ORDER BY M.ID), M.PRECO_POR_ORIGEM) AS ANTERIOR,
         CASE WHEN LAG(M.ID) OVER (PARTITION BY M.PRODUTO_ID ORDER BY M.ID) IS NULL THEN 1 ELSE 0 END AS PRIMEIRA
       FROM MENOR_R M WHERE M.MENOR IS NOT NULL)
     SELECT S.ID AS RODADA_ID, S.PRODUTO_ID, P.NOME, P.STATUS, S.INICIO, S.VALOR_MERCADO, S.LOJAS_NO_CALCULO, S.MENOR, S.ANTERIOR, S.PRIMEIRA,
       O.ID AS OFERTA_ID, O.LOJA_NOME, O.FONTE, O.URL, O.FAIXA, O.DESCONTO, O.VENDEDOR, O.VENDEDOR_TERCEIRO, O.RECONDICIONADO, O.TIPO, O.VARIACAO,
       O.PRECO_POR, O.PRECO_DE, O.CONDICOES, CASE WHEN O.PRINT_KEY IS NULL THEN 0 ELSE 1 END AS TEM_PRINT,
       COUNT(*) OVER () AS TOTAL
     FROM SEQ_R S
     JOIN MC_PRODUTO P ON P.ID = S.PRODUTO_ID
     JOIN MC_OFERTA O ON O.ID = (SELECT O2.ID FROM MC_OFERTA O2 WHERE O2.RODADA_ID = S.ID AND O2.NO_CALCULO = 1 ORDER BY O2.PRECO_COMPARADO, O2.ID LIMIT 1)
     WHERE S.ANTERIOR IS NOT NULL AND S.MENOR < S.ANTERIOR - 0.009
     ORDER BY S.ID DESC LIMIT {{limite}} OFFSET {{offset}}` },
  telaProdutos: { d: 'Produtos monitorados com o resumo da última rodada, paginados.', c:
    `SELECT P.ID, P.NOME, P.MARCA, P.MODELO, P.TERMO_BUSCA, P.CARACTERISTICAS, P.LINK_ORIGEM, P.LOJA_ORIGEM, P.PRECO_DE_ORIGEM, P.PRECO_POR_ORIGEM, P.BUSCA_SIMILARES, P.INCLUIR_USADOS, P.DATA_FIM, P.STATUS, P.MOTIVO_FIM, P.CRIADO_EM, P.ULTIMA_RODADA_EM,
       R.VALOR_MERCADO, R.LOJAS_NO_CALCULO, R.OFERTAS,
       (SELECT MIN(O.PRECO_COMPARADO) FROM MC_OFERTA O WHERE O.RODADA_ID = R.ID AND O.NO_CALCULO = 1) AS MELHOR_PRECO,
       E.ATIVO AS OFERTA_ATIVA, E.FAIXA AS FAIXA_ATUAL,
       COUNT(*) OVER () AS TOTAL
     FROM MC_PRODUTO P
     LEFT JOIN MC_RODADA R ON R.ID = (SELECT MAX(R2.ID) FROM MC_RODADA R2 WHERE R2.PRODUTO_ID = P.ID)
     LEFT JOIN MC_ESTADO_OFERTA E ON E.PRODUTO_ID = P.ID
     WHERE ('{{status}}' = 'TODOS' OR P.STATUS = '{{status}}')
     ORDER BY CASE WHEN P.STATUS = 'ATIVO' THEN 0 ELSE 1 END, P.ID DESC
     LIMIT {{limite}} OFFSET {{offset}}` },
  telaUltimaRodada: { d: 'Preços por loja da última rodada de um produto.', c:
    `SELECT O.ID, O.LOJA_NOME, O.FONTE, O.TITULO, O.URL, O.TIPO, O.VARIACAO, O.VENDEDOR, O.VENDEDOR_TERCEIRO, O.RECONDICIONADO, O.USADO, O.PRECO_DE, O.PRECO_POR, O.FRETE, O.FRETE_GRATIS_ACIMA, O.PRECO_COMPARADO, O.CONDICOES, O.DESCONTO, O.FAIXA, O.NO_CALCULO,
       CASE WHEN O.PRINT_KEY IS NULL THEN 0 ELSE 1 END AS TEM_PRINT, R.VALOR_MERCADO, R.INICIO, R.SITUACAO_LOJAS, R.FAIXAS_USADAS
     FROM MC_RODADA R LEFT JOIN MC_OFERTA O ON O.RODADA_ID = R.ID
     WHERE R.ID = (SELECT MAX(ID) FROM MC_RODADA WHERE PRODUTO_ID = {{produtoId}})
     ORDER BY CASE O.TIPO WHEN 'SIMILAR' THEN 1 ELSE 0 END, O.PRECO_COMPARADO LIMIT 100` },
  telaGrafico: { d: 'Histórico de preço de um produto: menor preço e valor de mercado por rodada (até 90 dias).', c:
    `SELECT R.ID, R.INICIO, R.VALOR_MERCADO,
       (SELECT MIN(O.PRECO_COMPARADO) FROM MC_OFERTA O WHERE O.RODADA_ID = R.ID AND O.NO_CALCULO = 1) AS MENOR_PRECO
     FROM MC_RODADA R WHERE R.PRODUTO_ID = {{produtoId}}
     ORDER BY R.ID DESC LIMIT 400` },
  telaConfig: { d: 'Faixas, horário do lembrete e lojas (configurações).', c:
    `SELECT 'FAIXA' AS GRUPO, ID, NOME, CAST(MIN_PCT AS CHAR) AS VALOR, ORDEM, NULL AS DOMINIO, NULL AS URL_BUSCA, NULL AS PADRAO, NULL AS ATIVA, NULL AS TIPO FROM MC_FAIXA
     UNION ALL SELECT 'CONFIG', 0, CHAVE, VALOR, 0, NULL, NULL, NULL, NULL, NULL FROM MC_CONFIG
     UNION ALL SELECT 'LOJA', ID, NOME, NULL, ORDEM, DOMINIO, URL_BUSCA, PADRAO, ATIVA, TIPO FROM MC_LOJA
     ORDER BY GRUPO, ORDEM, ID LIMIT 300` },
  salvarFaixas: { d: 'Grava em lote nomes e limites das faixas (valem a partir da rodada seguinte).', c:
    `UPDATE MC_FAIXA F JOIN SEQ S ON S.N < JSON_LENGTH('{{lista}}') AND F.ID = ${int(ja('lista','id'))}
     SET F.NOME = LEFT(${ja('lista','nome')}, 60), F.MIN_PCT = LEAST(100, GREATEST(0.01, ${num(ja('lista','minPct'))})), F.ATUALIZADO_EM = ${NOWS}
     WHERE ${ja('lista','nome')} IS NOT NULL AND ${ja('lista','minPct')} IS NOT NULL` },
  salvarProduto: { d: 'Atualiza as opções de um produto (similares, usados, data de fim, termos de busca).', c:
    `UPDATE MC_PRODUTO SET MARCA = ${NN('marca')}, MODELO = ${NN('modelo')}, TERMO_BUSCA = ${NN('termo')}, CARACTERISTICAS = ${NN('caracteristicas')},
       BUSCA_SIMILARES = CASE WHEN {{buscaSimilares}} = 1 THEN 1 ELSE 0 END, INCLUIR_USADOS = CASE WHEN {{incluirUsados}} = 1 THEN 1 ELSE 0 END,
       DATA_FIM = CASE WHEN '{{dataFim}}' REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN '{{dataFim}}' ELSE NULL END
     WHERE ID = {{produtoId}}` },
  cancelarProduto: { d: 'Cancela o monitoramento de um produto (o histórico fica guardado).', c:
    `INSERT INTO MC_MENSAGEM (CRIADO_EM, AUTOR, USUARIO_ID, TIPO, PRODUTO_ID, TEXTO)
       SELECT ${NOWS}, 'ASSISTENTE', :VAR_USER, 'FIM', ID, CONCAT('Monitoramento de "', NOME, '" cancelado. Não faço mais rodadas nem avisos dele; o histórico fica guardado.') FROM MC_PRODUTO WHERE ID = {{produtoId}} AND STATUS = 'ATIVO';
     UPDATE MC_PRODUTO SET STATUS = 'ENCERRADO', MOTIVO_FIM = 'cancelado', ENCERRADO_EM = ${NOWS} WHERE ID = {{produtoId}} AND STATUS = 'ATIVO';
     UPDATE MC_ESTADO_OFERTA SET ATIVO = 0 WHERE PRODUTO_ID = {{produtoId}}` },
  alternarLoja: { d: 'Liga ou desliga uma loja acrescentada pelo usuário (as 13 padrão ficam sempre ligadas).', c: `UPDATE MC_LOJA SET ATIVA = CASE WHEN {{ativa}} = 1 THEN 1 ELSE 0 END WHERE ID = {{lojaId}} AND PADRAO = 0` },
  telaExportar: { d: 'Andamento das exportações e situação do envio ao GitHub (nunca devolve o token).', c:
    `SELECT * FROM (SELECT 'ITEM' AS GRUPO, ID, TIPO AS A, NOME AS B, ESTADO AS C, ETAPA AS D, ERRO AS E, TAMANHO_BYTES AS N, INICIOU_EM AS F, TERMINOU_EM AS G FROM EXPORT_LEVE ORDER BY ID DESC LIMIT 12) ITENS
     UNION ALL
     SELECT 'GIT', 0, CHAVE, VALOR, NULL, NULL, NULL, NULL, NULL, NULL FROM GIT_CONFIG WHERE CHAVE IN ('REPO','BRANCH','ULTIMO_ENVIO_EM','ULTIMO_COMMIT','ULTIMO_COMMIT_URL','ENVIO_ESTADO','ENVIO_ETAPA','ENVIO_ERRO','ENVIO_ARQUIVOS')
     UNION ALL
     SELECT 'GIT', 0, 'TOKEN_OK', CASE WHEN EXISTS (SELECT 1 FROM GIT_CONFIG WHERE CHAVE = 'TOKEN' AND VALOR <> '') THEN '1' ELSE '0' END, NULL, NULL, NULL, NULL, NULL, NULL FROM DUAL` },
  removerLoja: { d: 'Remove uma loja acrescentada pelo usuário.', c: `DELETE FROM MC_LOJA WHERE ID = {{lojaId}} AND PADRAO = 0` },
};
export const CRON_SFS = ['ciclo'];

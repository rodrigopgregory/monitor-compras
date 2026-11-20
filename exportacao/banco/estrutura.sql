-- Estrutura do banco do Monitor de Compras
-- Gerado em 2026-11-19T23:11:28 (Brasília)

CREATE TABLE IF NOT EXISTS `EXPORT_CODIGO` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `TIPO` varchar(10) NOT NULL,
  `CHAVE_ARQUIVO` varchar(300) NOT NULL,
  `COMMIT_GIT` varchar(40) NULL,
  `ARQUIVOS` int NULL,
  `TAMANHO_BYTES` bigint NULL,
  `CRIADO_EM` varchar(19) NOT NULL,
  PRIMARY KEY (`ID`)
) COMMENT='Pacote do codigo (fonte e historico git) montado na caixa para a exportacao. RETENCAO: ultima versao de cada tipo';

CREATE TABLE IF NOT EXISTS `EXPORT_LEVE` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `TIPO` varchar(10) NOT NULL,
  `NOME` varchar(120) NOT NULL,
  `ESTADO` varchar(10) NOT NULL DEFAULT 'ENVIANDO',
  `ETAPA` varchar(120) NULL,
  `ERRO` varchar(500) NULL,
  `CHAVE_ARQUIVO` varchar(300) NULL,
  `TAMANHO_BYTES` bigint NULL,
  `INICIOU_EM` varchar(19) NOT NULL,
  `TERMINOU_EM` varchar(19) NULL,
  KEY `IX_EXPORT_LEVE_ESTADO` (`ESTADO`),
  PRIMARY KEY (`ID`)
) COMMENT='Exportacoes do app (leve e completa) e seu andamento. RETENCAO: 7 dias, so as 5 mais recentes ficam com arquivo';

CREATE TABLE IF NOT EXISTS `MC_CONFIG` (
  `CHAVE` varchar(60) NOT NULL,
  `VALOR` varchar(200) NULL,
  `ATUALIZADO_EM` varchar(19) NULL,
  PRIMARY KEY (`CHAVE`)
) COMMENT='Configuracoes do assistente (horario do lembrete). RETENCAO: tudo, parametro';

CREATE TABLE IF NOT EXISTS `MC_ESTADO_OFERTA` (
  `PRODUTO_ID` int NOT NULL,
  `ATIVO` tinyint NOT NULL DEFAULT '0',
  `FAIXA` varchar(60) NULL,
  `FAIXA_ORDEM` int NULL,
  `PRECO_AVISADO` decimal(14,2) NULL,
  `OFERTA_ID` int NULL,
  `DESDE` varchar(19) NULL,
  `ULTIMO_AVISO_EM` varchar(19) NULL,
  `ULTIMO_LEMBRETE_DIA` varchar(10) NULL,
  PRIMARY KEY (`PRODUTO_ID`)
) COMMENT='Oferta em andamento de cada produto (para lembrete, queda e oportunidade perdida). RETENCAO: ultima execucao';

CREATE TABLE IF NOT EXISTS `MC_FAIXA` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `ORDEM` int NOT NULL,
  `NOME` varchar(60) NOT NULL,
  `MIN_PCT` decimal(5,2) NOT NULL,
  `ATUALIZADO_EM` varchar(19) NULL,
  PRIMARY KEY (`ID`)
) COMMENT='Faixas de oportunidade editaveis (nome e desconto minimo). RETENCAO: tudo, parametro';

CREATE TABLE IF NOT EXISTS `MC_LOJA` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `NOME` varchar(120) NOT NULL,
  `DOMINIO` varchar(120) NULL,
  `URL_BUSCA` varchar(500) NOT NULL,
  `TIPO` varchar(20) NOT NULL DEFAULT 'LOJA',
  `PADRAO` tinyint NOT NULL DEFAULT '0',
  `ATIVA` tinyint NOT NULL DEFAULT '1',
  `APELIDOS` varchar(200) NULL,
  `ORDEM` int NOT NULL DEFAULT '100',
  `CRIADO_EM` varchar(19) NOT NULL,
  PRIMARY KEY (`ID`)
) COMMENT='Lista fixa de lojas consultadas em toda rodada (13 padrao + as do usuario) e a busca aberta. RETENCAO: tudo, cadastro';

CREATE TABLE IF NOT EXISTS `MC_MENSAGEM` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `CRIADO_EM` varchar(19) NOT NULL,
  `AUTOR` varchar(12) NOT NULL,
  `USUARIO_ID` int NULL,
  `TIPO` varchar(20) NOT NULL,
  `PRODUTO_ID` int NULL,
  `OFERTA_ID` int NULL,
  `TEXTO` text NOT NULL,
  `DADOS` mediumtext NULL,
  `PERGUNTA` varchar(20) NULL,
  `RESPOSTA` varchar(10) NULL,
  `RESPONDIDA_EM` varchar(19) NULL,
  KEY `IX_MC_MSG_PERG` (`PERGUNTA`, `RESPOSTA`),
  PRIMARY KEY (`ID`)
) COMMENT='Conversa do assistente: avisos, lembretes, perguntas e mensagens do usuario. RETENCAO: tudo, conversa do usuario';

CREATE TABLE IF NOT EXISTS `MC_OFERTA` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `RODADA_ID` int NOT NULL,
  `PRODUTO_ID` int NOT NULL,
  `IDX` int NOT NULL,
  `LOJA_ID` int NULL,
  `LOJA_NOME` varchar(120) NOT NULL,
  `FONTE` varchar(120) NULL,
  `FONTE_URL` varchar(1000) NULL,
  `TITULO` varchar(300) NOT NULL,
  `URL` varchar(1000) NULL,
  `TIPO` varchar(10) NOT NULL,
  `VARIACAO` varchar(120) NULL,
  `VENDEDOR` varchar(120) NULL,
  `VENDEDOR_TERCEIRO` tinyint NOT NULL DEFAULT '0',
  `RECONDICIONADO` tinyint NOT NULL DEFAULT '0',
  `USADO` tinyint NOT NULL DEFAULT '0',
  `PRECO_DE` decimal(14,2) NULL,
  `PRECO_POR` decimal(14,2) NOT NULL,
  `FRETE` decimal(14,2) NULL,
  `FRETE_GRATIS_ACIMA` decimal(14,2) NULL,
  `PRECO_COMPARADO` decimal(14,2) NOT NULL,
  `CONDICOES` varchar(300) NULL,
  `PRINT_KEY` varchar(300) NULL,
  `PRINT_FONTE` varchar(1200) NULL,
  `PRINT_TENTATIVAS` int NOT NULL DEFAULT '0',
  `DESCONTO` decimal(6,2) NULL,
  `FAIXA` varchar(60) NULL,
  `NO_CALCULO` tinyint NOT NULL DEFAULT '0',
  `CRIADO_EM` varchar(19) NOT NULL,
  KEY `IX_MC_OFERTA_PRINT` (`PRINT_KEY`),
  KEY `IX_MC_OFERTA_PROD` (`PRODUTO_ID`, `CRIADO_EM`),
  KEY `IX_MC_OFERTA_RODADA` (`RODADA_ID`),
  PRIMARY KEY (`ID`)
) COMMENT='Precos encontrados em cada rodada, com frete, condicoes e print. RETENCAO: 90 dias';

CREATE TABLE IF NOT EXISTS `MC_PRODUTO` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `CODIGO` varchar(40) NULL,
  `CRIADO_POR` int NULL,
  `NOME` varchar(300) NOT NULL,
  `MARCA` varchar(80) NULL,
  `MODELO` varchar(80) NULL,
  `TERMO_BUSCA` varchar(200) NULL,
  `CARACTERISTICAS` varchar(200) NULL,
  `LINK_ORIGEM` varchar(1000) NOT NULL,
  `LOJA_ORIGEM` varchar(120) NULL,
  `PRECO_DE_ORIGEM` decimal(14,2) NULL,
  `PRECO_POR_ORIGEM` decimal(14,2) NULL,
  `CONDICOES_ORIGEM` varchar(300) NULL,
  `PRINT_ORIGEM_KEY` varchar(300) NULL,
  `PRINT_ORIGEM_FONTE` varchar(1200) NULL,
  `PRINT_TENTATIVAS` int NOT NULL DEFAULT '0',
  `BUSCA_SIMILARES` tinyint NOT NULL DEFAULT '0',
  `INCLUIR_USADOS` tinyint NOT NULL DEFAULT '0',
  `DATA_FIM` varchar(10) NULL,
  `STATUS` varchar(20) NOT NULL DEFAULT 'ATIVO',
  `MOTIVO_FIM` varchar(60) NULL,
  `CRIADO_EM` varchar(19) NOT NULL,
  `ENCERRADO_EM` varchar(19) NULL,
  `ULTIMA_RODADA_EM` varchar(19) NULL,
  KEY `IX_MC_PRODUTO_STATUS` (`STATUS`),
  PRIMARY KEY (`ID`),
  UNIQUE KEY `UX_MC_PRODUTO_COD` (`CODIGO`)
) COMMENT='Produtos monitorados, cadastrados por link. RETENCAO: tudo, cadastro do usuario';

CREATE TABLE IF NOT EXISTS `MC_RODADA` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `CODIGO` varchar(40) NOT NULL,
  `PRODUTO_ID` int NOT NULL,
  `INICIO` varchar(19) NOT NULL,
  `FIM` varchar(19) NULL,
  `VALOR_MERCADO` decimal(14,2) NULL,
  `LOJAS_CONSULTADAS` int NULL,
  `LOJAS_NO_CALCULO` int NULL,
  `OFERTAS` int NULL,
  `SIMILARES` int NULL,
  `FAIXAS_USADAS` varchar(500) NULL,
  `SITUACAO_LOJAS` text NULL,
  KEY `IX_MC_RODADA_PROD` (`PRODUTO_ID`, `INICIO`),
  PRIMARY KEY (`ID`),
  UNIQUE KEY `UX_MC_RODADA_COD` (`CODIGO`)
) COMMENT='Uma rodada de busca por produto, de hora em hora. RETENCAO: 90 dias';

CREATE TABLE IF NOT EXISTS `SEQ` (
  `N` int NOT NULL,
  PRIMARY KEY (`N`)
) COMMENT='Numeros 0-199 para ler listas JSON em lote. RETENCAO: tudo, tabela auxiliar fixa';

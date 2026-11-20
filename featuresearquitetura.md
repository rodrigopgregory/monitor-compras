# Monitor de Compras — features e arquitetura

Segue o ESCOPO.md (v2.1). Resumo da arquitetura:

- Tabelas `MC_*` (produto, loja, faixa, config, rodada, oferta, estado da oferta, mensagem). Ofertas e rodadas ficam 90 dias.
- SF `ciclo` (cron a cada 5 min): encerra produtos com data de fim vencida, manda o lembrete diário no horário de `HORA_LEMBRETE`, processa prints pendentes e dispara `rodadaProduto` para quem passou de 1 h sem rodada.
- SF `rodadaProduto`: consulta as lojas ativas e a busca aberta na web (DuckDuckGo lite); loja bloqueada é tentada de novo por `site:` na busca. Calcula valor de mercado (média dos preços comparados, 1 por loja), faixa, avisos (OFERTA, QUEDA, PERDIDA).
- SF `enviarMensagem`: a conversa (link = cadastro, sim/não, "lembrete às 20h", "adicionar loja X site", cancelar).
- Prints: mshots (WordPress) baixados e guardados como arquivo privado; links por `linksPrints`, em lote.
- Telas: Conversa, Produtos, Histórico, Configurações.

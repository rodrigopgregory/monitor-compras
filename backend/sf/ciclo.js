const t0 = Date.now();
const feito = { encerrados: 0, lembretes: 0, prints: 0, rodadas: [] };
for (const p of await linhas('intVencidos', {})) {
  await sf('intEncerrar', { produtoId: Number(p.ID), motivo: 'data de fim' });
  const [a, m, d] = [p.DATA_FIM.slice(0, 4), p.DATA_FIM.slice(5, 7), p.DATA_FIM.slice(8, 10)];
  await mensagem({ tipo: 'FIM', produtoId: Number(p.ID), texto: 'O monitoramento de "' + p.NOME + '" terminou: a data de fim era ' + d + '/' + m + '/' + a + '. Não faço mais rodadas nem avisos dele; o histórico fica guardado na tela de histórico.' });
  feito.encerrados++;
}
for (const l of await linhas('intLembretesDevidos', {})) {
  const o = (await linhas('intOfertaResumo', { ofertaId: Number(l.OFERTA_ID || 0) }))[0];
  const produtoId = Number(l.PRODUTO_ID);
  if (o) {
    const hist = (await linhas('intHistoricoResumo', { produtoId }))[0] || {};
    const marcasO = [o.TIPO === 'VARIACAO' && o.VARIACAO ? 'variação: ' + o.VARIACAO : null, Number(o.VENDEDOR_TERCEIRO) ? 'vendedor terceiro' : null, Number(o.RECONDICIONADO) ? 'recondicionado' : null].filter(Boolean);
    const por = Number(o.PRECO_POR), cmp = Number(o.PRECO_COMPARADO), vm = o.VALOR_MERCADO != null ? Number(o.VALOR_MERCADO) : null;
    const fga = o.FRETE_GRATIS_ACIMA != null ? Number(o.FRETE_GRATIS_ACIMA) : null, fr = o.FRETE != null ? Number(o.FRETE) : null;
    const freteTxt = (fga != null && por > fga) ? 'frete grátis (acima de ' + brl(fga) + ')' : (fr == null ? 'frete não informado' : fr === 0 ? 'frete grátis' : 'frete ' + brl(fr));
    await mensagem({
      tipo: 'LEMBRETE', produtoId, ofertaId: Number(o.ID),
      texto: 'Lembrete do dia: a oferta de ' + l.NOME + ' continua — ' + o.FAIXA + ' na ' + o.LOJA_NOME + '. Preço ' + brl(por) + ', ' + freteTxt + ', preço comparado ' + brl(cmp) + '. Valor de mercado ' + brl(vm) + ' (' + pct(o.DESCONTO != null ? Number(o.DESCONTO) : null) + ' abaixo).' + (marcasO.length ? ' [' + marcasO.join(', ') + ']' : ''),
      dados: { produto: l.NOME, produtoId, ofertaId: Number(o.ID), loja: o.LOJA_NOME, fonte: o.FONTE !== o.LOJA_NOME ? o.FONTE : null, url: o.URL, titulo: o.TITULO, faixa: o.FAIXA, desconto: o.DESCONTO != null ? Number(o.DESCONTO) : null,
        precoDe: o.PRECO_DE != null ? Number(o.PRECO_DE) : null, precoPor: por, frete: fr, freteGratisAcima: fga, comparado: cmp, condicoes: o.CONDICOES, valorMercado: vm, marcas: marcasO,
        historico: { menor: hist.MENOR != null ? Number(hist.MENOR) : null, maior: hist.MAIOR != null ? Number(hist.MAIOR) : null, rodadas: Number(hist.RODADAS || 0), desde: hist.DESDE || null } },
    });
  }
  await sf('intMarcarLembrete', { produtoId });
  feito.lembretes++;
}
const agora = agoraBR();
if (agora.slice(11, 13) === '03' && Number(agora.slice(14, 16)) < 5) await sf('intLimpeza', {});
feito.prints = await processarPrints(20);
const maxRodadas = Number(event.maxRodadas || 2);
for (let i = 0; i < maxRodadas && Date.now() - t0 < 60000; i++) {
  const p = (await linhas('intProximoProduto', {}))[0];
  if (!p) break;
  await sf('intMarcarInicio', { produtoId: Number(p.ID) });
  await mitra.executeServerFunctionAsyncMitra({ projectId, serverFunctionId: SFID.rodadaProduto, input: { produtoId: Number(p.ID) } });
  feito.rodadas.push(Number(p.ID));
}
return feito;

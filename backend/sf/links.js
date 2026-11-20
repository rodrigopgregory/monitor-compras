const ofertaIds = (Array.isArray(event.ofertaIds) ? event.ofertaIds : []).map(Number).filter(n => n > 0).slice(0, 50);
const produtoIds = (Array.isArray(event.produtoIds) ? event.produtoIds : []).map(Number).filter(n => n > 0).slice(0, 50);
if (!ofertaIds.length && !produtoIds.length) return { links: {} };
const rows = await linhas('intKeysPrints', { ofertaIds: ofertaIds.join(','), produtoIds: produtoIds.join(',') });
const links = {};
for (const r of rows) {
  const l = await mitra.getFileLinkMitra({ projectId, key: r.CHAVE, ttlSeconds: 1800 });
  const url = l && l.result && l.result.url;
  if (url) links[(r.T === 'O' ? 'o' : 'p') + r.ID] = url;
}
return { links, validoAte: Date.now() + 1700 * 1000 };

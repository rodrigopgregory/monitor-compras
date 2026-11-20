const produtoId = Number(event.produtoId);
if (!produtoId) return { error: 'produtoId obrigatório' };
const t0 = Date.now();
const inicio = agoraBR();
const prod = (await linhas('intProduto', { produtoId }))[0];
if (!prod) return { error: 'Produto não encontrado' };
if (prod.STATUS !== 'ATIVO') return { ignorado: 'produto encerrado' };
if (prod.DATA_FIM && prod.DATA_FIM < hojeBR()) return { ignorado: 'passou da data de fim' };
await sf('intMarcarInicio', { produtoId });
const lojas = await linhas('intLojas', {});
const faixas = await linhas('intFaixas', {});
const ch = chavesProduto(prod);
const termo = prod.TERMO_BUSCA || termoBusca([prod.MARCA, prod.MODELO && !norm(prod.NOME).includes(norm(prod.MODELO)) ? prod.MODELO : '', nomeLimpo(prod.NOME)].filter(Boolean).join(' '));
const termoSim = prod.CARACTERISTICAS || ch.caract.join(' ');
const situacao = [];
const encontrados = [];
const lojaPorNome = {};
for (const l of lojas) lojaPorNome[norm(l.NOME)] = l;
const hostLoja = {};
for (const l of lojas) if (l.DOMINIO) hostLoja[l.DOMINIO.replace(/^www\./, '')] = l;
function lojaDoAnuncio(a, lojaFonte) {
  if (lojaFonte.TIPO === 'BUSCA' || /zoom|buscape|google/i.test(lojaFonte.NOME)) {
    const nomeVia = lojaDeVia(a.via);
    if (nomeVia) { const l = lojaPorNome[norm(nomeVia)]; return { nome: l ? l.NOME : nomeVia, id: l ? l.ID : null }; }
    if (lojaFonte.TIPO === 'BUSCA') {
      const h = a.host;
      const l = Object.keys(hostLoja).find(d => h === d || h.endsWith('.' + d));
      if (l) return { nome: hostLoja[l].NOME, id: hostLoja[l].ID };
      return { nome: lojaDeHost(h), id: null };
    }
  }
  return { nome: lojaFonte.NOME, id: lojaFonte.ID };
}
function aceitar(a, lojaFonte, tipoBusca) {
  const c = classificar(a.titulo, prod, ch);
  if (!c) return;
  if (tipoBusca === 'SIMILAR' && c.tipo !== 'SIMILAR') return;
  if (c.tipo === 'SIMILAR' && !Number(prod.BUSCA_SIMILARES)) return;
  if (c.usado && !Number(prod.INCLUIR_USADOS)) return;
  if (!a.precos || !(a.precos.por > 0)) return;
  const loja = lojaDoAnuncio(a, lojaFonte);
  const textoT = a.texto || '';
  const recond = c.recond || /recondicionad|renovad[oa] amazon|amazon renewed/.test(textoT);
  let terceiro = 0;
  if (MARKETPLACES.test(loja.nome)) {
    if (a.vendedor) terceiro = /amazon|mercado livre/i.test(a.vendedor) ? 0 : 1;
    else if (loja.nome === 'Mercado Livre') terceiro = /loja oficial/.test(textoT) ? 0 : 1;
  }
  encontrados.push({
    lojaId: loja.id, loja: loja.nome, fonte: lojaFonte.NOME, fonteUrl: lojaFonte._url, titulo: a.titulo, url: a.url,
    tipo: c.tipo, variacao: c.variacao, marcaSimilar: c.marcaSimilar || null, mesmaEmbalagem: !/embalagem|idade/.test(c.variacao || ''),
    vendedor: a.vendedor || null, terceiro, recond: recond ? 1 : 0, usado: c.usado ? 1 : 0,
    de: a.precos.de, por: a.precos.por, frete: a.precos.frete, freteGratisAcima: a.precos.freteGratisAcima, condicoes: a.precos.condicoes,
  });
}
async function completarPrecos(lista, max) {
  let abertas = 0;
  for (const a of lista) {
    if (a.precos && a.precos.por > 0) continue;
    if (abertas >= max || Date.now() - t0 > 190000) break;
    if (!a.url || !a.host || /duckduckgo|buscape|zoom\.com|google\./.test(a.host)) continue;
    if (!classificar(a.titulo, prod, ch)) continue;
    abertas++;
    const pg = await ler(a.url);
    const info = pg.ok ? paginaProduto(pg.body, null) : null;
    if (info && info.por > 0) {
      a.precos = { de: info.de, por: info.por, frete: null, freteGratisAcima: info.freteGratisAcima != null ? info.freteGratisAcima : null, condicoes: info.condicoes };
      if (info.nome && info.nome.length >= 12) a.titulo = info.nome.slice(0, 250);
    }
  }
}
const MODOS_API = /^(vtex|occ|ldjson|farmasesi|web):/;
async function buscarJson(url, opcoes) {
  const r = await fetch(url, { ...(opcoes || {}), headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json,text/html', ...((opcoes && opcoes.headers) || {}) }, signal: AbortSignal.timeout(20000) });
  if (r.status === 429) throw new Error('limite de acessos da loja');
  if (r.status >= 400) throw new Error('a loja recusou o acesso (' + r.status + ')');
  return r;
}
function anuncioApi(titulo, url, por, de) {
  const p = Number(por); const d = Number(de);
  if (!titulo || !url || !(p > 0)) return null;
  return { titulo: String(titulo).slice(0, 250), url, host: hostDe(url), precos: { de: d > p ? d : null, por: p, frete: null, freteGratisAcima: null, condicoes: null }, via: null, vendedor: null, texto: norm(titulo) };
}
function desfazHtml(v) { return String(v || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'); }
async function anunciosApi(modo, url) {
  const origem = new URL(url).origin;
  if (modo === 'vtex') {
    const j = await (await buscarJson(url)).json();
    return (Array.isArray(j) ? j : []).map(p => {
      const item = (p.items || [])[0] || {};
      const oferta = (((item.sellers || [])[0] || {}).commertialOffer) || {};
      if (!(Number(oferta.AvailableQuantity) > 0)) return null;
      return anuncioApi(p.productName, p.link, oferta.Price, oferta.ListPrice);
    }).filter(Boolean);
  }
  if (modo === 'occ') {
    const j = await (await buscarJson(url)).json();
    const recs = (j && j.resultsList && j.resultsList.records) || [];
    return recs.map(r => {
      const a = ((r.records || [])[0] || {}).attributes || {};
      const v = k => (a[k] || [])[0];
      return anuncioApi(v('product.displayName'), v('product.route') ? origem + v('product.route') : null, v('sku.activePrice') || v('product.salePrice'), v('product.listPrice'));
    }).filter(Boolean);
  }
  if (modo === 'ldjson') {
    const html = await (await buscarJson(url)).text();
    const res = [];
    for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
      let j; try { j = JSON.parse(m[1]); if (typeof j === 'string') j = JSON.parse(j); } catch (e) { continue; }
      for (const it of (j['@graph'] || [j])) {
        if (!it || it['@type'] !== 'Product') continue;
        const ofertas = [].concat(it.offers || []).filter(o => !o.availability || /InStock/.test(o.availability));
        const precos = ofertas.map(o => Number(o.price)).filter(x => x > 0);
        if (precos.length) res.push(anuncioApi(it.name, it.url, Math.min(...precos), null));
      }
    }
    return res.filter(Boolean);
  }
  if (modo === 'farmasesi') {
    const html = await (await buscarJson(url)).text();
    const itens = [];
    for (const m of html.matchAll(/<article class="product-card" data-ga-item="([^"]+)"/g)) {
      try { const g = JSON.parse(desfazHtml(m[1])); if (g._sku && g.item_name) itens.push(g); } catch (e) { }
    }
    if (!itens.length) return [];
    const r = await buscarJson(origem.replace('://www.', '://api.') + '/storefront/prices', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tenant-slug': 'farmasesi' }, body: JSON.stringify({ skus: itens.slice(0, 40).map(g => String(g._sku)) }) });
    const precos = ((await r.json()) || {}).prices || {};
    return itens.map(g => {
      const pe = precos[g._sku]; if (!pe) return null;
      const por = typeof pe.valorFinal === 'number' ? pe.valorFinal : pe.valor;
      return anuncioApi(g.item_name, origem + g.item_url, por, pe.valor);
    }).filter(Boolean);
  }
  return [];
}
async function consultarApi(l, termoX, tipoBusca, modo) {
  const url = montarUrl(l.URL_BUSCA.slice(modo.length + 1), termoX);
  l._url = modo === 'vtex' ? new URL(url).origin + '/busca?ft=' + encodeURIComponent(norm(termoX)) : url;
  try {
    const lista = await anunciosApi(modo, url);
    const antes = encontrados.length;
    for (const a of lista) aceitar(a, l, tipoBusca);
    return { loja: l.NOME, ok: true, achados: encontrados.length - antes };
  } catch (e) {
    const motivo = /limite|recusou/.test(String(e && e.message)) ? e.message : 'erro ao abrir a busca da loja';
    return { loja: l.NOME, ok: false, motivo };
  }
}
async function consultar(l, termoX, tipoBusca) {
  const modo = (String(l.URL_BUSCA).match(MODOS_API) || [])[1];
  if (modo && modo !== 'web') return consultarApi(l, termoX, tipoBusca, modo);
  const url = modo === 'web' ? 'web:' : montarUrl(l.URL_BUSCA, termoX);
  l._url = url;
  const r = modo === 'web' ? { ok: false, motivo: 'o site da loja só mostra o preço no navegador' } : await ler(url);
  if (!r.ok) {
    if (tipoBusca !== 'SIMILAR' && l.TIPO !== 'BUSCA' && l.DOMINIO) {
      const alt = await ler('https://lite.duckduckgo.com/lite/?q=site:' + l.DOMINIO.replace(/^www\./, '') + '+' + montarUrl('{q}', termoX));
      if (alt.ok) {
        const lista = anuncios(alt.body).filter(a => a.host && (a.host === l.DOMINIO.replace(/^www\./, '') || a.host.endsWith(l.DOMINIO.replace(/^www\./, ''))));
        await completarPrecos(lista, 2);
        const antes = encontrados.length;
        for (const a of lista) aceitar(a, { ...l, _url: 'busca na web (site da loja)' }, tipoBusca);
        return { loja: l.NOME, ok: encontrados.length > antes, via: 'busca na web', motivo: r.motivo, achados: encontrados.length - antes };
      }
    }
    return { loja: l.NOME, ok: false, motivo: r.motivo };
  }
  const lista = anuncios(r.body);
  if (l.TIPO === 'BUSCA' || /duckduckgo/.test(url)) await completarPrecos(lista, tipoBusca === 'SIMILAR' ? 3 : 5);
  const antes = encontrados.length;
  for (const a of lista) aceitar(a, l, tipoBusca);
  return { loja: l.NOME, ok: true, achados: encontrados.length - antes };
}
const lojasApi = lojas.filter(l => l.URL_BUSCA && /^(vtex|occ|ldjson|farmasesi):/.test(l.URL_BUSCA));
const resApi = await Promise.all(lojasApi.map(l => consultar(l, termo, 'EXATO')));
for (const l of lojas) {
  const iApi = lojasApi.indexOf(l);
  if (iApi >= 0) { situacao.push(resApi[iApi]); continue; }
  if (Date.now() - t0 > 200000) { situacao.push({ loja: l.NOME, ok: false, motivo: 'sem tempo nesta rodada' }); continue; }
  if (!l.URL_BUSCA) { situacao.push({ loja: l.NOME, ok: false, motivo: 'loja sem endereço de busca' }); continue; }
  situacao.push(await consultar(l, termo, 'EXATO'));
  await dormir(3000);
}
if (Number(prod.BUSCA_SIMILARES) && termoSim && Date.now() - t0 < 220000) {
  const fontes = lojas.filter(l => /zoom|buscape/i.test(l.NOME) || l.TIPO === 'BUSCA');
  for (const l of fontes.slice(0, 2)) { await consultar(l, termoSim, 'SIMILAR'); await dormir(3000); }
}
function finalDe(body) {
  const m = String(body || '').match(/^Final URL:\s*(\S+)/m);
  return m ? m[1] : null;
}
function limparUrl(u) {
  try {
    const x = new URL(u);
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|partner_id|gclid|channel|index|experiencevariant|searchterm)/i.test(k)) x.searchParams.delete(k);
    return x.toString();
  } catch (e) { return u; }
}
function pareceProduto(u) {
  try {
    const x = new URL(u);
    if (/zoom\.com|buscape\./.test(x.host)) return true;
    const p = x.pathname.replace(/\/+$/, '');
    if (/\/dp\/|\/p$|\/produto\/|\.html?$/i.test(p)) return true;
    if (/\/(busca|search|s|categoria|categorias|departamento|departamentos|c|lista|colecao|ofertas)(\/|$)/i.test(p)) return false;
    const partes = p.split('/').filter(Boolean);
    if (!partes.length) return false;
    if (/\d/.test(p)) return true;
    return partes.some(t => t.split('-').length >= 4);
  } catch (e) { return false; }
}
function vendedorDaUrl(u) {
  try {
    const x = new URL(u);
    const v = x.searchParams.get('seller_id') || x.searchParams.get('seller') || x.searchParams.get('sellerId') || x.searchParams.get('smid');
    return v ? decodeURIComponent(v) : null;
  } catch (e) { return null; }
}
const viaComparador = encontrados.filter(e => /zoom|buscap/i.test(e.fonte) && e.url && /\/lead\?|\/redirect|\/oferta/i.test(e.url))
  .map(e => ({ e, cmp: precoComparado(e) })).sort((a, b) => (a.e.tipo === 'SIMILAR') - (b.e.tipo === 'SIMILAR') || a.cmp - b.cmp);
const finais = {};
let abertos = 0;
for (const { e } of viaComparador) {
  if (Date.now() - t0 > 215000) break;
  const chave = (e.url.match(/[?&]oid=(\d+)/) || [])[1] || e.url;
  if (!(chave in finais)) {
    if (abertos >= 14) continue;
    abertos++;
    let pg = await ler(e.url);
    let fim = finalDe(pg.body);
    let nomePassagem = null;
    if (!fim || /zoom\.com|buscape\./.test(fim)) {
      const corpo = String(pg.body || '');
      nomePassagem = (corpo.match(/levando para a loja\s*\**\s*([^*\n]{2,60})\*\*/i) || [])[1] || null;
      const clique = (corpo.match(/\[clique aqui\]\((https?:\/\/[^)\s]+)\)/i) || [])[1];
      if (clique) { pg = await ler(clique); fim = finalDe(pg.body); }
    }
    finais[chave] = null;
    if ((!fim || /zoom\.com|buscape\./.test(fim)) && nomePassagem) {
      const nm = lojaDeVia(nomePassagem.trim());
      const lj = lojaPorNome[norm(nm)];
      finais[chave] = { soNome: true, nome: lj ? lj.NOME : nm, id: lj ? lj.ID : null };
    }
    if (fim && !/zoom\.com|buscape\./.test(fim)) {
      const host = hostDe(fim);
      const info = pg.ok ? paginaProduto(pg.body, null) : null;
      finais[chave] = { url: limparUrl(fim), host, info, vendedor: (pg.ok && vendedorPagina(pg.body)) || vendedorDaUrl(fim), lida: pg.ok };
    }
  }
  const f = finais[chave];
  if (!f) continue;
  if (f.soNome) { e.loja = f.nome; e.lojaId = f.id; continue; }
  const d = Object.keys(hostLoja).find(x => f.host === x || f.host.endsWith('.' + x));
  e.loja = d ? hostLoja[d].NOME : lojaDeHost(f.host);
  e.lojaId = d ? hostLoja[d].ID : null;
  e.url = f.url;
  e.paginaLoja = f.lida ? 1 : 0;
  e.precoLido = f.info && f.info.por > 0 ? 1 : 0;
  if (f.vendedor) e.vendedor = f.vendedor;
  if (f.info && f.info.por > 0) {
    e.por = f.info.por;
    if (f.info.de) e.de = f.info.de;
    if (f.info.freteGratisAcima != null) e.freteGratisAcima = f.info.freteGratisAcima;
    if (f.info.condicoes) e.condicoes = f.info.condicoes;
  }
  if (MARKETPLACES.test(e.loja) && e.vendedor) {
    const v = norm(e.vendedor).replace(/[^a-z0-9]/g, '');
    const l = norm(e.loja).replace(/[^a-z0-9]/g, '');
    e.terceiro = (v.includes(l) || l.includes(v) || /magazineluiza|amazon|mercadolivre/.test(v)) ? 0 : 1;
  }
}
const descartes = { link: 0, preco: 0 };
for (let i = encontrados.length - 1; i >= 0; i--) {
  const e = encontrados[i];
  if (e.url && !pareceProduto(e.url)) { encontrados.splice(i, 1); descartes.link++; }
}
const confirmado = e => !/zoom|buscap|google/i.test(e.fonte) || e.precoLido === 1;
const refPrecos = encontrados.filter(e => e.tipo === 'EXATO' || (e.tipo === 'VARIACAO' && e.mesmaEmbalagem)).map(e => precoComparado(e)).sort((a, b) => a - b);
const refMediana = refPrecos.length >= 3 ? refPrecos[Math.floor(refPrecos.length / 2)] : null;
if (refMediana) {
  for (let i = encontrados.length - 1; i >= 0; i--) {
    const e = encontrados[i];
    const comparavel = e.tipo === 'EXATO' || (e.tipo === 'VARIACAO' && e.mesmaEmbalagem);
    if (!comparavel) continue;
    const pc = precoComparado(e);
    if (pc < refMediana * 0.25 || (pc < refMediana * 0.6 && !confirmado(e))) { encontrados.splice(i, 1); descartes.preco++; }
  }
}
if (descartes.link || descartes.preco) situacao.push({ loja: 'Descartados na checagem', ok: true, achados: descartes.link + descartes.preco, motivo: descartes.link + ' com link que não é de produto, ' + descartes.preco + ' com preço suspeito não confirmado na loja' });
const melhorPorLoja = {};
for (const o of encontrados.filter(e => e.tipo !== 'SIMILAR' && e.tipo !== 'LINHA')) {
  o.comparado = precoComparado(o);
  const k = norm(o.loja);
  const conta = o.tipo === 'EXATO' || (o.tipo === 'VARIACAO' && o.mesmaEmbalagem);
  if (!conta) continue;
  if (!melhorPorLoja[k] || o.comparado < melhorPorLoja[k].comparado) melhorPorLoja[k] = o;
}
let melhores = Object.values(melhorPorLoja);
const vals = melhores.map(o => o.comparado).sort((a, b) => a - b);
const mediana = vals.length ? vals[Math.floor(vals.length / 2)] : null;
if (mediana) melhores = melhores.filter(o => o.comparado >= mediana * 0.25 && o.comparado <= mediana * 3);
for (const o of melhores) {
  if (MARKETPLACES.test(o.loja) && !o.vendedor && o.url && /amazon\./.test(o.url) && Date.now() - t0 < 240000) {
    const pg = await ler(urlPrint(o.url));
    if (pg.ok) { const v = vendedorPagina(pg.body); if (v) { o.vendedor = v; o.terceiro = /amazon/i.test(v) ? 0 : 1; } }
  }
}
const vm = valorMercado(melhores.map(o => o.comparado));
for (const o of melhores) {
  o.noCalculo = 1;
  o.desconto = descontoPct(vm, o.comparado);
  const f = o.desconto != null ? faixaDe(o.desconto, faixas) : null;
  o.faixa = f ? f.nome : null; o.faixaOrdem = f ? f.ordem : null;
}
const similares = [];
const marcasSim = new Set();
for (const o of encontrados.filter(e => e.tipo === 'SIMILAR').map(e => ({ ...e, comparado: precoComparado(e) })).sort((a, b) => a.comparado - b.comparado)) {
  const m = norm(o.marcaSimilar || o.titulo.split(' ')[1] || '');
  if (marcasSim.has(m)) continue;
  marcasSim.add(m); similares.push(o);
  if (similares.length >= 3) break;
}
const outros = encontrados.filter(e => e.tipo !== 'SIMILAR' && !melhores.includes(e)).map(e => ({ ...e, comparado: e.comparado || precoComparado(e), noCalculo: 0 }))
  .sort((a, b) => a.comparado - b.comparado).slice(0, 40);
const todas = [...melhores.sort((a, b) => a.comparado - b.comparado), ...similares.map(s => ({ ...s, noCalculo: 0 })), ...outros];
todas.forEach(o => { o.printFonte = (o.noCalculo || o.tipo === 'SIMILAR') ? fontePrint(o.url) : null; });
const codigo = 'R' + produtoId + '-' + Date.now();
await sf('intSalvarRodada', {
  codigo, produtoId, inicio, valorMercado: numTxt(vm), lojasConsultadas: situacao.length, lojasNoCalculo: melhores.length,
  ofertas: todas.length, similares: similares.length, faixasUsadas: faixas.map(f => f.NOME + ' ≥ ' + Number(f.MIN_PCT) + '%').join(' · '),
  situacao: JSON.stringify(situacao).slice(0, 60000),
});
if (todas.length) {
  const lista = todas.map(o => ({
    lojaId: o.lojaId || 0, loja: o.loja, fonte: o.fonte, fonteUrl: o.fonteUrl ? String(o.fonteUrl).slice(0, 1000) : null, titulo: o.titulo.slice(0, 300), url: o.url ? o.url.slice(0, 1000) : null,
    tipo: o.tipo, variacao: o.tipo === 'SIMILAR' ? null : o.variacao, vendedor: o.vendedor, terceiro: o.terceiro || 0, recond: o.recond || 0, usado: o.usado || 0,
    de: o.de, por: o.por, frete: o.frete, freteGratisAcima: o.freteGratisAcima, comparado: o.comparado, condicoes: o.condicoes ? o.condicoes.slice(0, 300) : null,
    printFonte: o.printFonte, desconto: o.desconto != null ? Math.round(o.desconto * 100) / 100 : null, faixa: o.faixa || null, noCalculo: o.noCalculo || 0,
  }));
  await sf('intSalvarOfertas', { codigo, lista: JSON.stringify(lista) });
}
const ids = {};
for (const r of await linhas('intOfertasDaRodada', { codigo })) ids[Number(r.IDX)] = Number(r.ID);
todas.forEach((o, i) => { o.id = ids[i]; });
for (const o of todas.filter(x => x.printFonte)) await pedirPrint(o.printFonte);
const avisos = [];
const estado = (await linhas('intEstado', { produtoId }))[0];
const comFaixa = melhores.filter(o => o.faixa).sort((a, b) => a.comparado - b.comparado);
const melhor = comFaixa[0];
const marcas = o => [o.tipo === 'VARIACAO' && o.variacao ? 'variação: ' + o.variacao : null, o.terceiro ? 'vendedor terceiro' : null, o.recond ? 'recondicionado' : null, o.usado ? 'usado' : null].filter(Boolean);
async function avisar(tipo, o, extra) {
  const hist = (await linhas('intHistoricoResumo', { produtoId }))[0] || {};
  const dados = {
    produto: prod.NOME, produtoId, ofertaId: o.id, loja: o.loja, fonte: o.fonte !== o.loja ? o.fonte : null, url: o.url, titulo: o.titulo,
    faixa: o.faixa, desconto: o.desconto, precoDe: o.de, precoPor: o.por, frete: o.frete, freteGratisAcima: o.freteGratisAcima, comparado: o.comparado,
    condicoes: o.condicoes, valorMercado: vm, lojasNoCalculo: melhores.length, marcas: marcas(o),
    historico: { menor: hist.MENOR != null ? Number(hist.MENOR) : null, maior: hist.MAIOR != null ? Number(hist.MAIOR) : null, rodadas: Number(hist.RODADAS || 0), desde: hist.DESDE || null, mercadoMedio: hist.MERCADO_MEDIO != null ? Number(hist.MERCADO_MEDIO) : null },
    similares: similares.map(s => ({ ofertaId: s.id, titulo: s.titulo, loja: s.loja, comparado: s.comparado, url: s.url, marcas: ['similar'].concat(marcas(s)) })),
    ...(extra || {}),
  };
  const freteTxt = (o.freteGratisAcima != null && o.por > o.freteGratisAcima) ? 'frete grátis (acima de ' + brl(o.freteGratisAcima) + ')' : (o.frete == null ? 'frete não informado' : o.frete === 0 ? 'frete grátis' : 'frete ' + brl(o.frete));
  const cab = tipo === 'QUEDA'
    ? (extra.mudouFaixa ? 'Subiu de faixa: ' : 'O preço caiu mais: ') + prod.NOME + ' de ' + brl(extra.precoAnterior) + ' para ' + brl(o.comparado) + ' na ' + o.loja + '.'
    : tipo === 'LEMBRETE' ? 'Lembrete: a oferta de ' + prod.NOME + ' continua — ' + o.faixa + ' na ' + o.loja + '.'
    : o.faixa + ': ' + prod.NOME + ' na ' + o.loja + '.';
  const texto = cab + ' Preço ' + brl(o.por) + ', ' + freteTxt + ', preço comparado ' + brl(o.comparado) + '. Valor de mercado ' + brl(vm) + ' (' + pct(o.desconto) + ' abaixo).' + (marcas(o).length ? ' [' + marcas(o).join(', ') + ']' : '');
  await mensagem({ tipo, produtoId, ofertaId: o.id, texto, dados });
  avisos.push(tipo);
}
const agora = agoraBR();
if (melhor) {
  if (!estado || !Number(estado.ATIVO)) {
    await avisar('OFERTA', melhor);
    await sf('intSalvarEstado', { produtoId, ativo: 1, faixa: melhor.faixa, faixaOrdem: String(melhor.faixaOrdem), precoAvisado: numTxt(melhor.comparado), ofertaId: String(melhor.id || ''), desde: agora, ultimoAviso: agora, ultimoLembreteDia: hojeBR() });
  } else {
    const ant = Number(estado.PRECO_AVISADO);
    const subiuFaixa = melhor.faixaOrdem < Number(estado.FAIXA_ORDEM || 99);
    const caiu = melhor.comparado < ant - 0.009;
    if (caiu || subiuFaixa) {
      await avisar('QUEDA', melhor, { precoAnterior: ant, faixaAnterior: estado.FAIXA, mudouFaixa: subiuFaixa && melhor.faixa !== estado.FAIXA });
      await sf('intSalvarEstado', { produtoId, ativo: 1, faixa: melhor.faixa, faixaOrdem: String(melhor.faixaOrdem), precoAvisado: numTxt(melhor.comparado), ofertaId: String(melhor.id || ''), desde: estado.DESDE, ultimoAviso: agora, ultimoLembreteDia: estado.ULTIMO_LEMBRETE_DIA || '' });
    } else {
      await sf('intSalvarEstado', { produtoId, ativo: 1, faixa: melhor.faixa, faixaOrdem: String(melhor.faixaOrdem), precoAvisado: numTxt(melhor.comparado), ofertaId: String(melhor.id || ''), desde: estado.DESDE, ultimoAviso: estado.ULTIMO_AVISO_EM || '', ultimoLembreteDia: estado.ULTIMO_LEMBRETE_DIA || '' });
    }
  }
} else if (estado && Number(estado.ATIVO) && melhores.length) {
  const o = melhores.slice().sort((a, b) => a.comparado - b.comparado)[0];
  await mensagem({
    tipo: 'PERDIDA', produtoId, ofertaId: o.id, pergunta: 'CONTINUAR',
    texto: 'Oportunidade perdida: ' + prod.NOME + ' saiu de todas as faixas. O menor preço agora é ' + brl(o.comparado) + ' na ' + o.loja + ' (' + pct(o.desconto) + ' abaixo do valor de mercado de ' + brl(vm) + '). Antes estava ' + brl(Number(estado.PRECO_AVISADO)) + ' (' + estado.FAIXA + '). Quer continuar monitorando até o preço baixar de novo?',
    dados: { produto: prod.NOME, produtoId, ofertaId: o.id, loja: o.loja, comparado: o.comparado, valorMercado: vm, desconto: o.desconto, precoAnterior: Number(estado.PRECO_AVISADO), faixaAnterior: estado.FAIXA },
  });
  avisos.push('PERDIDA');
  await sf('intSalvarEstado', { produtoId, ativo: 0, faixa: '', faixaOrdem: '', precoAvisado: '', ofertaId: '', desde: '', ultimoAviso: agora, ultimoLembreteDia: '' });
}
const restante = 270000 - (Date.now() - t0);
let prints = 0;
if (restante > 40000 && todas.some(o => o.printFonte)) prints = await processarPrints(30);
return { produtoId, valorMercado: vm, lojasNoCalculo: melhores.length, ofertas: todas.length, similares: similares.length, avisos, prints, situacao, segundos: Math.round((Date.now() - t0) / 1000) };

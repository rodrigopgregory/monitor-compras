const STOP = new Set(['de','da','do','das','dos','para','com','sem','e','a','o','as','os','em','no','na','nos','nas','por','um','uma','pra','pro','the','and','of','for','with','kit','novo','nova','original','oferta','promocao','frete','gratis','loja','oficial','compre','preco','menor','ate','ou']);
const SABORES = ['salmao','frango','carne','cordeiro','peixe','atum','peru','pato','vegetais','arroz','figado','sardinha','morango','chocolate','baunilha','limao','laranja','uva','framboesa','tradicional','original','menta','coco','banana','abacaxi','maracuja','cereja','mel','queijo','bacon'];
const CORES = ['preto','preta','branco','branca','prata','inox','vermelho','vermelha','azul','verde','rosa','cinza','dourado','dourada','grafite','bege','marrom','amarelo','amarela','roxo','roxa','laranja','champagne','titanio','cobre','lilas','violeta','creme','chumbo'];
const VOLTAGENS = ['110v','127v','220v','bivolt'];
const MARCAS_USO = /\b(usad[oa]s?|seminov[oa]s?|segunda mao)\b/;
const MARCAS_RECOND = /\b(recondicionad[oa]s?|refurbished|renewed|remanufaturad[oa]s?|vitrine)\b/;

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function singular(t) {
  if (t.length > 4 && /[^s]s$/.test(t) && !/(ss|us|is)$/.test(t)) return t.slice(0, -1);
  return t;
}
function tamanhoDe(texto) {
  const m = norm(texto).replace(/(\d),(\d)/g, '$1.$2').match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|ml|l|lt|litros?|un|unidades|comprimidos|capsulas)\b/);
  if (!m) return null;
  let v = parseFloat(m[1]); let u = m[2];
  if (u === 'kg') { v *= 1000; u = 'g'; } else if (u === 'gr') u = 'g';
  else if (/^(l|lt|litro|litros)$/.test(u)) { v *= 1000; u = 'ml'; }
  else if (/^(un|unidades)$/.test(u)) u = 'un';
  if (!v) return null;
  return { valor: v, unidade: u, texto: m[0] };
}
function tokens(s) {
  return norm(s).replace(/(\d),(\d)/g, '$1.$2').replace(/[^a-z0-9.]+/g, ' ').split(' ')
    .map(t => t.replace(/^\.+|\.+$/g, '')).filter(t => t && !STOP.has(t)).map(singular);
}
function atributos(s) {
  const tk = new Set(tokens(s));
  const pega = lista => lista.map(singular).filter(x => tk.has(x));
  const tam = tamanhoDe(s);
  const id = norm(s).match(/\b(\d{1,2})\s*(?:a|ate|-)\s*(\d{1,2})\s*mese?s?\b/);
  const idade = id ? id[1] + ' a ' + id[2] + ' meses' : null;
  return { sabor: pega(SABORES), cor: pega(CORES), voltagem: VOLTAGENS.filter(x => tk.has(x)), tamanho: tam, idade };
}
function linhaDoProduto(nome, marca) {
  const mk = tokens(marca || '');
  if (!mk.length) return null;
  const tk = norm(nome).replace(/[^a-z0-9+]+/g, ' ').trim().split(' ').map(singular);
  const i = tk.findIndex(t => mk.includes(t));
  if (i < 0) return null;
  const prox = tk[i + 1];
  if (!prox || STOP.has(prox) || mk.includes(prox)) return null;
  if (!prox || prox.length < 3 || ehAtributo(prox) || /\d/.test(prox)) return null;
  return prox;
}
function ehAtributo(t) {
  return SABORES.map(singular).includes(t) || CORES.map(singular).includes(t) || VOLTAGENS.includes(t) || /^\d+(\.\d+)?(kg|g|gr|ml|l|lt|un|v|w)?$/.test(t) || /^\d+x$/.test(t);
}
function nomeLimpo(nome) {
  let n = String(nome || '');
  n = n.replace(/\s+[|\-–—]\s+[^|\-–—]*\b(black ?friday|oferta|promo[cç][aã]o|farm[aá]cia|drogaria|loja|frete|cupom|exclusivo|site)\b[^|\-–—]*$/i, '');
  n = n.replace(/\b(black ?friday|oferta imperd[ií]vel|promo[cç][aã]o)\b/gi, ' ');
  return n.replace(/\s+/g, ' ').trim() || String(nome || '');
}
function chavesProduto(prod) {
  prod = { ...prod, NOME: nomeLimpo(prod.NOME) };
  const marca = tokens(prod.MARCA || '');
  const modelo = norm(prod.MODELO || '').replace(/[^a-z0-9]/g, '');
  const base = tokens(prod.NOME);
  const chave = [...new Set(base.filter(t => !ehAtributo(t)))];
  const caract = prod.CARACTERISTICAS ? [...new Set(tokens(prod.CARACTERISTICAS).filter(t => !ehAtributo(t)))]
    : caracteristicasPadrao(prod.NOME, prod.MARCA, prod.MODELO);
  return { marca, modelo, chave, caract, attrs: atributos(prod.NOME), linha: linhaDoProduto(prod.NOME, prod.MARCA) };
}
function caracteristicasPadrao(nome, marca, modelo) {
  const mk = tokens(marca || ''); const md = norm(modelo || '').replace(/[^a-z0-9]/g, '');
  return [...new Set(tokens(nome).filter(t => !ehAtributo(t) && !mk.includes(t) && t !== md && !/\d/.test(t)))].slice(0, 3);
}
function codigosModelo(s) { return tokens(s).filter(t => /^[a-z]{2,}-?\d{2,}[a-z0-9]*$/.test(t)).map(t => t.replace(/-/g, '')); }
function difAtributos(pa, oa) {
  const dif = [];
  if (pa.sabor.length && oa.sabor.length && !oa.sabor.some(x => pa.sabor.includes(x))) dif.push('sabor ' + oa.sabor.join(' e '));
  if (!pa.sabor.length && oa.sabor.length) dif.push('sabor ' + oa.sabor.join(' e '));
  const corP = pa.cor.filter(c => c !== 'inox'); const corO = oa.cor.filter(c => c !== 'inox');
  if (corO.length && !corO.some(x => corP.includes(x))) dif.push('cor ' + corO.join(' e '));
  if (pa.voltagem.length && oa.voltagem.length && !oa.voltagem.some(x => pa.voltagem.includes(x))) dif.push('voltagem ' + oa.voltagem.join('/').toUpperCase());
  if (pa.tamanho && oa.tamanho && pa.tamanho.unidade === oa.tamanho.unidade && Math.abs(pa.tamanho.valor - oa.tamanho.valor) > 0.001) dif.push('embalagem ' + oa.tamanho.texto);
  if (pa.idade && oa.idade && pa.idade !== oa.idade) dif.push('idade ' + oa.idade);
  return dif;
}
function classificar(titulo, prod, ch) {
  ch = ch || chavesProduto(prod);
  const tt = tokens(titulo); const set = new Set(tt);
  const compacto = norm(titulo).replace(/[^a-z0-9]/g, '');
  const temMarca = ch.marca.length === 0 || ch.marca.every(t => set.has(t));
  const temModelo = ch.modelo.length >= 4 && compacto.includes(ch.modelo);
  const naChave = ch.chave.filter(t => set.has(t)).length;
  const cobertura = ch.chave.length ? naChave / ch.chave.length : 0;
  const oa = atributos(titulo);
  const usado = MARCAS_USO.test(norm(titulo));
  const recond = MARCAS_RECOND.test(norm(titulo));
  if (/^kit\b/.test(norm(titulo).trim()) && !/^kit\b/.test(norm(prod.NOME).trim())) return null;
  if (ch.modelo.length >= 4 && !temModelo) { const cods = codigosModelo(titulo); if (cods.length && !cods.includes(ch.modelo)) return null; }
  if (ch.linha && ch.marca.length && temMarca && !temModelo && !set.has(ch.linha) && cobertura >= 0.5) {
    const i = tt.findIndex(t => ch.marca.includes(t));
    const outra = i >= 0 ? tt.slice(i + 1).find(t => !ch.marca.includes(t) && !ehAtributo(t) && !/\d/.test(t) && t.length >= 3) : null;
    return { tipo: 'LINHA', variacao: 'linha ' + (outra ? outra.charAt(0).toUpperCase() + outra.slice(1) : 'diferente'), fator: 1, usado, recond };
  }
  if (temMarca && (temModelo || cobertura >= (ch.chave.length >= 6 ? 0.7 : 0.8))) {
    const dif = difAtributos(ch.attrs, oa);
    const fator = (ch.attrs.tamanho && oa.tamanho && ch.attrs.tamanho.unidade === oa.tamanho.unidade) ? ch.attrs.tamanho.valor / oa.tamanho.valor : 1;
    return { tipo: dif.length ? 'VARIACAO' : 'EXATO', variacao: dif.length ? dif.join(', ') : null, fator, usado, recond };
  }
  if (!temMarca && ch.caract.length) {
    const cc = ch.caract.filter(t => set.has(t)).length / ch.caract.length;
    if (cc >= (ch.caract.length >= 4 ? 0.75 : 1)) {
      const marcaGuess = tt.find(t => !ch.chave.includes(t) && !ch.caract.includes(t) && !ehAtributo(t) && t.length > 2 && !/^(racao|gato|cao|adulto|filhote|premium|super|natural|sabor)$/.test(t)) || tt[0];
      return { tipo: 'SIMILAR', variacao: null, fator: 1, usado, recond, marcaSimilar: marcaGuess };
    }
  }
  return null;
}
function num(s) {
  const v = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return isFinite(v) ? v : null;
}
const RE_PRECO = /R\$\s*\**\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:\s*\**\s*,\s*\**(\d{2}))?/g;
function precosDe(texto) {
  const out = [];
  let m; RE_PRECO.lastIndex = 0;
  while ((m = RE_PRECO.exec(texto))) out.push({ v: num(m[1] + ',' + (m[2] || '00')), i: m.index, fim: RE_PRECO.lastIndex, inteiro: !m[2] });
  return out;
}
function lerPrecos(bloco) {
  const t = String(bloco).replace(/\\\$/g, '$');
  const ps = precosDe(t);
  const nt = norm(t);
  const validos = [];
  let parcela = null; let parcelaV = null;
  let frete = null; let freteGratisAcima = null;
  for (const p of ps) {
    const antes = norm(t.slice(Math.max(0, p.i - 40), p.i));
    const depois = norm(t.slice(p.fim, p.fim + 14));
    if (/\d+\s*x\s*(de|sem juros)?\s*$/.test(antes) || /em ate \d+x\s*(de)?\s*$/.test(antes)) { if (!parcela) { parcela = antes.match(/(\d+)\s*x/)?.[1] + 'x de R$ ' + p.v.toFixed(2).replace('.', ','); parcelaV = p.v; } continue; }
    if (parcelaV != null && p.v === parcelaV) continue;
    if (/(economi[az]e?|economia de|off|desconto de|cashback|volta|cesta|carrinho|cupom de)\W*$/.test(antes)) continue;
    if (/(acima de|compras? acima de|a partir de)\s*$/.test(antes)) { if (/frete|entrega/.test(antes + norm(t.slice(Math.max(0, p.i - 80), p.i)))) freteGratisAcima = p.v; continue; }
    if (/(entrega|frete)\W*$/.test(antes)) { frete = p.v; continue; }
    if (/^\s*\**\s*(off|de desconto|de volta|reais de desconto)/.test(depois)) continue;
    if (/^\s*\/\s*(kg|l|g|ml|un)/.test(depois) || /\(\s*$/.test(antes)) continue;
    if (p.v <= 0) continue;
    if (p.inteiro && /^\s*[a-z]/.test(depois) && !/^\s*(no pix|a vista|em ate|ou)/.test(depois)) continue;
    validos.push(p);
  }
  if (!validos.length) return null;
  let por = null; let de = null;
  const mDe = t.match(/(?<![A-Za-z])De:\s*\**\s*R\$\s*\**\s*([\d.]+,\d{2})/i);
  const mPor = t.match(/(?<![A-Za-z])Por:\s*\**\s*R\$\s*\**\s*([\d.]+,\d{2})/i);
  if (mPor) por = num(mPor[1]);
  if (mDe) de = num(mDe[1]);
  if (por == null) {
    const vs = validos.map(p => p.v);
    por = Math.min(...vs);
    const mx = Math.max(...vs);
    if (de == null && mx > por * 1.001 && mx < por * 6) de = mx;
  }
  if (de != null && de <= por) de = null;
  if (/frete gratis|entrega gratis|frete gratuito/.test(nt) && frete == null && freteGratisAcima == null) frete = 0;
  const cond = [];
  const mVista = t.match(/(?:pre[cç]o\s*)?(?:[aà]\s*vista|no\s*pix)\s*:?\s*\**\s*R\$\s*\**\s*([\d.]+,\d{2})/i);
  if (mVista && num(mVista[1]) < por) cond.push('à vista/Pix ' + 'R$ ' + mVista[1]);
  else if (/\bpix\b/.test(nt)) cond.push(/a vista no pix|no pix/.test(nt) ? 'Pix / à vista' : 'Pix');
  else if (/a vista/.test(nt)) cond.push('à vista');
  if (parcela) cond.push(parcela.replace(/^(\d+)x/, 'até $1x').trim() + (/sem juros/.test(nt) ? ' sem juros' : ''));
  const cup = t.match(/cupom\s*:?\s*\**([A-Z0-9]{4,20})\**/i);
  if (cup && /[A-Z]/.test(cup[1])) cond.push('cupom ' + cup[1].toUpperCase());
  if (frete === 0) cond.push('frete grátis');
  else if (frete != null) cond.push('frete R$ ' + frete.toFixed(2).replace('.', ','));
  if (freteGratisAcima != null) cond.push('frete grátis acima de R$ ' + freteGratisAcima.toFixed(2).replace('.', ','));
  return { por, de, frete, freteGratisAcima, condicoes: cond.join(' · ') || null };
}
function precoComparado(o) {
  const frete = (o.freteGratisAcima != null && o.por > o.freteGratisAcima) ? 0 : (o.frete || 0);
  return Math.round((o.por + frete) * 100) / 100;
}
function limpaTitulo(s) {
  return String(s || '').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\*\*/g, '').replace(/\[|\]/g, ' ').replace(/Image \d+:?/g, ' ').replace(/R\$\s*[\d.,]+.*$/, '').replace(/^[#\s]+/, '').replace(/\s+/g, ' ').trim();
}
function decodeUrl(u) {
  try {
    if (/duckduckgo\.com\/l\/\?uddg=/.test(u)) return decodeURIComponent(u.split('uddg=')[1].split('&')[0]);
  } catch (e) { }
  return u;
}
function hostDe(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
function anuncios(md, dominio) {
  const corpo = String(md || '').split('Markdown Content:').pop().replace(/\)\s*\[!\[Image/g, ')\n[![Image');
  const linhas = corpo.split('\n');
  const blocos = []; let atual = null;
  const inicio = l => /^\s*(#{1,4}\s*\[|\[!\[Image|\[\s*!\[|\d+\.\s*\[)/.test(l);
  for (const l of linhas) {
    if (inicio(l)) { if (atual) blocos.push(atual); atual = [l]; }
    else if (atual) { atual.push(l); if (atual.join('\n').length > 2500) { blocos.push(atual); atual = null; } }
  }
  if (atual) blocos.push(atual);
  const res = []; const vistos = new Set();
  for (const b of blocos) {
    const texto = b.join('\n');
    const links = [...texto.matchAll(/\[((?:[^\[\]]|\[[^\]]*\])*)\]\((https?:\/\/[^)\s]+)/g)];
    let titulo = null; let url = null;
    for (const l of links) {
      const tt = limpaTitulo(l[1]);
      if (tt && tt.length >= 12 && /[a-zA-Z]{3}/.test(tt) && !/^(patrocinado|comprar|adicionar|ver mais|oferta)/i.test(tt)) { titulo = tt; url = decodeUrl(l[2]); break; }
    }
    if (!titulo) {
      const h = texto.match(/^\s*#{1,4}\s*([^\n\[]{12,})/m);
      if (h) { titulo = limpaTitulo(h[1]); url = links[0] ? decodeUrl(links[0][2]) : null; }
    }
    if (!titulo || !url) continue;
    if (/\bresultados?\b|^\d+\s*-\s*\d+ de/i.test(titulo)) continue;
    if (/sponsored-ads|\/clk\?|duckduckgo\.com\/y\.js/.test(url)) continue;
    const textoPreco = texto.replace(/\]\(https?:\/\/[^)]*\)/g, '] ').replace(/!\[[^\]]*\]/g, ' ');
    const precos = lerPrecos(textoPreco);
    const via = (textoPreco.match(/\bVia\s+([A-Z][\wÀ-ú.]*(?:\s+[A-Z][\wÀ-ú.]*){0,2})/) || [])[1] || null;
    const vend = (textoPreco.match(/[Vv]endid[oa] por:?\s*\**([^\n*|]{2,40})/) || [])[1] || null;
    const chave = titulo + '|' + (precos ? precos.por : '');
    if (vistos.has(chave)) continue; vistos.add(chave);
    res.push({ titulo: titulo.slice(0, 250), url, host: hostDe(url), precos, via: via && via.trim(), vendedor: vend && vend.trim(), texto: norm(textoPreco).slice(0, 1500) });
  }
  return res;
}
function paginaProduto(md, html) {
  const r = { nome: null, marca: null, modelo: null, por: null, de: null, condicoes: null, imagem: null };
  if (html) {
    const re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi; let m;
    while ((m = re.exec(html))) {
      let j; try { j = JSON.parse(m[1].trim()); } catch (e) { continue; }
      const lista = Array.isArray(j) ? j : (j['@graph'] || [j]);
      for (const it of lista) {
        if (!it || !/Product/.test([].concat(it['@type']).join(','))) continue;
        r.nome = r.nome || it.name;
        r.marca = r.marca || (typeof it.brand === 'string' ? it.brand : it.brand && it.brand.name);
        r.modelo = r.modelo || it.mpn || it.model && (it.model.name || it.model) || null;
        const of = [].concat(it.offers || [])[0];
        if (of) { const p = of.lowPrice || of.price || (of.offers && [].concat(of.offers)[0] && [].concat(of.offers)[0].price); if (p && !r.por) r.por = Number(p); }
        r.imagem = r.imagem || [].concat(it.image || [])[0] || null;
      }
    }
  }
  const t = String(md || '');
  const tit = (t.match(/^Title:\s*(.+)$/m) || [])[1];
  if (!r.nome && tit) r.nome = tit.replace(/\s*[|\-–]\s*[^|\-–]{2,40}$/, '').trim();
  const corpo = t.split('Markdown Content:').pop().replace(/\\\$/g, '$');
  const mDe = corpo.match(/(?<![A-Za-z])De:\s*[_*]*\s*R\$\s*\**\s*([\d.]+,\d{2})/i);
  const mPor = corpo.match(/(?<![A-Za-z])Por:\s*[_*]*\s*R\$\s*\**\s*([\d.]+,\d{2})/i);
  if (mPor) { r.por = num(mPor[1]); if (mDe) r.de = num(mDe[1]); }
  if (r.por == null) {
    const limpo = corpo.split('\n').filter(l => !/garantia|prote[cç][aã]o|seguro|subtotal|carrinho|cesta|cupom de|parcela mensal/i.test(l)).join('\n');
    const i0 = r.nome ? Math.max(0, limpo.indexOf(r.nome.slice(0, 30))) : 0;
    const ps = precosDe(limpo.slice(i0, i0 + 20000)).filter(p => p.v > 0);
    const bloco = ps.length ? limpo.slice(i0 + Math.max(0, ps[0].i - 50), i0 + ps[0].i + 400) : '';
    const lp = bloco ? lerPrecos(bloco) : null;
    if (lp) { r.por = ps[0].v; r.de = lp.de && lp.de > r.por ? lp.de : null; }
  }
  if (r.de != null && r.de <= r.por) r.de = null;
  let idx = mPor ? corpo.indexOf(mPor[0]) : -1;
  const trecho = idx >= 0 ? corpo.slice(Math.max(0, idx - 300), idx + 600) : '';
  const lp2 = trecho ? lerPrecos(trecho) : null;
  r.condicoes = lp2 ? lp2.condicoes : null;
  r.frete = lp2 ? lp2.frete : null;
  r.freteGratisAcima = freteLoja(corpo);
  if (r.freteGratisAcima != null && r.condicoes && !/acima de/.test(r.condicoes)) r.condicoes = r.condicoes.replace(/ · frete grátis$|^frete grátis$/, '') + (r.condicoes.replace(/ · frete grátis$|^frete grátis$/, '') ? ' · ' : '') + 'frete grátis acima de ' + brl(r.freteGratisAcima);
  r.vendedor = vendedorPagina(corpo);
  if (!r.modelo && r.nome) {
    const i = corpo.indexOf(r.nome);
    const perto = i >= 0 ? corpo.slice(i, i + 400) : '';
    const mm = perto.match(/^\s*([A-Z]{2,6}[- ]?\d{2,6}[A-Z0-9-]*)\s*$/m);
    if (mm) r.modelo = mm[1];
  }
  return r;
}

const LOJAS_HOST = [
  [/amazon\./, 'Amazon'], [/mercadoli[vb]re\./, 'Mercado Livre'], [/magazineluiza\.|magalu\./, 'Magalu'], [/kabum\./, 'Kabum'],
  [/google\./, 'Google Shopping'], [/buscape\./, 'Buscapé'], [/zoom\.com/, 'Zoom'], [/angeloni\./, 'Angeloni'], [/bistek\./, 'Bistek'],
  [/carrefour\./, 'Carrefour'], [/drogaraia\./, 'Droga Raia'], [/panvel\./, 'Panvel'], [/precopopular\./, 'Preço Popular'],
  [/paguemenos\./, 'Pague Menos'], [/saojoaofarmacias\./, 'São João'], [/farmasesi\./, 'FarmaSesi'], [/fortatacadista\./, 'Fort Atacadista'], [/superkoch\./, 'Koch'],
  [/giassi\./, 'Giassi'], [/koerich\./, 'Koerich'], [/colombo\./, 'Colombo'],
  [/americanas\./, 'Americanas'], [/casasbahia\./, 'Casas Bahia'], [/pontofrio\./, 'Ponto'], [/cobasi\./, 'Cobasi'], [/petz\./, 'Petz'],
];
const VIA_LOJA = [[/magazine luiza|magalu/i, 'Magalu'], [/webcontinental/i, 'Webcontinental'], [/americanas/i, 'Americanas'], [/ponto( frio)?/i, 'Ponto'], [/mercado livre/i, 'Mercado Livre'], [/amazon/i, 'Amazon'], [/carrefour/i, 'Carrefour'], [/kabum/i, 'Kabum'], [/casas bahia/i, 'Casas Bahia']];
function lojaDeHost(host) {
  for (const [re, nome] of LOJAS_HOST) if (re.test(host)) return nome;
  const partes = String(host || '').replace(/^www\.|^loja\.|^m\./, '').split('.');
  const base = partes[0] || host;
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Loja';
}
function lojaDeVia(via) {
  if (!via) return null;
  for (const [re, nome] of VIA_LOJA) if (re.test(via)) return nome;
  return via.trim();
}
const MARKETPLACES = /^(Amazon|Mercado Livre|Magalu|Carrefour|Casas Bahia|Americanas|Ponto)$/;
function termoBusca(nome) {
  const t = norm(nome).replace(/[^a-z0-9,. ]+/g, ' ').split(/\s+/).filter(x => x && !STOP.has(x) && x.length > 1);
  return t.slice(0, 8).join(' ');
}
function montarUrl(modelo, termo) {
  const q = norm(termo).replace(/[^a-z0-9 ]+/g, ' ').trim().replace(/\s+/g, ' ');
  return String(modelo).replace('{q}', q.replace(/ /g, '+')).replace('{q-}', q.replace(/ /g, '-')).replace('{q%}', q.replace(/ /g, '%20'));
}
function faixaDe(desconto, faixas) {
  const ord = [...faixas].sort((a, b) => Number(b.MIN_PCT) - Number(a.MIN_PCT));
  for (let i = 0; i < ord.length; i++) if (desconto >= Number(ord[i].MIN_PCT) - 1e-9) return { nome: ord[i].NOME, ordem: i + 1, min: Number(ord[i].MIN_PCT) };
  return null;
}
function valorMercado(precosPorLoja) {
  const v = precosPorLoja.filter(x => x > 0);
  if (!v.length) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100;
}
function descontoPct(vm, pc) {
  if (!vm || !(pc > 0)) return null;
  return (vm - pc) / vm * 100;
}
function brl(v) {
  if (v == null || !isFinite(v)) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(v) { return v == null ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
function vendedorPagina(md) {
  const t = String(md || '');
  const m = t.match(/(?:Enviado\s*\/\s*Vendido|Vendido por|Vendido e entregue por)\s*:?\s*\n*\s*\[?([^\]\n(]{2,60})/i);
  const v = m ? m[1].replace(/\*+/g, '').trim() : null;
  return v && /[A-Za-zÀ-ú]{2,}/.test(v) ? v : null;
}
function captura(texto, preco) {
  const t = String(texto || '').replace(/\]\(https?:\/\/[^)]*\)/g, ']').replace(/!\[[^\]]*\]/g, '').replace(/\s+/g, ' ');
  if (!preco) return t.slice(0, 500);
  const alvo = Number(preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 }).replace(/\s/g, '');
  const i = t.replace(/R\$\s*\**\s*/g, 'R$').indexOf('R$' + alvo);
  const base = t.replace(/R\$\s*\**\s*/g, 'R$');
  return (i >= 0 ? base.slice(Math.max(0, i - 250), i + 250) : base.slice(0, 500)).trim();
}
function freteLoja(md) {
  const t = norm(String(md || '').replace(/\*\*/g, ''));
  const m = t.match(/frete gr[a]tis[^.\n]{0,60}?acima de\s*r\$\s*([\d.]+(?:,\d{2})?)/) || t.match(/acima de\s*r\$\s*([\d.]+(?:,\d{2})?)[^.\n]{0,30}frete gratis/);
  return m ? num(m[1].includes(',') ? m[1] : m[1] + ',00') : null;
}
function marcaDoHost(nome, host) {
  const base = norm(String(host || '').replace(/^www\.|^loja\./, '').split('.')[0]);
  if (base.length >= 3 && tokens(nome).includes(singular(base))) {
    const orig = String(nome).split(/\s+/).find(w => norm(w).replace(/[^a-z0-9]/g, '') === base);
    return orig || base;
  }
  return null;
}
const dormir = ms => new Promise(r => setTimeout(r, ms));
const GEMINI_ESGOTADO = new Set();
const GEMINI_ESPEROU = new Set();
function geminiLista(txtLista, padrao) {
  const itens = String(txtLista || '').split(',').map(s => s.trim()).filter(Boolean);
  return itens.length ? itens : padrao;
}
async function geminiConfig() {
  const cfg = {};
  try { for (const l of await linhas('intConfigGemini')) cfg[l.CHAVE] = l.VALOR; } catch (e) { }
  return cfg;
}
async function gemini(prompt, opcoes) {
  const op = opcoes || {};
  const cfg = await geminiConfig();
  const base = geminiLista(cfg.GEMINI_CONEXOES, ['gemini']);
  const conexoes = [...new Set([...(op.conexoes || []), ...base])];
  const modelos = op.modelos || geminiLista(cfg.MODELO_ANALISE, ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
  const body = { contents: [{ role: 'user', parts: [{ text: String(prompt) }] }], generationConfig: { temperature: op.temperature == null ? 0.2 : op.temperature } };
  if (op.json) body.generationConfig.responseMimeType = 'application/json';
  if (op.sistema) body.systemInstruction = { parts: [{ text: String(op.sistema) }] };
  let ultimo = '';
  let semIntegracao = true;
  const chamar = (conexao, modelo) => mitra.callIntegrationMitra({ projectId, connection: conexao, method: 'POST', endpoint: '/v1beta/models/' + modelo + ':generateContent', body });
  for (const conexao of conexoes) {
    for (const modelo of modelos) {
      const k = conexao + '|' + modelo;
      if (GEMINI_ESGOTADO.has(k)) continue;
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        let repetir = false;
        try {
          const r = await chamar(conexao, modelo);
          const st = r.result ? r.result.statusCode : r.statusCode;
          const b = (r.result ? r.result.body : r.body) || {};
          if (st >= 400 || b.error) {
            semIntegracao = false;
            const msg = JSON.stringify(b).slice(0, 3000);
            if (st === 429) {
              const porDia = /per day|PerDay/i.test(msg);
              const m = msg.match(/retry in ([\d.]+)s/);
              const espera = m ? Number(m[1]) : 0;
              if (!porDia && espera > 0 && espera <= 40 && !GEMINI_ESPEROU.has(k)) {
                GEMINI_ESPEROU.add(k);
                await dormir((espera + 1) * 1000);
                repetir = true;
              } else if (porDia) GEMINI_ESGOTADO.add(k);
            }
            ultimo = 'Gemini (' + modelo + '): ' + msg.slice(0, 200);
          } else {
            semIntegracao = false;
            const cand = (b.candidates || [])[0] || {};
            const partes = (cand.content && cand.content.parts) || [];
            const texto = partes.map(p => p.text || '').join('');
            GEMINI_ESPEROU.delete(k);
            if (texto) return texto;
            ultimo = 'Gemini (' + modelo + '): resposta vazia (' + ((b.promptFeedback && b.promptFeedback.blockReason) || cand.finishReason || 'sem motivo') + ')';
          }
        } catch (e) {
          const msg = String(e && e.message || e);
          if (/connection|conex|integra|not found|n[aã]o encontrad/i.test(msg)) ultimo = ultimo || 'Falta a integração Gemini (' + conexao + ')';
          else { semIntegracao = false; ultimo = 'Gemini (' + modelo + '): ' + msg.slice(0, 200); }
        }
        if (!repetir) break;
      }
    }
  }
  if (GEMINI_ESGOTADO.size) { try { await sf('intIaSemCota', {}); } catch (e) { } }
  if (semIntegracao) throw new Error('Falta a integração Gemini');
  throw new Error(ultimo || 'Gemini sem resposta');
}
function geminiExtrairJson(texto) {
  const t = String(texto || '');
  const ini = t.indexOf('{');
  const fim = t.lastIndexOf('}');
  return JSON.parse(ini >= 0 && fim > ini ? t.slice(ini, fim + 1) : t);
}
async function geminiJson(prompt, opcoes) {
  const op = opcoes || {};
  try { return geminiExtrairJson(await gemini(prompt, { ...op, json: true })); }
  catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    return geminiExtrairJson(await gemini(prompt, { ...op, json: true, temperature: 0 }));
  }
}

const mitra = require('mitra-sdk');
const projectId = Number(process.env.MITRA_PROJECT_ID);
async function sf(nome, input) {
  const id = SFID[nome];
  if (!id) throw new Error('Função não encontrada: ' + nome);
  const r = await mitra.executeServerFunctionMitra({ projectId, serverFunctionId: id, input: input || {} });
  const res = r && r.result;
  if (!res || res.executionStatus === 'FAILED') throw new Error(nome + ': ' + JSON.stringify(res && res.error || r).slice(0, 300));
  let out = res.output;
  if (typeof out === 'string') { try { out = JSON.parse(out); } catch (e) { } }
  return out;
}
async function linhas(nome, input) { const o = await sf(nome, input); return (o && o.rows) || []; }
function agoraBR() { return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19); }
function hojeBR() { return agoraBR().slice(0, 10); }
function txt(v) { return v == null ? '' : String(v); }
function numTxt(v) { return v == null || !isFinite(v) ? '' : String(Math.round(Number(v) * 100) / 100); }
async function ler(url, formato) {
  try {
    const o = await sf(formato === 'html' ? 'lerPaginaHtml' : 'lerPaginaWeb', { url });
    const st = o && o.statusCode;
    let body = o && o.body;
    if (body && typeof body === 'object') body = JSON.stringify(body);
    body = txt(body);
    if (st !== 200) {
      const lim = /AbuseAlleviation|blocked until|429|Rate/i.test(body);
      return { ok: false, motivo: lim ? 'limite de acessos da loja' : 'sem acesso (' + st + ')' };
    }
    const err = body.match(/Target URL returned error (\d{3})/i);
    if (err && Number(err[1]) >= 400) return { ok: false, motivo: 'a loja recusou o acesso (' + err[1] + ')', body };
    if (/captcha|verifique que (você )?não é um robô|account-verification|enable javascript|Please enable JS/i.test(body.slice(0, 6000))) return { ok: false, motivo: 'a loja exige verificação humana', body };
    return { ok: true, body };
  } catch (e) {
    return { ok: false, motivo: 'erro ao abrir a página' };
  }
}
function urlPrint(u) {
  if (!u) return null;
  let base = String(u).split('#')[0];
  try {
    const x = new URL(base);
    if (/amazon\./.test(x.hostname)) { const m = x.pathname.match(/\/dp\/([A-Z0-9]{10})/); if (m) return 'https://' + x.hostname + '/dp/' + m[1]; }
    base = x.origin + x.pathname + (/\/lead$|\/redirect|[?&](oid|id|sku|item)=/i.test(x.pathname + x.search) ? x.search : '');
  } catch (e) { return null; }
  return base;
}
function fontePrint(u) {
  const b = urlPrint(u);
  return b ? 'https://image.thum.io/get/width/1100/crop/1400/noanimate/' + b : null;
}
async function baixarPrint(fonte) {
  if (fonte.startsWith('https://image.thum.io/')) {
    try {
      const r = await fetch(fonte, { signal: AbortSignal.timeout(40000) });
      const tipo = r.headers.get('content-type') || '';
      if (r.status !== 200 || !tipo.startsWith('image')) return { estado: 'falhou' };
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 22000) return { estado: 'gerando' };
      const ext = tipo.includes('png') ? 'png' : 'jpg';
      const up = await mitra.uploadFilePrivateMitra({ projectId, file: new File([buf], 'print.' + ext, { type: tipo }) });
      const key = up && up.result && up.result.key;
      return key ? { estado: 'ok', key } : { estado: 'falhou' };
    } catch (e) { return { estado: 'falhou' }; }
  }
  try {
    const o = await sf('baixarImagemWeb', { url: fonte });
    const b = txt(o && o.body);
    if (o.statusCode !== 200 || !b.startsWith('data:image')) return { estado: 'falhou' };
    if (b.length < 22000) return { estado: 'gerando' };
    const buf = Buffer.from(b.split(',')[1], 'base64');
    const up = await mitra.uploadFilePrivateMitra({ projectId, file: new File([buf], 'print.jpg', { type: 'image/jpeg' }) });
    const key = up && up.result && up.result.key;
    return key ? { estado: 'ok', key } : { estado: 'falhou' };
  } catch (e) { return { estado: 'falhou' }; }
}
async function pedirPrint(fonte) { if (fonte.startsWith('https://image.thum.io/')) return; try { await sf('baixarImagemWeb', { url: fonte }); } catch (e) { } }
async function processarPrints(limite) {
  const pend = await linhas('intPrintsPendentes', {});
  let feitos = 0; const grupos = {};
  for (const p of pend.slice(0, limite || 40)) (grupos[p.FONTE] = grupos[p.FONTE] || []).push(p);
  const fontes = Object.keys(grupos);
  for (let i = 0; i < fontes.length; i += 6) {
    const lote = fontes.slice(i, i + 6);
    const res = await Promise.all(lote.map(baixarPrint));
    for (const [j, fonte] of lote.entries()) {
      const r = res[j];
      for (const p of grupos[fonte]) {
        await sf('intSalvarPrint', { tabela: p.TABELA, id: Number(p.ID), key: r.estado === 'ok' ? r.key : '' });
      }
      if (r.estado === 'ok') feitos++;
    }
  }
  return feitos;
}
async function mensagem(m) {
  await sf('intInserirMensagem', {
    autor: m.autor || 'ASSISTENTE', tipo: m.tipo || 'INFO', produtoId: Number(m.produtoId || 0), ofertaId: Number(m.ofertaId || 0),
    texto: txt(m.texto).slice(0, 4000), dados: m.dados ? JSON.stringify(m.dados) : '', pergunta: m.pergunta || ''
  });
}

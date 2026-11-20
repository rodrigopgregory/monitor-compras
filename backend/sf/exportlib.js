const zlib = require('zlib');
const CRC_TAB = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TAB[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function montarZip(entradas) {
  const partes = [], central = [];
  let pos = 0;
  const d = new Date();
  const dosT = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1);
  const dosD = ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
  for (const e of entradas) {
    const nome = Buffer.from(e.nome, 'utf8');
    const dados = e.dados;
    const comp = zlib.deflateRawSync(dados);
    const usar = comp.length < dados.length;
    const corpo = usar ? comp : dados;
    const crc = crc32(dados);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(usar ? 8 : 0, 8);
    lh.writeUInt16LE(dosT, 10); lh.writeUInt16LE(dosD, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(corpo.length, 18);
    lh.writeUInt32LE(dados.length, 22); lh.writeUInt16LE(nome.length, 26);
    partes.push(lh, nome, corpo);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(usar ? 8 : 0, 10);
    ch.writeUInt16LE(dosT, 12); ch.writeUInt16LE(dosD, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(corpo.length, 20);
    ch.writeUInt32LE(dados.length, 24); ch.writeUInt16LE(nome.length, 28); ch.writeUInt32LE(pos, 42);
    central.push(ch, nome);
    pos += 30 + nome.length + corpo.length;
  }
  const tamCentral = central.reduce((s, b) => s + b.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(entradas.length, 8); fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(tamCentral, 12); fim.writeUInt32LE(pos, 16);
  return Buffer.concat([...partes, ...central, fim]);
}
async function xq(sql) { const r = await mitra.runQueryMitra({ projectId, sql }); return (r && r.result && r.result.rows) || []; }
async function xd(sql) { await mitra.runDmlMitra({ projectId, sql }); }
function xesc(v) { return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "''"); }
function nomeTabela(t) { if (!/^[A-Z0-9_]{1,64}$/.test(t)) throw new Error('Nome de tabela inválido'); return t; }
async function listaTabelas() {
  const rows = await xq("SELECT TABLE_NAME AS N FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND (LEFT(TABLE_NAME, 3) = 'MC_' OR LEFT(TABLE_NAME, 7) = 'EXPORT_' OR TABLE_NAME = 'SEQ') ORDER BY TABLE_NAME");
  return rows.map(r => nomeTabela(String(r.N)));
}
async function ddlDe(tabela) {
  const t = nomeTabela(tabela);
  const cols = await xq(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${t}' ORDER BY ORDINAL_POSITION`);
  const idx = await xq(`SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${t}' ORDER BY INDEX_NAME, SEQ_IN_INDEX`);
  const info = await xq(`SELECT TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${t}'`);
  const linhasDdl = cols.map(c => {
    let s = '  `' + c.COLUMN_NAME + '` ' + c.COLUMN_TYPE + (c.IS_NULLABLE === 'NO' ? ' NOT NULL' : ' NULL');
    const extra = String(c.EXTRA || '');
    if (/auto_increment/i.test(extra)) s += ' AUTO_INCREMENT';
    else if (c.COLUMN_DEFAULT != null) s += /DEFAULT_GENERATED/i.test(extra) ? ' DEFAULT ' + c.COLUMN_DEFAULT : " DEFAULT '" + xesc(c.COLUMN_DEFAULT) + "'";
    if (c.COLUMN_COMMENT) s += " COMMENT '" + xesc(c.COLUMN_COMMENT) + "'";
    return s;
  });
  const grupos = {};
  for (const i of idx) (grupos[i.INDEX_NAME] = grupos[i.INDEX_NAME] || { unico: Number(i.NON_UNIQUE) === 0, cols: [] }).cols.push('`' + i.COLUMN_NAME + '`');
  for (const [nome, g] of Object.entries(grupos)) {
    if (nome === 'PRIMARY') linhasDdl.push('  PRIMARY KEY (' + g.cols.join(', ') + ')');
    else linhasDdl.push('  ' + (g.unico ? 'UNIQUE KEY' : 'KEY') + ' `' + nome + '` (' + g.cols.join(', ') + ')');
  }
  const coment = info[0] && info[0].TABLE_COMMENT ? " COMMENT='" + xesc(info[0].TABLE_COMMENT) + "'" : '';
  return 'CREATE TABLE IF NOT EXISTS `' + t + '` (\n' + linhasDdl.join(',\n') + '\n)' + coment + ';\n';
}
function celulaCsv(v) {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
async function csvDe(tabela) {
  const t = nomeTabela(tabela);
  const pk = await xq(`SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${t}' AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX`);
  const ordem = pk.length ? pk.map(p => '`' + p.COLUMN_NAME + '`').join(', ') : '1';
  const passo = 800;
  let colunas = null;
  const saida = [];
  for (let desde = 0; ; desde += passo) {
    const rows = await xq(`SELECT * FROM \`${t}\` ORDER BY ${ordem} LIMIT ${passo} OFFSET ${desde}`);
    if (!rows.length) break;
    if (!colunas) { colunas = Object.keys(rows[0]); saida.push(colunas.map(celulaCsv).join(',')); }
    for (const r of rows) saida.push(colunas.map(c => celulaCsv(r[c])).join(','));
    if (rows.length < passo) break;
  }
  if (!colunas) {
    const c = await xq(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${t}' ORDER BY ORDINAL_POSITION`);
    saida.push(c.map(x => celulaCsv(x.COLUMN_NAME)).join(','));
  }
  return Buffer.from('\uFEFF' + saida.join('\r\n') + '\r\n', 'utf8');
}
async function baixarCodigo(tipo) {
  const r = (await xq(`SELECT CHAVE_ARQUIVO, COMMIT_GIT, CRIADO_EM FROM EXPORT_CODIGO WHERE TIPO = '${tipo === 'GIT' ? 'GIT' : 'FONTE'}' ORDER BY ID DESC LIMIT 1`))[0];
  if (!r) throw new Error('O código do app ainda não foi preparado para a exportação.');
  const blob = await mitra.downloadFilePrivateMitra({ projectId, key: r.CHAVE_ARQUIVO });
  return { buf: Buffer.from(await blob.arrayBuffer()), commit: r.COMMIT_GIT, criadoEm: r.CRIADO_EM };
}
async function montarPacote(tipo, etapa) {
  const entradas = [];
  await etapa('Lendo o código…');
  const fonte = await baixarCodigo('FONTE');
  const pacote = JSON.parse(zlib.gunzipSync(fonte.buf).toString('utf8'));
  for (const a of pacote.arquivos) entradas.push({ nome: 'codigo/' + a.p, dados: Buffer.from(a.b, 'base64') });
  const tabelas = await listaTabelas();
  await etapa('Lendo a estrutura do banco…');
  const ddls = [];
  for (const t of tabelas) ddls.push(await ddlDe(t));
  entradas.push({ nome: 'banco/estrutura.sql', dados: Buffer.from('-- Estrutura do banco do Monitor de Compras\n-- Gerado em ' + agoraBR() + ' (Brasília)\n\n' + ddls.join('\n'), 'utf8') });
  const resumo = [];
  for (const t of tabelas) {
    const n = Number((await xq(`SELECT COUNT(*) C FROM \`${t}\``))[0].C);
    const soEstrutura = /^EXPORT_/.test(t) || (tipo === 'LEVE' && (n > 2000 || t === 'SEQ'));
    if (soEstrutura) { resumo.push(t + ': só a estrutura (' + n + ' linhas no banco)'); continue; }
    await etapa('Lendo os dados de ' + t + '…');
    entradas.push({ nome: 'banco/dados/' + t + '.csv', dados: await csvDe(t) });
    resumo.push(t + ': ' + n + ' linhas');
  }
  if (tipo === 'COMPLETO') {
    await etapa('Juntando o histórico do git…');
    const git = await baixarCodigo('GIT');
    entradas.push({ nome: 'historico-git/repositorio.bundle', dados: git.buf });
  }
  const leiame = [
    'Monitor de Compras: exportação ' + (tipo === 'LEVE' ? 'leve' : 'completa'),
    'Gerada em ' + agoraBR().replace('T', ' ') + ' (Brasília). Código no commit ' + (fonte.commit || 'desconhecido') + ' (preparado em ' + String(fonte.criadoEm || '').replace('T', ' ') + ').',
    '',
    'codigo/            frontend, backend (as Server Functions ficam em backend/sf) e os documentos do projeto. Sem node_modules e sem .env.',
    'banco/estrutura.sql  CREATE TABLE de todas as tabelas do app.',
    'banco/dados/        uma planilha CSV (UTF-8) por tabela.',
    tipo === 'COMPLETO' ? 'historico-git/      repositorio.bundle: todo o histórico do git. Para abrir: git clone repositorio.bundle meu-app' : '',
    '',
    'Tabelas:',
    ...resumo.map(r => '  ' + r),
    '',
    'Não entram: prints guardados como arquivos, segredos, tokens e a configuração do envio ao GitHub.',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n') + '\n';
  entradas.push({ nome: 'LEIAME.txt', dados: Buffer.from(leiame, 'utf8') });
  return entradas;
}
async function criarExportacao(tipo) {
  const agora = agoraBR();
  const nome = (tipo === 'LEVE' ? 'leve-' : 'completa-') + agora.slice(0, 10) + '-' + agora.slice(11, 16).replace(':', '') + '.zip';
  await xd(`INSERT INTO EXPORT_LEVE (TIPO, NOME, ESTADO, ETAPA, INICIOU_EM) VALUES ('${tipo}', '${nome}', 'ENVIANDO', 'Começando…', '${agora}')`);
  const r = await xq(`SELECT ID FROM EXPORT_LEVE WHERE TIPO = '${tipo}' AND INICIOU_EM = '${agora}' ORDER BY ID DESC LIMIT 1`);
  return { id: Number(r[0].ID), nome };
}
async function produzirExportacao(id, tipo, nome) {
  const etapa = async txt => { try { await xd(`UPDATE EXPORT_LEVE SET ETAPA = '${xesc(String(txt).slice(0, 110))}' WHERE ID = ${Number(id)}`); } catch (e) { } };
  try {
    const entradas = await montarPacote(tipo, etapa);
    await etapa('Compactando…');
    const zip = montarZip(entradas);
    await etapa('Guardando o arquivo…');
    const up = await mitra.uploadFilePrivateMitra({ projectId, file: new File([zip], nome, { type: 'application/zip' }) });
    const key = up && up.result && up.result.key;
    if (!key) throw new Error('Não consegui guardar o arquivo gerado.');
    await xd(`UPDATE EXPORT_LEVE SET ESTADO = 'PRONTO', ETAPA = NULL, ERRO = NULL, CHAVE_ARQUIVO = '${xesc(key)}', TAMANHO_BYTES = ${zip.length}, TERMINOU_EM = '${agoraBR()}' WHERE ID = ${Number(id)}`);
    return { entradas, tamanho: zip.length };
  } catch (e) {
    const msg = String(e && e.message || e).slice(0, 400);
    try { await xd(`UPDATE EXPORT_LEVE SET ESTADO = 'ERRO', ETAPA = NULL, ERRO = '${xesc(msg)}', TERMINOU_EM = '${agoraBR()}' WHERE ID = ${Number(id)}`); } catch (e2) { }
    throw new Error(msg);
  }
}
async function limparExportacoes() {
  const velhas = await xq("SELECT ID, CHAVE_ARQUIVO FROM EXPORT_LEVE WHERE ESTADO = 'PRONTO' ORDER BY ID DESC LIMIT 100 OFFSET 5");
  for (const v of velhas) {
    if (v.CHAVE_ARQUIVO) { try { await mitra.deleteFileMitra({ projectId, key: v.CHAVE_ARQUIVO }); } catch (e) { } }
    await xd(`UPDATE EXPORT_LEVE SET ESTADO = 'EXPIRADO', CHAVE_ARQUIVO = NULL WHERE ID = ${Number(v.ID)}`);
  }
  const corte = new Date(Date.now() - 3 * 3600e3 - 7 * 86400e3).toISOString().slice(0, 19);
  await xd(`DELETE FROM EXPORT_LEVE WHERE ESTADO IN ('ERRO', 'EXPIRADO') AND INICIOU_EM < '${corte}'`);
}
async function virarVencidas() {
  const corte = new Date(Date.now() - 3 * 3600e3 - 45 * 60e3).toISOString().slice(0, 19);
  await xd(`UPDATE EXPORT_LEVE SET ESTADO = 'ERRO', ETAPA = NULL, ERRO = 'A geração parou antes de terminar. Gere de novo.', TERMINOU_EM = '${agoraBR()}' WHERE ESTADO = 'ENVIANDO' AND INICIOU_EM < '${corte}'`);
}

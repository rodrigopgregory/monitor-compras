import 'dotenv/config';
import * as M from 'mitra-sdk';
import fs from 'fs';
import { TABELAS } from './sf/tabelas.mjs';
import { SQL_SFS } from './sf/funcoesSql.mjs';
import { NOWS } from './sf/sql.mjs';

const projectId = Number(process.env.MITRA_PROJECT_ID);
if (projectId !== 67198) throw new Error('Este script é só do projeto Monitor de Compras (67198)');
M.configureSdkMitra({ baseURL: process.env.MITRA_BASE_URL, token: process.env.MITRA_TOKEN, integrationURL: process.env.MITRA_BASE_URL_INTEGRATIONS });

const ddl = sql => M.runDdlMitra({ projectId, sql });
const dml = sql => M.runDmlMitra({ projectId, sql });
const q = async sql => (await M.runQueryMitra({ projectId, sql })).result.rows;
const esc = v => String(v).replace(/'/g, "''");

for (const t of TABELAS) await ddl(t);
await ddl(`CREATE TABLE IF NOT EXISTS SEQ (N INT PRIMARY KEY) COMMENT='Sequencia 0..199 para ler listas JSON. RETENCAO: tudo, auxiliar'`);
if (Number((await q('SELECT COUNT(*) C FROM SEQ'))[0].C) < 200) {
  await dml(`INSERT IGNORE INTO SEQ (N) SELECT A.N + B.N * 10 + C.N * 100 FROM (SELECT 0 N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) A, (SELECT 0 N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) B, (SELECT 0 N UNION SELECT 1) C`);
}

const LOJAS = [
  ['Amazon', 'amazon.com.br', 'https://www.amazon.com.br/s?k={q}', 'LOJA'],
  ['Mercado Livre', 'mercadolivre.com.br', 'https://lista.mercadolivre.com.br/{q-}', 'LOJA'],
  ['Magalu', 'magazineluiza.com.br', 'https://www.magazineluiza.com.br/busca/{q%}/', 'LOJA'],
  ['Kabum', 'kabum.com.br', 'https://www.kabum.com.br/busca/{q-}', 'LOJA'],
  ['Google Shopping', 'google.com', 'https://www.google.com/search?tbm=shop&hl=pt-BR&gl=br&q={q}', 'COMPARADOR'],
  ['Buscapé', 'buscape.com.br', 'https://www.buscape.com.br/search?q={q%}', 'COMPARADOR'],
  ['Zoom', 'zoom.com.br', 'https://www.zoom.com.br/search?q={q%}', 'COMPARADOR'],
  ['Angeloni', 'angeloni.com.br', 'https://www.angeloni.com.br/super/busca?q={q%}', 'LOJA'],
  ['Bistek', 'bistek.com.br', 'https://www.bistek.com.br/catalogsearch/result/?q={q%}', 'LOJA'],
  ['Carrefour', 'carrefour.com.br', 'https://www.carrefour.com.br/busca/{q%}', 'LOJA'],
  ['Droga Raia', 'drogaraia.com.br', 'https://www.drogaraia.com.br/search?w={q%}', 'LOJA'],
  ['Panvel', 'panvel.com', 'https://www.panvel.com/panvel/buscarProduto.do?termoPesquisa={q%}', 'LOJA'],
  ['Preço Popular', 'precopopular.com.br', 'https://www.precopopular.com.br/busca?q={q%}', 'LOJA'],
  ['Busca aberta na web', null, 'https://lite.duckduckgo.com/lite/?q={q}+preco', 'BUSCA'],
  ['Pague Menos', 'paguemenos.com.br', 'vtex:https://www.paguemenos.com.br/api/catalog_system/pub/products/search?ft={q%}&_from=0&_to=19', 'LOJA'],
  ['São João', 'saojoaofarmacias.com.br', 'vtex:https://www.saojoaofarmacias.com.br/api/catalog_system/pub/products/search?ft={q%}&_from=0&_to=19', 'LOJA'],
  ['FarmaSesi', 'farmasesi.com.br', 'farmasesi:https://www.farmasesi.com.br/busca?q={q%}', 'LOJA'],
  ['Giassi', 'giassi.com.br', 'vtex:https://www.giassi.com.br/api/catalog_system/pub/products/search?ft={q%}&_from=0&_to=19', 'LOJA'],
  ['Fort Atacadista', 'fortatacadista.com.br', 'web:https://www.fortatacadista.com.br/busca?q={q%}', 'LOJA'],
  ['Koch', 'superkoch.com.br', 'web:https://www.superkoch.com.br/busca?q={q%}', 'LOJA'],
  ['Koerich', 'koerich.com.br', 'occ:https://www.koerich.com.br/ccstoreui/v1/search?Ntt={q%}&Nrpp=20', 'LOJA'],
  ['Colombo', 'colombo.com.br', 'ldjson:https://www.colombo.com.br/busca?q={q%}', 'LOJA'],
];
const URL_API = {
  'Angeloni': 'vtex:https://super.angeloni.com.br/api/catalog_system/pub/products/search?ft={q%}&_from=0&_to=19',
  'Bistek': 'vtex:https://www.bistek.com.br/api/catalog_system/pub/products/search?ft={q%}&_from=0&_to=19',
  'Preço Popular': 'vtex:https://www.precopopular.com.br/api/catalog_system/pub/products/search?ft={q%}&_from=0&_to=19',
};
for (const [i, [nome, dom, url, tipo]] of LOJAS.entries()) {
  await dml(`INSERT INTO MC_LOJA (NOME, DOMINIO, URL_BUSCA, TIPO, PADRAO, ATIVA, ORDEM, CRIADO_EM)
    SELECT '${esc(nome)}', ${dom ? `'${dom}'` : 'NULL'}, '${esc(url)}', '${tipo}', 1, 1, ${i + 1}, ${NOWS} FROM DUAL
    WHERE NOT EXISTS (SELECT 1 FROM MC_LOJA WHERE NOME = '${esc(nome)}' AND PADRAO = 1)`);
}
await dml(`UPDATE MC_LOJA SET URL_BUSCA = REPLACE(URL_BUSCA, 'https://html.duckduckgo.com/html/', 'https://lite.duckduckgo.com/lite/') WHERE URL_BUSCA LIKE 'https://html.duckduckgo.com/html/%'`);
await dml(`UPDATE MC_LOJA SET URL_BUSCA = 'https://lite.duckduckgo.com/lite/?q={q}+preco' WHERE TIPO = 'BUSCA' AND PADRAO = 1`);
for (const [nome, url] of Object.entries(URL_API)) await dml(`UPDATE MC_LOJA SET URL_BUSCA = '${esc(url)}' WHERE NOME = '${esc(nome)}' AND PADRAO = 1`);
if (Number((await q('SELECT COUNT(*) C FROM MC_FAIXA'))[0].C) === 0) {
  await dml(`INSERT INTO MC_FAIXA (ORDEM, NOME, MIN_PCT, ATUALIZADO_EM) VALUES (1, 'Imperdível', 50, ${NOWS}), (2, 'Ótima oportunidade', 30, ${NOWS}), (3, 'Boa oportunidade', 20, ${NOWS})`);
}
await dml(`INSERT IGNORE INTO MC_CONFIG (CHAVE, VALOR, ATUALIZADO_EM) VALUES ('HORA_LEMBRETE', '09:00', ${NOWS})`);
await dml(`INSERT IGNORE INTO MC_CONFIG (CHAVE, VALOR, ATUALIZADO_EM) VALUES ('GEMINI_CONEXOES', 'gemini', ${NOWS}), ('MODELO_ANALISE', 'gemini-3.5-flash-lite,gemini-3.1-flash-lite', ${NOWS})`);

const existentes = {};
for (const f of (await M.listServerFunctionsMitra({ projectId })).result) existentes[f.name] = f.id;
async function garantir(name, type, code, description, extra) {
  if (existentes[name]) {
    await M.updateServerFunctionMitra({ projectId, serverFunctionId: existentes[name], code, description, ...(extra || {}) });
    return existentes[name];
  }
  const r = await M.createServerFunctionMitra({ projectId, name, type, code, description, ...(extra || {}) });
  const id = r.result.serverFunctionId ?? r.result.id;
  existentes[name] = id;
  return id;
}
await garantir('lerPaginaHtml', 'INTEGRATION', JSON.stringify({ connection: 'leitor-web', method: 'GET', endpoint: '/event.url', headers: { 'X-Return-Format': 'html' } }), 'Lê o HTML de uma página pelo leitor. Uso interno.');
for (const [name, def] of Object.entries(SQL_SFS)) await garantir(name, 'SQL', def.c, def.d);

const JS = {
  rodadaProduto: ['rodada.js', 'Rodada de busca de um produto: lojas da lista fixa, busca aberta, similares, valor de mercado, faixas e avisos. Uso interno (chamada pelo ciclo).'],
  ciclo: ['ciclo.js', 'Ciclo agendado a cada 5 minutos: encerra produtos na data de fim, manda lembretes no horário do usuário, guarda prints e dispara as rodadas de hora em hora.'],
  enviarMensagem: ['conversa.js', 'Mensagem do usuário na conversa: cadastra produto por link, responde sim/não, acrescenta loja, muda horário do lembrete ou cancela monitoramento.'],
  buscarAgora: ['buscar.js', 'Botão Buscar agora: põe produtos na fila e já começa a rodada de até 2; o resto entra pelo ciclo a cada 5 minutos.'],
  linksPrints: ['links.js', 'Links temporários dos prints de ofertas e produtos (em lote).'],
  exportar: ['exportar.js', 'Exportação do app (leve e completa): inicia a geração em segundo plano, grava o ZIP como arquivo privado e entrega o link de download.'],
  exportarGit: ['exportarGit.js', 'Envia a exportação leve ao GitHub num novo commit (repositório, branch e token ficam em GIT_CONFIG, que nenhuma tela lê).'],
};
const COM_EXPORT = new Set(['exportar', 'exportarGit']);
const lib = fs.readFileSync('sf/lib.js', 'utf8');
const comum = fs.readFileSync('sf/comum.js', 'utf8');
const exportlib = fs.readFileSync('sf/exportlib.js', 'utf8');
for (const name of Object.keys(JS)) if (!existentes[name]) await garantir(name, 'JAVASCRIPT', 'return {};', JS[name][1]);
const ids = JSON.stringify(existentes);
for (const [name, [arq, desc]] of Object.entries(JS)) {
  const corpo = fs.readFileSync('sf/' + arq, 'utf8');
  const code = `const SFID = ${ids};\n${comum}\n${lib}\n${COM_EXPORT.has(name) ? exportlib + '\n' : ''}return (async () => {\n${corpo}\n})();`;
  await garantir(name, 'JAVASCRIPT', code, desc, name === 'ciclo' ? { cronExpression: '0 */5 * * * *' } : undefined);
}

const perfis = (await M.listProfilesMitra({ projectId })).result || [];
let perfil = perfis.find(p => p.name === 'Usuário');
if (!perfil) { const r = await M.createProfileMitra({ projectId, name: 'Usuário' }); perfil = { id: r.result.id ?? r.result.profileId }; }
const telas = ['buscarAgora', 'enviarMensagem', 'linksPrints', 'telaConversa', 'telaProdutos', 'telaUltimaRodada', 'telaGrafico', 'telaNotificacoes', 'telaConfig', 'salvarFaixas', 'salvarProduto', 'cancelarProduto', 'alternarLoja', 'removerLoja', 'intAdicionarLoja', 'intSalvarHorario', 'telaExportar', 'exportar', 'exportarGit'];
const internas = Object.keys(existentes).filter(n => n.startsWith('int') || ['lerPaginaWeb', 'lerPaginaHtml', 'baixarImagemWeb', 'printMicrolink', 'rodadaProduto'].includes(n));
const atual = (await M.getProfileDetailsMitra({ projectId, profileId: perfil.id })).result;
const jaTem = new Set(((atual && atual.serverFunctions) || []).map(s => s.id ?? s.serverFunctionId ?? s));
const lista = [...new Set([...jaTem, ...[...telas, ...internas].map(n => existentes[n]).filter(Boolean)])];
await M.setProfileServerFunctionsMitra({ projectId, profileId: perfil.id, serverFunctionIds: lista });
await M.setProfileUsersMitra({ projectId, profileId: perfil.id, emails: ['sledt1006p01@imersao.mitralab.io'] });

await M.updateAdditionalBusinessInstructionsMitra({ projectId, instructions: `Monitor de Compras: assistente pessoal que acompanha o preço de produtos cadastrados por link.
Regras: o preço considerado é o "Por" (com desconto); o "De" é só informação e nunca entra no cálculo. Preço comparado = Por + frete (frete zero quando a loja dá frete grátis acima de um valor e o produto passa dele) — coluna MC_OFERTA.PRECO_COMPARADO. Valor de mercado = média dos preços comparados das lojas na rodada (uma oferta por loja, as com NO_CALCULO = 1) — MC_RODADA.VALOR_MERCADO. Desconto = (valor de mercado − preço comparado) ÷ valor de mercado. Faixas editáveis em MC_FAIXA (padrão Imperdível ≥ 50%, Ótima ≥ 30%, Boa ≥ 20%); abaixo da menor faixa não há aviso.
Tipos de oferta: EXATO, VARIACAO (mesma marca e linha, outro sabor/cor/embalagem; conta como o mesmo produto) e SIMILAR (outra marca, só com a busca de similares ligada, até 3 por rodada).
Server Functions: enviarMensagem(texto: string) — fala com o assistente (link de produto cadastra; "sim"/"não" responde a última pergunta; "adicionar loja Nome site.com.br"; "lembrete às 20h"; "cancelar <nome>"). cancelarProduto(produtoId: number) — encerra o monitoramento. salvarProduto(produtoId, buscaSimilares 0/1, incluirUsados 0/1, dataFim 'AAAA-MM-DD' ou '', marca, modelo, termo, caracteristicas).
Sobre sua tecnologia: você pode mencionar que usa o modelo Claude como IA e que roda em uma VM Linux. Quando perguntado sobre a engine agêntica (como o loop funciona, como o contexto é gerenciado), responda que é uma tecnologia proprietária do Mitra. NUNCA mencione Claude Code, OpenCode, Cursor, Copilot ou qualquer ferramenta de desenvolvimento assistido por IA. O sistema foi construído pela plataforma Mitra.` });

const ids2 = Object.fromEntries(Object.keys(existentes).filter(n => [...telas].includes(n)).map(n => [n, existentes[n]]));
fs.writeFileSync('../frontend/src/lib/sf-ids.ts', 'export const SF = ' + JSON.stringify(ids2, null, 2) + ' as const;\n');
console.log('Pronto. Funções:', Object.keys(existentes).length, 'perfil', perfil.id);

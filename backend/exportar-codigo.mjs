import 'dotenv/config';
import * as M from 'mitra-sdk';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
import os from 'os';

const projectId = Number(process.env.MITRA_PROJECT_ID);
if (projectId !== 67198) throw new Error('Este script é só do projeto Monitor de Compras (67198)');
M.configureSdkMitra({ baseURL: process.env.MITRA_BASE_URL, token: process.env.MITRA_TOKEN, integrationURL: process.env.MITRA_BASE_URL_INTEGRATIONS });

const raiz = path.resolve(process.cwd(), '..');
const git = args => execFileSync('git', args, { cwd: raiz, maxBuffer: 256 * 1024 * 1024 });
const q = async sql => (await M.runQueryMitra({ projectId, sql })).result.rows;
const dml = sql => M.runDmlMitra({ projectId, sql });
const agora = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19);
const commit = git(['rev-parse', 'HEAD']).toString().trim();

const lista = git(['ls-files', '-z']).toString().split('\0').filter(Boolean)
  .filter(f => !f.split('/').includes('node_modules') && !/(^|\/)\.env($|\.)/.test(f) || /\.env\.example$/.test(f));
const arquivos = [];
for (const f of lista) {
  const abs = path.join(raiz, f);
  if (!fs.existsSync(abs)) continue;
  arquivos.push({ p: f, b: fs.readFileSync(abs).toString('base64') });
}
const fonte = zlib.gzipSync(Buffer.from(JSON.stringify({ commit, arquivos }), 'utf8'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-'));
const bundlePath = path.join(tmp, 'repositorio.bundle');
git(['bundle', 'create', bundlePath, '--all']);
const bundle = fs.readFileSync(bundlePath);

async function subir(tipo, nome, buf, tipoMime) {
  const antigos = await q(`SELECT CHAVE_ARQUIVO FROM EXPORT_CODIGO WHERE TIPO = '${tipo}'`);
  const up = await M.uploadFilePrivateMitra({ projectId, file: new File([buf], nome, { type: tipoMime }) });
  const key = up && up.result && up.result.key;
  if (!key) throw new Error('Upload sem chave: ' + tipo);
  await dml(`INSERT INTO EXPORT_CODIGO (TIPO, CHAVE_ARQUIVO, COMMIT_GIT, ARQUIVOS, TAMANHO_BYTES, CRIADO_EM) VALUES ('${tipo}', '${key.replace(/'/g, "''")}', '${commit}', ${arquivos.length}, ${buf.length}, '${agora}')`);
  await dml(`DELETE FROM EXPORT_CODIGO WHERE TIPO = '${tipo}' AND CHAVE_ARQUIVO <> '${key.replace(/'/g, "''")}'`);
  for (const a of antigos) { try { await M.deleteFileMitra({ projectId, key: a.CHAVE_ARQUIVO }); } catch (e) { } }
}
await subir('FONTE', 'codigo.json.gz', fonte, 'application/gzip');
await subir('GIT', 'repositorio.bundle', bundle, 'application/octet-stream');
console.log('Código preparado para a exportação:', arquivos.length, 'arquivos, commit', commit.slice(0, 7));

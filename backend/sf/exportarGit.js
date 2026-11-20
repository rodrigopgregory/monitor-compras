const CHAVES_ESTADO = ['ENVIO_ESTADO', 'ENVIO_ETAPA', 'ENVIO_ERRO', 'ENVIO_INICIO', 'ENVIO_ARQUIVOS', 'ULTIMO_ENVIO_EM', 'ULTIMO_COMMIT', 'ULTIMO_COMMIT_URL'];
async function lerConfig() {
  const rows = await xq("SELECT CHAVE, VALOR FROM GIT_CONFIG");
  const c = {};
  for (const r of rows) c[r.CHAVE] = r.VALOR == null ? '' : String(r.VALOR);
  return c;
}
async function gravarEstado(chave, valor) {
  if (!CHAVES_ESTADO.includes(chave)) throw new Error('Chave inválida');
  await xd(`INSERT INTO GIT_CONFIG (CHAVE, VALOR) VALUES ('${chave}', '${xesc(String(valor).slice(0, 480))}') AS novo ON DUPLICATE KEY UPDATE VALOR = novo.VALOR`);
}
function repoDe(v) { return String(v || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/^\/+|\/+$/g, '').replace(/\.git$/i, ''); }
function limpar(texto, token) {
  let s = String(texto == null ? '' : texto);
  if (token) s = s.split(token).join('[REMOVIDO]');
  return s.replace(/AIza[0-9A-Za-z_-]{30,}/g, '[REMOVIDO]').replace(/gh[pousr]_[A-Za-z0-9]{20,}/g, '[REMOVIDO]').replace(/github_pat_[A-Za-z0-9_]{20,}/g, '[REMOVIDO]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REMOVIDO]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*$/g, '[REMOVIDO]');
}
const EXT_BINARIAS = /\.(png|jpe?g|gif|webp|ico|bmp|pdf|zip|gz|woff2?|ttf|otf|eot|bundle|mp3|mp4|webm|xlsx?)$/i;
function ehBinario(nome, dados) {
  if (EXT_BINARIAS.test(nome)) return true;
  return dados.subarray(0, 8000).includes(0);
}
function traduzir(status, msg, token) {
  const m = limpar(msg, token);
  if (status === 401) return 'O GitHub recusou o token (inválido ou vencido).';
  if (status === 403) return 'O GitHub negou o acesso: o token precisa de permissão de escrita no repositório, ou o limite de uso foi atingido. ' + m.slice(0, 120);
  if (status === 404) return 'O GitHub não encontrou o repositório ou a branch. Confira o endereço e se o token enxerga esse repositório.';
  if (status === 409) return 'O repositório está vazio ou foi alterado no meio do envio. Se estiver vazio, crie o primeiro commit (por exemplo, um README) e envie de novo.';
  if (status === 422) return 'O GitHub não aceitou a atualização: ' + m.slice(0, 200);
  return 'Erro do GitHub (' + status + '): ' + m.slice(0, 200);
}
async function gh(token, metodo, caminho, corpo) {
  for (let tentativa = 0; ; tentativa++) {
    const r = await fetch('https://api.github.com' + caminho, {
      method: metodo,
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'monitor-de-compras', 'Content-Type': 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const texto = await r.text();
    let j = null;
    try { j = JSON.parse(texto); } catch (e) { }
    if (r.ok) return j;
    if ((r.status >= 500 || r.status === 429) && tentativa < 3) { await dormir(1500 * (tentativa + 1)); continue; }
    throw new Error(traduzir(r.status, (j && j.message) || texto, token));
  }
}
const acao = String(event.acao || '');
if (acao === 'iniciar') {
  const c = await lerConfig();
  if (!repoDe(c.REPO) || !c.TOKEN) throw new Error('O envio ao GitHub ainda não foi configurado.');
  const corte = new Date(Date.now() - 3 * 3600e3 - 45 * 60e3).toISOString().slice(0, 19);
  if (c.ENVIO_ESTADO === 'ENVIANDO' && (c.ENVIO_INICIO || '') > corte) return { jaEmAndamento: true };
  await gravarEstado('ENVIO_ESTADO', 'ENVIANDO');
  await gravarEstado('ENVIO_ETAPA', 'Preparando os arquivos…');
  await gravarEstado('ENVIO_ERRO', '');
  await gravarEstado('ENVIO_INICIO', agoraBR());
  await mitra.executeServerFunctionAsyncMitra({ projectId, serverFunctionId: SFID.exportarGit, input: { acao: 'executar' } });
  return { ok: true };
}
if (acao === 'executar') {
  const c = await lerConfig();
  const token = c.TOKEN || '';
  const repo = repoDe(c.REPO);
  const branch = String(c.BRANCH || 'main').trim() || 'main';
  if (c.ENVIO_ESTADO !== 'ENVIANDO') return { ok: false };
  try {
    if (!repo || !token) throw new Error('O envio ao GitHub ainda não foi configurado.');
    const exp = await criarExportacao('LEVE');
    const { entradas } = await produzirExportacao(exp.id, 'LEVE', exp.nome);
    await gravarEstado('ENVIO_ETAPA', 'Enviando ao GitHub…');
    const arquivos = [];
    for (const e of entradas) {
      const partes = e.nome.split('/');
      if (partes.includes('node_modules')) continue;
      const base = partes[partes.length - 1];
      if (base === '.env' || (/^\.env\./.test(base) && !/\.example$/.test(base))) continue;
      const caminho = e.nome.startsWith('codigo/') ? e.nome.slice(7) : 'exportacao/' + e.nome;
      if (!caminho) continue;
      if (ehBinario(caminho, e.dados)) arquivos.push({ caminho, conteudo: e.dados.toString('base64'), encoding: 'base64' });
      else arquivos.push({ caminho, conteudo: limpar(e.dados.toString('utf8'), token), encoding: 'utf-8' });
    }
    const ref = await gh(token, 'GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    const baseCommit = ref.object.sha;
    const commitBase = await gh(token, 'GET', `/repos/${repo}/git/commits/${baseCommit}`);
    const itens = [];
    for (let i = 0; i < arquivos.length; i += 4) {
      const lote = arquivos.slice(i, i + 4);
      const blobs = await Promise.all(lote.map(a => gh(token, 'POST', `/repos/${repo}/git/blobs`, { content: a.conteudo, encoding: a.encoding })));
      lote.forEach((a, k) => itens.push({ path: a.caminho, mode: '100644', type: 'blob', sha: blobs[k].sha }));
      if (i % 80 === 0) await gravarEstado('ENVIO_ETAPA', 'Enviando ao GitHub… (' + Math.min(i + 4, arquivos.length) + ' de ' + arquivos.length + ')');
    }
    let arvore = commitBase.tree.sha;
    for (let i = 0; i < itens.length; i += 60) {
      const t = await gh(token, 'POST', `/repos/${repo}/git/trees`, { base_tree: arvore, tree: itens.slice(i, i + 60) });
      arvore = t.sha;
    }
    const quando = agoraBR().replace('T', ' ');
    const commit = await gh(token, 'POST', `/repos/${repo}/git/commits`, { message: 'Exportação do Monitor de Compras em ' + quando, tree: arvore, parents: [baseCommit] });
    await gh(token, 'PATCH', `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { sha: commit.sha, force: false });
    await gravarEstado('ULTIMO_ENVIO_EM', agoraBR());
    await gravarEstado('ULTIMO_COMMIT', commit.sha.slice(0, 7));
    await gravarEstado('ULTIMO_COMMIT_URL', `https://github.com/${repo}/commit/${commit.sha}`);
    await gravarEstado('ENVIO_ARQUIVOS', String(arquivos.length));
    await gravarEstado('ENVIO_ERRO', '');
    await gravarEstado('ENVIO_ETAPA', '');
    await gravarEstado('ENVIO_ESTADO', 'OK');
    await limparExportacoes();
    return { ok: true, arquivos: arquivos.length };
  } catch (e) {
    const msg = limpar(e && e.message || e, token).slice(0, 400);
    try { await gravarEstado('ENVIO_ERRO', msg); await gravarEstado('ENVIO_ETAPA', ''); await gravarEstado('ENVIO_ESTADO', 'ERRO'); } catch (e2) { }
    return { ok: false, erro: msg };
  }
}
throw new Error('Ação inválida.');

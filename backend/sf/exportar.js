const acao = String(event.acao || '');
if (acao === 'iniciar') {
  const tipo = event.tipo === 'COMPLETO' ? 'COMPLETO' : event.tipo === 'LEVE' ? 'LEVE' : '';
  if (!tipo) throw new Error('Tipo de exportação inválido.');
  await virarVencidas();
  const emAndamento = await xq(`SELECT ID FROM EXPORT_LEVE WHERE TIPO = '${tipo}' AND ESTADO = 'ENVIANDO' ORDER BY ID DESC LIMIT 1`);
  if (emAndamento.length) return { id: Number(emAndamento[0].ID), jaEmAndamento: true };
  const { id } = await criarExportacao(tipo);
  await mitra.executeServerFunctionAsyncMitra({ projectId, serverFunctionId: SFID.exportar, input: { acao: 'gerar', id } });
  return { id };
}
if (acao === 'gerar') {
  const id = Math.floor(Number(event.id || 0));
  const linha = (await xq(`SELECT TIPO, NOME FROM EXPORT_LEVE WHERE ID = ${id} AND ESTADO = 'ENVIANDO'`))[0];
  if (!linha) return { ok: false };
  const r = await produzirExportacao(id, linha.TIPO, linha.NOME);
  await limparExportacoes();
  return { ok: true, tamanho: r.tamanho };
}
if (acao === 'link') {
  const id = Math.floor(Number(event.id || 0));
  const linha = (await xq(`SELECT NOME, CHAVE_ARQUIVO FROM EXPORT_LEVE WHERE ID = ${id} AND ESTADO = 'PRONTO'`))[0];
  if (!linha || !linha.CHAVE_ARQUIVO) throw new Error('Esse arquivo não está mais disponível. Gere de novo.');
  const l = await mitra.getFileLinkMitra({ projectId, key: linha.CHAVE_ARQUIVO, ttlSeconds: 90 });
  const url = l && l.result && l.result.url;
  if (!url) throw new Error('Não consegui abrir o arquivo agora. Tente de novo.');
  return { url, nome: linha.NOME };
}
throw new Error('Ação inválida.');

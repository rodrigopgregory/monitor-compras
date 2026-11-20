const produtoId = Math.max(0, Math.floor(Number(event.produtoId || 0))) || 0;
await sf('intPedirBusca', { produtoId });
const iniciados = [];
if (produtoId) {
  const f0 = (await linhas('intFilaBusca', { produtoId }))[0] || {};
  if (Number(f0.NA_FILA || 0) > 0) {
    await sf('intMarcarInicio', { produtoId });
    await mitra.executeServerFunctionAsyncMitra({ projectId, serverFunctionId: SFID.rodadaProduto, input: { produtoId } });
    iniciados.push(produtoId);
  }
}
for (let i = 0; i < 2 && !produtoId; i++) {
  const p = (await linhas('intProximoProduto', {}))[0];
  if (!p) break;
  await sf('intMarcarInicio', { produtoId: Number(p.ID) });
  await mitra.executeServerFunctionAsyncMitra({ projectId, serverFunctionId: SFID.rodadaProduto, input: { produtoId: Number(p.ID) } });
  iniciados.push(Number(p.ID));
}
const f = (await linhas('intFilaBusca', { produtoId }))[0] || {};
return { iniciados: iniciados.length, naFila: Number(f.NA_FILA || 0), emRodada: Number(f.EM_RODADA || 0) };

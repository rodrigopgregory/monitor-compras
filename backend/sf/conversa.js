const texto = String(event.texto || '').trim().slice(0, 2000);
const mensagemId = Number(event.mensagemId || 0);
const respostaBotao = String(event.resposta || '').toUpperCase();
const res = { acoes: [] };
const SIM = /^(sim|s|pode|claro|quero|ok|isso|liga|ligar|yes|continuar|continua)\b/i;
const NAO = /^(n[aã]o|nao|n|nem|desliga|desligar|no|parar|para|cancela)\b/i;
async function responder(perg, resp) {
  await sf('intResponder', { mensagemId: Number(perg.ID), resposta: resp });
  const produtoId = Number(perg.PRODUTO_ID || 0);
  const prod = produtoId ? (await linhas('intProduto', { produtoId }))[0] : null;
  if (perg.PERGUNTA === 'SIMILARES') {
    await sf('intSimilares', { produtoId, valor: resp === 'SIM' ? 1 : 0 });
    await mensagem({ tipo: 'INFO', produtoId, texto: resp === 'SIM'
      ? 'Combinado: busca de similares ligada para "' + (prod && prod.NOME) + '". Em cada rodada trago até 3 produtos semelhantes de outras marcas, marcados como "similar". Já comecei a primeira rodada nas lojas.'
      : 'Combinado: sem similares para "' + (prod && prod.NOME) + '". Busco só o produto e as variações dele. Já comecei a primeira rodada nas lojas.' });
    await mitra.executeServerFunctionAsyncMitra({ projectId, serverFunctionId: SFID.rodadaProduto, input: { produtoId } });
    res.acoes.push('rodada');
  } else if (perg.PERGUNTA === 'CONTINUAR') {
    if (resp === 'SIM') {
      await mensagem({ tipo: 'INFO', produtoId, texto: 'Certo, continuo monitorando "' + (prod && prod.NOME) + '" de hora em hora e aviso quando o preço entrar numa faixa de novo.' });
    } else {
      await sf('intEncerrar', { produtoId, motivo: 'não quis continuar' });
      await mensagem({ tipo: 'FIM', produtoId, texto: 'Pronto, "' + (prod && prod.NOME) + '" saiu do monitoramento. Não faço mais rodadas nem avisos dele; o histórico fica guardado.' });
    }
  }
}
if (mensagemId && (respostaBotao === 'SIM' || respostaBotao === 'NAO')) {
  const perg = (await linhas('intPergunta', { mensagemId }))[0];
  if (!perg) return { error: 'Pergunta não encontrada' };
  if (perg.RESPOSTA) return { error: 'Essa pergunta já foi respondida' };
  await mensagem({ autor: 'USUARIO', tipo: 'USUARIO', produtoId: Number(perg.PRODUTO_ID || 0), texto: respostaBotao === 'SIM' ? 'Sim' : 'Não' });
  await responder(perg, respostaBotao);
  return res;
}
if (!texto) return { error: 'Escreva uma mensagem' };
await mensagem({ autor: 'USUARIO', tipo: 'USUARIO', texto });
const urlM = texto.match(/https?:\/\/[^\s<>"']+/i);
const nt = norm(texto);
const perg = (await linhas('intPerguntaAberta', {}))[0];
if (!urlM && perg && (SIM.test(nt) || NAO.test(nt)) && !/loja|horario|lembrete/.test(nt)) {
  await responder(perg, SIM.test(nt) ? 'SIM' : 'NAO');
  return res;
}
if (urlM && !/(loja|site)\b/.test(nt.replace(urlM[0].toLowerCase(), ''))) {
  const link = urlM[0].replace(/[).,;]+$/, '');
  const ja = (await linhas('intProdutoPorLink', { link }))[0];
  if (ja) { await mensagem({ tipo: 'INFO', produtoId: Number(ja.ID), texto: 'Esse link já está em monitoramento: "' + ja.NOME + '".' }); return res; }
  let pg = await ler(link);
  let info = pg.ok ? paginaProduto(pg.body, null) : null;
  if (!info || !info.por) {
    const h = await ler(link, 'html');
    if (h.ok) { const i2 = paginaProduto(pg.ok ? pg.body : '', h.body); if (i2.por) info = i2; }
  }
  if (!info || !info.nome || !info.por) {
    await mensagem({ tipo: 'ERRO', texto: 'Não consegui ler o produto nesse link' + (pg.motivo ? ' (' + pg.motivo + ')' : '') + '. Confira se é a página de um produto e mande de novo, ou mande o link do mesmo produto em outra loja.' });
    return res;
  }
  const host = hostDe(link);
  const marca = info.marca || marcaDoHost(info.nome, host) || null;
  const codigo = 'P' + Date.now() + Math.floor(Math.random() * 1000);
  await sf('intInserirProduto', {
    codigo, nome: info.nome.slice(0, 300), marca: marca ? String(marca).slice(0, 80) : '', modelo: info.modelo ? String(info.modelo).slice(0, 80) : '', termo: '', caracteristicas: '',
    link: link.slice(0, 1000), loja: lojaDeHost(host), de: numTxt(info.de), por: numTxt(info.por), condicoes: info.condicoes ? info.condicoes.slice(0, 300) : '', printFonte: fontePrint(link) || '',
  });
  const prod = (await linhas('intProdutoPorCodigo', { codigo }))[0];
  const pid = Number(prod.ID);
  if (fontePrint(link)) await pedirPrint(fontePrint(link));
  await mensagem({
    tipo: 'CADASTRO', produtoId: pid, pergunta: 'SIMILARES',
    texto: 'Cadastrei "' + info.nome + '"' + (marca ? ' (marca ' + marca + (info.modelo ? ', modelo ' + info.modelo : '') + ')' : '') + ' da ' + lojaDeHost(host) + '. Preço "De" ' + brl(info.de) + ' e preço "Por" ' + brl(info.por) + (info.condicoes ? ' · ' + info.condicoes : '') + '. O preço de partida é ' + brl(info.por) + '. A partir de agora procuro esse produto de hora em hora nas lojas da lista e na busca aberta na web. Quer que eu busque também produtos similares de outras marcas?',
    dados: { produto: info.nome, produtoId: pid, loja: lojaDeHost(host), url: link, precoDe: info.de, precoPor: info.por, condicoes: info.condicoes, marca, modelo: info.modelo },
  });
  res.produtoId = pid;
  return res;
}
const mLoja = texto.match(/(?:adicion|acrescent|inclu|cadastr)\w*\s+(?:a\s+|uma\s+)?(?:loja|site)\s+(.+)/i);
if (mLoja) {
  const resto = mLoja[1].trim();
  const urlL = resto.match(/(?:https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(\/\S*)?/i);
  if (!urlL) { await mensagem({ tipo: 'ERRO', texto: 'Para acrescentar a loja, mande o nome e o site dela. Exemplo: "adicionar loja Cobasi cobasi.com.br".' }); return res; }
  const dominio = urlL[1].toLowerCase().replace(/^www\./, '');
  const nome = resto.replace(urlL[0], '').replace(/[,;:-]+/g, ' ').trim() || lojaDeHost(dominio);
  const busca = /\{q/.test(urlL[0]) ? (urlL[0].startsWith('http') ? urlL[0] : 'https://' + urlL[0]) : 'https://lite.duckduckgo.com/lite/?q=site:' + dominio + '+{q}';
  await sf('intAdicionarLoja', { nome: nome.slice(0, 120), dominio, urlBusca: busca });
  await mensagem({ tipo: 'INFO', texto: 'Acrescentei a loja ' + nome + ' (' + dominio + ') à lista fixa. Ela entra a partir da próxima rodada de cada produto.' });
  return res;
}
const mHora = nt.match(/(?:horario|lembrete|lembrar)[^0-9]{0,30}(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
if (mHora) {
  const h = Number(mHora[1]), mi = Number(mHora[2] || 0);
  if (h > 23 || mi > 59) { await mensagem({ tipo: 'ERRO', texto: 'Esse horário não existe. Exemplo: "lembrete às 20h".' }); return res; }
  const hora = String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
  await sf('intSalvarHorario', { hora });
  await mensagem({ tipo: 'INFO', texto: 'Horário do lembrete diário mudado para ' + hora + ' (horário de Brasília). O próximo lembrete já sai nesse horário.' });
  return res;
}
const mCanc = texto.match(/(?:cancel|parar de monitorar|encerr|remov)\w*\s+(?:o\s+|a\s+|monitoramento\s+(?:d[aeo]\s+)?)?(.{3,})/i);
if (mCanc) {
  const achados = await linhas('intBuscarProdutoNome', { nome: mCanc[1].trim().slice(0, 100) });
  if (achados.length === 1) {
    await sf('cancelarProduto', { produtoId: Number(achados[0].ID) });
    return res;
  }
  await mensagem({ tipo: 'INFO', texto: achados.length ? 'Achei mais de um produto com esse nome: ' + achados.map(a => '"' + a.NOME + '"').join(', ') + '. Use o botão Cancelar na tela Produtos para escolher.' : 'Não achei produto em monitoramento com esse nome. Veja a lista na tela Produtos.' });
  return res;
}
await mensagem({ tipo: 'INFO', texto: 'Posso: cadastrar um produto (mande o link da página dele), acrescentar uma loja ("adicionar loja Cobasi cobasi.com.br"), mudar o horário do lembrete ("lembrete às 20h") ou cancelar um monitoramento ("cancelar cafeteira"). Quando eu fizer uma pergunta, responda sim ou não.' });
return res;

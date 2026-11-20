import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Print from '../components/Print';
import BuscarAgora from '../components/BuscarAgora';
import { ToastContainer } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { ChartContainer, ShadcnLineChart, CHART_COLORS } from '../components/ui/Chart';
import { SkeletonCard, SkeletonTable } from '../components/ui/Skeleton';
import { linhas, linksDePrints, brl, pct, dataHora } from '../lib/api';
import { getMitraErrorMessage } from '../lib/utils';

interface ProdutoOpcao { ID: number; NOME: string; STATUS: string; }
interface Oferta {
  ID: number | null;
  LOJA_NOME: string;
  FONTE: string;
  TITULO: string;
  URL: string | null;
  TIPO: 'EXATO' | 'VARIACAO' | 'SIMILAR' | 'LINHA';
  VARIACAO: string | null;
  VENDEDOR: string | null;
  VENDEDOR_TERCEIRO: number;
  RECONDICIONADO: number;
  USADO: number;
  PRECO_DE: number | null;
  PRECO_POR: number;
  FRETE: number | null;
  FRETE_GRATIS_ACIMA: number | null;
  PRECO_COMPARADO: number;
  CONDICOES: string | null;
  DESCONTO: number | null;
  FAIXA: string | null;
  NO_CALCULO: number;
  TEM_PRINT: number;
  VALOR_MERCADO: number | null;
  INICIO: string;
  SITUACAO_LOJAS: string | null;
  FAIXAS_USADAS: string | null;
}
interface Ponto { ID: number; INICIO: string; VALOR_MERCADO: number | null; MENOR_PRECO: number | null; }
interface SituacaoLoja { loja: string; ok: boolean; motivo?: string; via?: string; achados?: number; }

function embalagemDe(titulo: string): string {
  const t = (titulo || '').toLowerCase();
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gramas|ml|l|litros?)\b/);
  if (!m) return 'sem tamanho no anúncio';
  let unidade = m[2];
  if (unidade === 'gr' || unidade === 'gramas') unidade = 'g';
  if (unidade.startsWith('litro')) unidade = 'l';
  const numero = m[1].replace('.', ',');
  const kit = t.match(/\b(?:kit|com|c\/)\s*(\d{1,2})\s*(?:un|unid|unidades|latas?|pacotes?|caixas?)?\b/);
  const qtd = kit && Number(kit[1]) > 1 && Number(kit[1]) !== Number(m[1]) ? ` (kit com ${kit[1]})` : '';
  return `${numero} ${unidade.toUpperCase() === 'L' ? 'L' : unidade}${qtd}`;
}

const TIPOS_FILTRO = [
  { value: 'todos', label: 'Todas as ofertas do produto' },
  { value: 'mercado', label: 'Só as do valor de mercado' },
  { value: 'mesma', label: 'Só o produto igual' },
  { value: 'variacao', label: 'Só as variações' },
];

const VENDEDOR_FILTRO = [
  { value: 'todos', label: 'Todos os vendedores' },
  { value: 'loja', label: 'Só a própria loja' },
  { value: 'terceiro', label: 'Só vendedor terceiro' },
];

function freteTexto(o: Oferta): string {
  if (o.FRETE_GRATIS_ACIMA != null && Number(o.PRECO_POR) > Number(o.FRETE_GRATIS_ACIMA)) return `grátis (acima de ${brl(o.FRETE_GRATIS_ACIMA)})`;
  if (o.FRETE == null) return 'não informado';
  return Number(o.FRETE) === 0 ? 'grátis' : brl(o.FRETE);
}

export default function Historico() {
  const { toasts, addToast, removeToast } = useToast();
  const [params, setParams] = useSearchParams();
  const [produtos, setProdutos] = useState<ProdutoOpcao[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [prints, setPrints] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const produtoId = params.get('produto') ?? '';
  const [filtroEmb, setFiltroEmb] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroVend, setFiltroVend] = useState('todos');

  useEffect(() => { setFiltroEmb(''); setFiltroTipo('todos'); setFiltroVend('todos'); }, [produtoId]);

  useEffect(() => {
    linhas<ProdutoOpcao>('telaProdutos', { status: 'TODOS', limite: 200, offset: 0 })
      .then(lista => {
        setProdutos(lista);
        if (!produtoId && lista[0]) setParams({ produto: String(lista[0].ID) }, { replace: true });
        if (!lista.length) setCarregando(false);
      })
      .catch(e => { setErro(getMitraErrorMessage(e)); setCarregando(false); });
  }, []);

  const carregar = useCallback(async () => {
    if (!produtoId) return;
    setCarregando(true);
    setErro('');
    try {
      const [o, g] = await Promise.all([
        linhas<Oferta>('telaUltimaRodada', { produtoId: Number(produtoId) }),
        linhas<Ponto>('telaGrafico', { produtoId: Number(produtoId) }),
      ]);
      setOfertas(o);
      setPontos(g);
      const comPrint = o.filter(x => x.ID && Number(x.TEM_PRINT) === 1).map(x => Number(x.ID));
      if (comPrint.length) linksDePrints(comPrint).then(setPrints).catch(() => undefined);
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setCarregando(false);
    }
  }, [produtoId]);

  useEffect(() => { carregar(); }, [carregar]);

  const rodada = ofertas[0];
  const lista = ofertas.filter(o => o.ID);
  const embalagens = useMemo(() => {
    const vistas = Array.from(new Set(lista.map(o => embalagemDe(o.TITULO))));
    return vistas.sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  }, [ofertas]);
  const naEmbalagem = (o: Oferta) => (!filtroEmb || embalagemDe(o.TITULO) === filtroEmb) && (
    filtroVend === 'todos'
    || (filtroVend === 'terceiro' && Number(o.VENDEDOR_TERCEIRO) === 1)
    || (filtroVend === 'loja' && Number(o.VENDEDOR_TERCEIRO) !== 1)
  );
  const doProduto = lista.filter(o => (o.TIPO === 'EXATO' || o.TIPO === 'VARIACAO') && naEmbalagem(o) && (
    filtroTipo === 'todos'
    || (filtroTipo === 'mercado' && Number(o.NO_CALCULO) === 1)
    || (filtroTipo === 'mesma' && o.TIPO === 'EXATO')
    || (filtroTipo === 'variacao' && o.TIPO === 'VARIACAO')
  ));
  const alternativas = lista.filter(o => o.TIPO === 'LINHA' && naEmbalagem(o));
  const similares = lista.filter(o => o.TIPO === 'SIMILAR' && naEmbalagem(o));
  const situacao = useMemo<SituacaoLoja[]>(() => {
    try { return rodada?.SITUACAO_LOJAS ? JSON.parse(rodada.SITUACAO_LOJAS) : []; } catch { return []; }
  }, [rodada]);
  const grafico = useMemo(() => [...pontos].reverse().map(p => ({
    name: dataHora(p.INICIO),
    menor: p.MENOR_PRECO != null ? Number(p.MENOR_PRECO) : null,
    mercado: p.VALOR_MERCADO != null ? Number(p.VALOR_MERCADO) : null,
  })), [pontos]);
  const menorHistorico = pontos.reduce<number | null>((m, p) => (p.MENOR_PRECO != null && (m == null || Number(p.MENOR_PRECO) < m) ? Number(p.MENOR_PRECO) : m), null);

  function tabela(itens: Oferta[], vazio: string) {
    return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr style={{ color: 'var(--fg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
            <th className="text-left font-medium px-4 py-2">Print</th>
            <th className="text-left font-medium px-4 py-2">Loja e anúncio</th>
            <th className="text-right font-medium px-4 py-2">Preço "Por"</th>
            <th className="text-right font-medium px-4 py-2">Frete</th>
            <th className="text-right font-medium px-4 py-2">Comparado</th>
            <th className="text-right font-medium px-4 py-2">Desconto</th>
          </tr>
        </thead>
        <tbody>
          {itens.map(o => (
            <tr key={o.ID} style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--fg)' }}>
              <td className="px-4 py-2 align-top">
                {(Number(o.NO_CALCULO) === 1 || o.TIPO === 'SIMILAR' || o.TIPO === 'LINHA') && <Print pequeno url={prints['o' + o.ID]} titulo={o.TITULO} />}
              </td>
              <td className="px-4 py-2 align-top max-w-md">
                <div className="font-medium">{o.LOJA_NOME}{o.FONTE && o.FONTE !== o.LOJA_NOME && <span className="font-normal" style={{ color: 'var(--fg-subtle)' }}> · via {o.FONTE}</span>}</div>
                <div className="truncate" style={{ color: 'var(--fg-muted)' }} title={o.TITULO}>
                  {o.URL ? <a href={o.URL} target="_blank" rel="noreferrer" className="hover:underline">{o.TITULO} <ExternalLink size={11} className="inline" /></a> : o.TITULO}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {o.FAIXA && <Badge variant="accent">{o.FAIXA}</Badge>}
                  {o.TIPO === 'SIMILAR' && <Badge variant="info">similar</Badge>}
                  {o.TIPO === 'LINHA' && <Badge variant="info">{o.VARIACAO || 'outra linha'}</Badge>}
                  <Badge variant="neutral">{embalagemDe(o.TITULO)}</Badge>
                  {o.TIPO === 'VARIACAO' && <Badge variant="neutral">variação{o.VARIACAO ? `: ${o.VARIACAO}` : ''}</Badge>}
                  {Number(o.VENDEDOR_TERCEIRO) === 1 && <Badge variant="warning">vendedor terceiro{o.VENDEDOR ? `: ${o.VENDEDOR}` : ''}</Badge>}
                  {Number(o.RECONDICIONADO) === 1 && <Badge variant="warning">recondicionado</Badge>}
                  {Number(o.USADO) === 1 && <Badge variant="danger">usado</Badge>}
                  {Number(o.NO_CALCULO) !== 1 && (o.TIPO === 'EXATO' || o.TIPO === 'VARIACAO') && <Badge variant="neutral">fora do valor de mercado</Badge>}
                </div>
                {o.CONDICOES && <div className="text-[12px] mt-1" style={{ color: 'var(--fg-subtle)' }}>{o.CONDICOES}</div>}
              </td>
              <td className="px-4 py-2 align-top text-right tabular-nums whitespace-nowrap">
                {brl(o.PRECO_POR)}
                {o.PRECO_DE != null && <div className="text-[12px] line-through" style={{ color: 'var(--fg-subtle)' }}>{brl(o.PRECO_DE)}</div>}
              </td>
              <td className="px-4 py-2 align-top text-right whitespace-nowrap" style={{ color: 'var(--fg-muted)' }}>{freteTexto(o)}</td>
              <td className="px-4 py-2 align-top text-right tabular-nums font-semibold whitespace-nowrap">{brl(o.PRECO_COMPARADO)}</td>
              <td className="px-4 py-2 align-top text-right tabular-nums whitespace-nowrap">{o.DESCONTO != null ? pct(o.DESCONTO) : '—'}</td>
            </tr>
          ))}
          {!itens.length && (
            <tr><td colSpan={6} className="px-4 py-6 text-center" style={{ color: 'var(--fg-muted)' }}>{vazio}</td></tr>
          )}
        </tbody>
      </table>
    </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: 'var(--fg)' }}>Histórico</h1>
          <p className="text-[13.5px]" style={{ color: 'var(--fg-muted)' }}>Preços por loja da última rodada e a evolução do preço.</p>
        </div>
        <div className="w-full sm:w-auto flex items-center gap-2">
        {produtoId && produtos.find(p => String(p.ID) === produtoId)?.STATUS === 'ATIVO' && (
          <BuscarAgora produtoId={Number(produtoId)} onAviso={addToast} />
        )}
        <div className="w-full sm:w-96">
          <Select
            options={produtos.map(p => ({ value: String(p.ID), label: p.NOME + (p.STATUS === 'ATIVO' ? '' : ' (encerrado)') }))}
            value={produtoId}
            onChange={v => setParams({ produto: v })}
            placeholder="Escolha um produto"
          />
        </div>
        </div>
      </div>

      {erro && <Card className="p-4 text-[13.5px]" style={{ color: 'var(--danger-text)' }}>{erro}</Card>}

      {!carregando && !produtos.length && !erro && (
        <Card className="p-8 text-center text-[14px]" style={{ color: 'var(--fg-muted)' }}>
          Nenhum produto monitorado ainda. Mande o link de um produto na Conversa.
        </Card>
      )}

      {carregando && produtos.length > 0 ? (
        <><SkeletonCard /><SkeletonTable rows={6} /></>
      ) : produtoId && !rodada && produtos.length > 0 ? (
        <Card className="p-8 text-center text-[14px]" style={{ color: 'var(--fg-muted)' }}>
          Este produto ainda não teve rodada de busca. A primeira começa em instantes.
        </Card>
      ) : rodada ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { r: 'Valor de mercado', v: brl(rodada.VALOR_MERCADO) },
              { r: 'Menor preço agora', v: brl(lista.filter(o => Number(o.NO_CALCULO) === 1).reduce<number | null>((m, o) => (m == null || Number(o.PRECO_COMPARADO) < m ? Number(o.PRECO_COMPARADO) : m), null)) },
              { r: 'Menor preço no histórico', v: brl(menorHistorico) },
              { r: 'Última rodada', v: dataHora(rodada.INICIO) },
            ].map(k => (
              <Card key={k.r} className="p-4">
                <div className="text-[11.5px] uppercase tracking-wide" style={{ color: 'var(--fg-subtle)' }}>{k.r}</div>
                <div className="text-[18px] font-semibold tabular-nums mt-1" style={{ color: 'var(--fg)' }}>{k.v}</div>
              </Card>
            ))}
          </div>

          <ChartContainer title="Histórico de preço" subtitle={`${pontos.length} rodadas · menor preço comparado e valor de mercado`}>
            {grafico.length > 1 ? (
              <ShadcnLineChart
                data={grafico}
                lines={[
                  { dataKey: 'menor', name: 'Menor preço', color: CHART_COLORS.teal },
                  { dataKey: 'mercado', name: 'Valor de mercado', color: CHART_COLORS.secondary, dashed: true },
                ]}
                formatter={v => brl(v)}
              />
            ) : (
              <p className="text-[13.5px] py-8 text-center" style={{ color: 'var(--fg-muted)' }}>O gráfico aparece a partir da segunda rodada.</p>
            )}
          </ChartContainer>

          <Card className="overflow-hidden">
            <div className="px-4 py-3 text-[14px] font-semibold" style={{ color: 'var(--fg)', borderBottom: '1px solid var(--border-subtle)' }}>
              Seu produto: preços por loja na última rodada
              {rodada.FAIXAS_USADAS && <span className="ml-2 text-[12px] font-normal" style={{ color: 'var(--fg-subtle)' }}>Faixas: {rodada.FAIXAS_USADAS}</span>}
            </div>
            <div className="px-4 py-3 flex flex-wrap gap-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="w-full sm:w-64">
                <Select
                  options={[{ value: '', label: 'Todas as embalagens' }, ...embalagens.map(e => ({ value: e, label: e }))]}
                  value={filtroEmb}
                  onChange={setFiltroEmb}
                  placeholder="Embalagem"
                />
              </div>
              <div className="w-full sm:w-64">
                <Select options={TIPOS_FILTRO} value={filtroTipo} onChange={setFiltroTipo} placeholder="Quais ofertas" />
              </div>
              <div className="w-full sm:w-64">
                <Select options={VENDEDOR_FILTRO} value={filtroVend} onChange={setFiltroVend} placeholder="Vendedor" />
              </div>
            </div>
            {tabela(doProduto, filtroEmb || filtroTipo !== 'todos' || filtroVend !== 'todos' ? 'Nenhuma oferta com esses filtros.' : 'Nenhuma oferta do seu produto na última rodada.')}
          </Card>

          {alternativas.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 text-[14px] font-semibold" style={{ color: 'var(--fg)', borderBottom: '1px solid var(--border-subtle)' }}>
                Alternativas da mesma marca
                <span className="ml-2 text-[12px] font-normal" style={{ color: 'var(--fg-subtle)' }}>Outra linha do produto: só para comparar, fora do valor de mercado e dos avisos.</span>
              </div>
              {tabela(alternativas, 'Nenhuma alternativa na última rodada.')}
            </Card>
          )}

          {similares.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 text-[14px] font-semibold" style={{ color: 'var(--fg)', borderBottom: '1px solid var(--border-subtle)' }}>
                Similares de outras marcas
                <span className="ml-2 text-[12px] font-normal" style={{ color: 'var(--fg-subtle)' }}>Só para comparar: não entram no valor de mercado nem nos avisos.</span>
              </div>
              {tabela(similares, 'Nenhum similar na última rodada.')}
            </Card>
          )}

          {situacao.length > 0 && (
            <Card className="p-4">
              <div className="text-[14px] font-semibold mb-2" style={{ color: 'var(--fg)' }}>Lojas consultadas na rodada</div>
              <div className="flex flex-wrap gap-2">
                {situacao.map(s => (
                  <span key={s.loja} title={s.motivo ? s.motivo + (s.via ? ` · tentei também pela ${s.via}` : '') : undefined}>
                    <Badge variant={s.ok ? 'success' : 'neutral'} dot>
                      {s.loja}{s.ok ? ` · ${s.achados ?? 0}` : ` · ${s.motivo ?? 'sem acesso'}`}
                    </Badge>
                  </span>
                ))}
              </div>
            </Card>
          )}
        </>
      ) : null}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

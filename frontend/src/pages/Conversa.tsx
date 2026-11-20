import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, ExternalLink, Bot, Check, X, RefreshCw } from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Print from '../components/Print';
import BuscarAgora from '../components/BuscarAgora';
import { ToastContainer } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { SkeletonListItems } from '../components/ui/Skeleton';
import { chamar, linhas, linksDePrints, brl, pct, dataHora, data } from '../lib/api';
import { getMitraErrorMessage } from '../lib/utils';

interface Mensagem {
  ID: number;
  CRIADO_EM: string;
  AUTOR: 'USUARIO' | 'ASSISTENTE';
  TIPO: string;
  PRODUTO_ID: number | null;
  OFERTA_ID: number | null;
  TEXTO: string;
  DADOS: string | null;
  PERGUNTA: string | null;
  RESPOSTA: string | null;
  PRODUTO_NOME: string | null;
}

interface Dados {
  produto?: string;
  loja?: string;
  fonte?: string | null;
  url?: string;
  titulo?: string;
  faixa?: string;
  desconto?: number;
  precoDe?: number | null;
  precoPor?: number;
  frete?: number | null;
  freteGratisAcima?: number | null;
  comparado?: number;
  condicoes?: string | null;
  valorMercado?: number | null;
  lojasNoCalculo?: number;
  marcas?: string[];
  precoAnterior?: number;
  faixaAnterior?: string;
  mudouFaixa?: boolean;
  historico?: { menor: number | null; maior: number | null; rodadas: number; desde: string | null };
  similares?: { ofertaId?: number; titulo: string; loja: string; comparado: number; url?: string; marcas: string[] }[];
}

const PAGINA = 30;
const TITULO_TIPO: Record<string, string> = {
  OFERTA: 'Nova oportunidade',
  QUEDA: 'Aviso imediato',
  LEMBRETE: 'Lembrete diário',
  PERDIDA: 'Oportunidade perdida',
  CADASTRO: 'Produto cadastrado',
  FIM: 'Monitoramento encerrado',
};

function lerDados(m: Mensagem): Dados | null {
  if (!m.DADOS) return null;
  try { return JSON.parse(m.DADOS) as Dados; } catch { return null; }
}

function varianteFaixa(faixa?: string): 'success' | 'accent' | 'info' {
  const f = (faixa || '').toLowerCase();
  if (f.includes('imperd')) return 'success';
  if (f.includes('tima')) return 'accent';
  return 'info';
}

function textoFrete(d: Dados): string {
  if (d.freteGratisAcima != null && (d.precoPor ?? 0) > d.freteGratisAcima) return `Grátis (acima de ${brl(d.freteGratisAcima)})`;
  if (d.frete == null) return 'Não informado na página';
  if (d.frete === 0) return 'Grátis';
  return brl(d.frete);
}

function CartaoOferta({ m, d, print, printsSim }: { m: Mensagem; d: Dados; print?: string; printsSim: Record<string, string> }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {d.faixa && <Badge variant={varianteFaixa(d.faixa)} dot>{d.faixa}</Badge>}
        {d.desconto != null && <span className="text-[13px] font-medium" style={{ color: 'var(--fg)' }}>{pct(d.desconto)} abaixo do mercado</span>}
        {(d.marcas || []).map(x => <Badge key={x} variant="warning">{x}</Badge>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>
            {d.loja}{d.fonte ? ` · encontrado via ${d.fonte}` : ''}
          </div>
          {d.titulo && <div className="text-[13px] truncate" style={{ color: 'var(--fg-subtle)' }} title={d.titulo}>{d.titulo}</div>}
          {m.TIPO === 'QUEDA' && d.precoAnterior != null && (
            <div className="text-[14px]" style={{ color: 'var(--fg)' }}>
              Preço anterior <s>{brl(d.precoAnterior)}</s> → novo <strong>{brl(d.comparado)}</strong>
              {d.mudouFaixa && d.faixaAnterior ? ` · subiu de ${d.faixaAnterior} para ${d.faixa}` : ''}
            </div>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
            <dt style={{ color: 'var(--fg-subtle)' }}>Preço "Por"</dt><dd className="text-right font-medium tabular-nums" style={{ color: 'var(--fg)' }}>{brl(d.precoPor)}</dd>
            {d.precoDe != null && <><dt style={{ color: 'var(--fg-subtle)' }}>Preço "De" (só informação)</dt><dd className="text-right tabular-nums" style={{ color: 'var(--fg-subtle)' }}><s>{brl(d.precoDe)}</s></dd></>}
            <dt style={{ color: 'var(--fg-subtle)' }}>Frete</dt><dd className="text-right tabular-nums" style={{ color: 'var(--fg)' }}>{textoFrete(d)}</dd>
            <dt style={{ color: 'var(--fg-subtle)' }}>Preço comparado</dt><dd className="text-right font-medium tabular-nums" style={{ color: 'var(--fg)' }}>{brl(d.comparado)}</dd>
            <dt style={{ color: 'var(--fg-subtle)' }}>Valor de mercado</dt><dd className="text-right tabular-nums" style={{ color: 'var(--fg)' }}>{brl(d.valorMercado)}{d.lojasNoCalculo ? ` (${d.lojasNoCalculo} lojas)` : ''}</dd>
            <dt style={{ color: 'var(--fg-subtle)' }}>Condições</dt><dd className="text-right" style={{ color: 'var(--fg)' }}>{d.condicoes || 'Não informadas'}</dd>
            {d.historico && (
              <>
                <dt style={{ color: 'var(--fg-subtle)' }}>Histórico</dt>
                <dd className="text-right" style={{ color: 'var(--fg)' }}>
                  {d.historico.rodadas > 0
                    ? `menor ${brl(d.historico.menor)} · maior ${brl(d.historico.maior)} desde ${data(d.historico.desde)}`
                    : 'primeira rodada'}
                </dd>
              </>
            )}
          </dl>
          {d.url && (
            <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium w-fit" style={{ color: 'var(--accent)' }}>
              Abrir na loja <ExternalLink size={13} />
            </a>
          )}
        </div>
        <Print url={print} titulo={`${d.loja ?? ''} — ${d.produto ?? ''}`} />
      </div>
      {d.similares && d.similares.length > 0 && (
        <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="text-[12.5px] font-medium" style={{ color: 'var(--fg-muted)' }}>Similares de outras marcas nesta rodada</div>
          {d.similares.map((s, i) => (
            <div key={i} className="flex items-center gap-3 text-[13px]">
              <Print url={s.ofertaId ? printsSim['o' + s.ofertaId] : undefined} titulo={s.titulo} pequeno />
              <div className="min-w-0 flex-1">
                <div className="truncate" style={{ color: 'var(--fg)' }} title={s.titulo}>{s.titulo}</div>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5" style={{ color: 'var(--fg-subtle)' }}>
                  {s.loja} · {brl(s.comparado)}
                  {s.marcas.map(x => <Badge key={x} variant={x === 'similar' ? 'neutral' : 'warning'}>{x}</Badge>)}
                </div>
              </div>
              {s.url && <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--fg-subtle)' }} title="Abrir na loja"><ExternalLink size={14} /></a>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Bolha({ m, prints, onResponder, respondendo }: { m: Mensagem; prints: Record<string, string>; onResponder: (m: Mensagem, r: 'SIM' | 'NAO') => void; respondendo: number | null }) {
  const usuario = m.AUTOR === 'USUARIO';
  const d = lerDados(m);
  const ehOferta = ['OFERTA', 'QUEDA', 'LEMBRETE'].includes(m.TIPO) && d;
  const titulo = TITULO_TIPO[m.TIPO];
  if (usuario) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] break-words" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}>
          {m.TEXTO}
          <div className="text-[11px] mt-1 opacity-75 text-right">{dataHora(m.CRIADO_EM)}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>
        <Bot size={16} />
      </div>
      <div className="cartao flex-1 min-w-0 max-w-3xl px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13px] font-medium" style={{ color: m.TIPO === 'PERDIDA' || m.TIPO === 'ERRO' ? 'var(--danger-text)' : 'var(--fg)' }}>
            {titulo ? `${titulo}${d?.produto ? ' · ' + d.produto : m.PRODUTO_NOME ? ' · ' + m.PRODUTO_NOME : ''}` : 'Assistente'}
          </div>
          <div className="text-[11.5px] shrink-0" style={{ color: 'var(--fg-subtle)' }}>{dataHora(m.CRIADO_EM)}</div>
        </div>
        {ehOferta ? <CartaoOferta m={m} d={d!} print={m.OFERTA_ID ? prints['o' + m.OFERTA_ID] : undefined} printsSim={prints} /> : (
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--fg)' }}>{m.TEXTO}</p>
        )}
        {m.TIPO === 'CADASTRO' && m.PRODUTO_ID && (
          <div className="max-w-xs"><Print url={prints['p' + m.PRODUTO_ID]} titulo={`Página de origem — ${d?.produto ?? ''}`} /></div>
        )}
        {m.PERGUNTA && (
          m.RESPOSTA ? (
            <div className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>Respondido: {m.RESPOSTA === 'SIM' ? 'sim' : 'não'}</div>
          ) : (
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => onResponder(m, 'SIM')} disabled={respondendo != null}>
                <Check size={14} /> Sim
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onResponder(m, 'NAO')} disabled={respondendo != null}>
                <X size={14} /> Não
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function Conversa() {
  const { toasts, addToast, removeToast } = useToast();
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [temMais, setTemMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [respondendo, setRespondendo] = useState<number | null>(null);
  const [prints, setPrints] = useState<Record<string, string>>({});
  const fimRef = useRef<HTMLDivElement>(null);
  const ultimoId = useMemo(() => msgs.reduce((a, m) => Math.max(a, m.ID), 0), [msgs]);

  const carregarPrints = useCallback(async (lista: Mensagem[]) => {
    const ofertas: number[] = [];
    const produtos: number[] = [];
    for (const m of lista) {
      if (m.OFERTA_ID && ['OFERTA', 'QUEDA', 'LEMBRETE'].includes(m.TIPO)) ofertas.push(m.OFERTA_ID);
      if (m.TIPO === 'CADASTRO' && m.PRODUTO_ID) produtos.push(m.PRODUTO_ID);
      const d = lerDados(m);
      for (const s of d?.similares ?? []) if (s.ofertaId) ofertas.push(s.ofertaId);
    }
    if (!ofertas.length && !produtos.length) return;
    try {
      const l = await linksDePrints(ofertas, produtos);
      setPrints(p => ({ ...p, ...l }));
    } catch { /* prints são complemento */ }
  }, []);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const rows = await linhas<Mensagem>('telaConversa', { antesDe: 0, depoisDe: 0, limite: PAGINA });
      setMsgs(rows.slice().reverse());
      setTemMais(rows.length === PAGINA);
      carregarPrints(rows);
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setCarregando(false);
    }
  }, [carregarPrints]);

  const novas = useCallback(async () => {
    try {
      const rows = await linhas<Mensagem>('telaConversa', { antesDe: 0, depoisDe: ultimoId, limite: PAGINA });
      if (rows.length) {
        setMsgs(prev => [...prev, ...rows.slice().reverse().filter(r => !prev.some(p => p.ID === r.ID))]);
        carregarPrints(rows);
      }
    } catch { /* tenta de novo na próxima atualização */ }
  }, [ultimoId, carregarPrints]);

  const anteriores = async () => {
    const primeiro = msgs[0]?.ID;
    if (!primeiro) return;
    try {
      const rows = await linhas<Mensagem>('telaConversa', { antesDe: primeiro, depoisDe: 0, limite: PAGINA });
      setMsgs(prev => [...rows.slice().reverse(), ...prev]);
      setTemMais(rows.length === PAGINA);
      carregarPrints(rows);
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    }
  };

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') novas(); }, 60000);
    return () => clearInterval(t);
  }, [novas]);

  useEffect(() => { fimRef.current?.scrollIntoView({ block: 'end' }); }, [ultimoId]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await chamar('enviarMensagem', { texto: t });
      setTexto('');
      await novas();
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setEnviando(false);
    }
  };

  const responder = async (m: Mensagem, r: 'SIM' | 'NAO') => {
    setRespondendo(m.ID);
    setErro(null);
    try {
      await chamar('enviarMensagem', { mensagemId: m.ID, resposta: r });
      setMsgs(prev => prev.map(x => (x.ID === m.ID ? { ...x, RESPOSTA: r } : x)));
      await novas();
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setRespondendo(null);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="px-6 py-4 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <h1 className="text-[18px] font-semibold" style={{ color: 'var(--fg)' }}>Conversa</h1>
          <p className="text-[13px]" style={{ color: 'var(--fg-subtle)' }}>Mande o link de um produto para monitorar. Os avisos de preço chegam aqui.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={novas} title="Buscar mensagens novas"><RefreshCw size={14} /> Atualizar</Button>
          <BuscarAgora onAviso={(tipo, texto) => { addToast(tipo, texto); setTimeout(novas, 1500); }} />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          {carregando ? <SkeletonListItems count={4} height={72} /> : (
            <>
              {temMais && <Button variant="ghost" size="sm" className="self-center" onClick={anteriores}>Ver mensagens anteriores</Button>}
              {msgs.length === 0 && (
                <div className="cartao px-5 py-6 text-[14px]" style={{ color: 'var(--fg-muted)' }}>
                  Olá! Mande aqui o link da página de um produto que você quer comprar. Eu leio o nome e os preços, procuro o produto de hora em hora nas lojas e aviso quando aparecer uma boa oportunidade.
                </div>
              )}
              {msgs.map(m => <Bolha key={m.ID} m={m} prints={prints} onResponder={responder} respondendo={respondendo} />)}
              {enviando && <div className="text-[13px] pl-11" style={{ color: 'var(--fg-subtle)' }}>Lendo a página…</div>}
            </>
          )}
          <div ref={fimRef} />
        </div>
      </div>
      <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
        {erro && <div className="max-w-4xl mx-auto mb-2 text-[13px]" style={{ color: 'var(--danger-text)' }}>{erro}</div>}
        <form className="max-w-4xl mx-auto flex items-end gap-2" onSubmit={e => { e.preventDefault(); enviar(); }}>
          <input
            className="controle flex-1"
            placeholder="Cole o link do produto, ou responda sim / não…"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            maxLength={2000}
            disabled={enviando}
            aria-label="Mensagem"
          />
          <Button type="submit" disabled={enviando || !texto.trim()}><Send size={15} /> Enviar</Button>
        </form>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

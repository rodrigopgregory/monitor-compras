import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownRight, ExternalLink, LineChart } from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Select from '../components/ui/Select';
import Print from '../components/Print';
import BuscarAgora from '../components/BuscarAgora';
import { SkeletonListItems } from '../components/ui/Skeleton';
import { ToastContainer } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { linhas, linksDePrints, brl, pct, dataHora } from '../lib/api';
import { getMitraErrorMessage } from '../lib/utils';

interface Notificacao {
  RODADA_ID: number;
  PRODUTO_ID: number;
  NOME: string;
  STATUS: string;
  INICIO: string;
  VALOR_MERCADO: number | null;
  LOJAS_NO_CALCULO: number | null;
  MENOR: number;
  ANTERIOR: number;
  PRIMEIRA: number;
  OFERTA_ID: number;
  LOJA_NOME: string;
  FONTE: string | null;
  URL: string | null;
  FAIXA: string | null;
  DESCONTO: number | null;
  VENDEDOR: string | null;
  VENDEDOR_TERCEIRO: number;
  RECONDICIONADO: number;
  TIPO: string;
  VARIACAO: string | null;
  PRECO_POR: number;
  PRECO_DE: number | null;
  CONDICOES: string | null;
  TEM_PRINT: number;
  TOTAL: number;
}
interface ProdutoOpcao { ID: number; NOME: string; }

const POR_PAGINA = 20;

export default function Notificacoes() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [produtos, setProdutos] = useState<ProdutoOpcao[]>([]);
  const [produtoId, setProdutoId] = useState('0');
  const [pagina, setPagina] = useState(0);
  const [lista, setLista] = useState<Notificacao[]>([]);
  const [prints, setPrints] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    linhas<ProdutoOpcao>('telaProdutos', { status: 'TODOS', limite: 200, offset: 0 }).then(setProdutos).catch(() => undefined);
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const rows = await linhas<Notificacao>('telaNotificacoes', { produtoId: Number(produtoId), limite: POR_PAGINA, offset: pagina * POR_PAGINA });
      setLista(rows);
      const ids = rows.filter(r => Number(r.TEM_PRINT) === 1).map(r => Number(r.OFERTA_ID));
      if (ids.length) linksDePrints(ids).then(setPrints).catch(() => undefined);
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setCarregando(false);
    }
  }, [produtoId, pagina]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible' && pagina === 0) carregar(); }, 120000);
    return () => clearInterval(t);
  }, [carregar, pagina]);

  const total = lista[0]?.TOTAL ? Number(lista[0].TOTAL) : 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: 'var(--fg)' }}>Notificações</h1>
          <p className="text-[13.5px]" style={{ color: 'var(--fg-muted)' }}>
            Cada rodada em que o menor preço ficou abaixo da rodada anterior. Na primeira rodada, a comparação é com o preço do cadastro.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-72">
            <Select
              options={[{ value: '0', label: 'Todos os produtos' }, ...produtos.map(p => ({ value: String(p.ID), label: p.NOME }))]}
              value={produtoId}
              onChange={v => { setProdutoId(v); setPagina(0); }}
            />
          </div>
          <BuscarAgora onAviso={addToast} />
        </div>
      </div>

      {erro && (
        <Card className="p-4 text-[13.5px]" style={{ color: 'var(--danger-text)' }}>
          {erro} <Button variant="ghost" size="sm" onClick={carregar}>Tentar de novo</Button>
        </Card>
      )}

      {carregando ? (
        <SkeletonListItems count={4} height={96} />
      ) : !lista.length && !erro ? (
        <Card className="p-8 text-center text-[14px]" style={{ color: 'var(--fg-muted)' }}>
          Nenhuma rodada achou preço melhor ainda. As notificações aparecem aqui quando o menor preço cair.
        </Card>
      ) : (
        <div className="space-y-3">
          {lista.map(n => {
            const queda = Number(n.ANTERIOR) - Number(n.MENOR);
            const quedaPct = Number(n.ANTERIOR) > 0 ? (queda / Number(n.ANTERIOR)) * 100 : null;
            return (
              <Card key={n.RODADA_ID} className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {Number(n.TEM_PRINT) === 1 && <Print pequeno url={prints['o' + n.OFERTA_ID]} titulo={n.NOME} />}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-semibold text-[15px] leading-snug break-words" style={{ color: 'var(--fg)' }}>{n.NOME}</h3>
                      <span className="text-[12.5px] whitespace-nowrap" style={{ color: 'var(--fg-subtle)' }}>{dataHora(n.INICIO)}</span>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1 text-[18px] font-semibold tabular-nums" style={{ color: 'var(--success-text)' }}>
                        <ArrowDownRight size={16} /> {brl(n.MENOR)}
                      </span>
                      <span className="text-[13px] line-through tabular-nums" style={{ color: 'var(--fg-subtle)' }}>{brl(n.ANTERIOR)}</span>
                      <span className="text-[13px] tabular-nums" style={{ color: 'var(--fg-muted)' }}>
                        {brl(queda)} a menos{quedaPct != null ? ` (${pct(quedaPct)})` : ''} · {Number(n.PRIMEIRA) === 1 ? 'em relação ao preço do cadastro' : 'em relação à rodada anterior'}
                      </span>
                    </div>
                    <div className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>
                      {n.LOJA_NOME}{n.FONTE && n.FONTE !== n.LOJA_NOME ? ` · via ${n.FONTE}` : ''}{n.VENDEDOR ? ` · vendido por ${n.VENDEDOR}` : ''}
                      {' · '}valor de mercado {brl(n.VALOR_MERCADO)}{n.DESCONTO != null ? ` (${pct(n.DESCONTO)} abaixo)` : ''}
                      {n.CONDICOES ? ` · ${n.CONDICOES}` : ''}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {n.FAIXA && <Badge variant="accent">{n.FAIXA}</Badge>}
                      {n.TIPO === 'VARIACAO' && <Badge variant="neutral">variação{n.VARIACAO ? `: ${n.VARIACAO}` : ''}</Badge>}
                      {Number(n.VENDEDOR_TERCEIRO) === 1 && <Badge variant="warning">vendedor terceiro</Badge>}
                      {Number(n.RECONDICIONADO) === 1 && <Badge variant="warning">recondicionado</Badge>}
                      {n.STATUS !== 'ATIVO' && <Badge variant="neutral">monitoramento encerrado</Badge>}
                      <span className="flex-1" />
                      {n.URL && (
                        <a href={n.URL} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="sm"><ExternalLink size={14} /> Ver na loja</Button>
                        </a>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => navigate(`/historico?produto=${n.PRODUTO_ID}`)}><LineChart size={14} /> Histórico</Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          {paginas > 1 && (
            <div className="flex items-center justify-end gap-2 text-[13px]" style={{ color: 'var(--fg-muted)' }}>
              <span>Página {pagina + 1} de {paginas} · {total} notificações</span>
              <Button variant="secondary" size="sm" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
              <Button variant="secondary" size="sm" disabled={pagina + 1 >= paginas} onClick={() => setPagina(pagina + 1)}>Próxima</Button>
            </div>
          )}
        </div>
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

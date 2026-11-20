import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, LineChart, Pencil, XCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import BuscarAgora from '../components/BuscarAgora';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Checkbox from '../components/ui/Checkbox';
import DatePicker from '../components/ui/DatePicker';
import Input from '../components/ui/Input';
import { SkeletonListItems } from '../components/ui/Skeleton';
import { ToastContainer } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { chamar, linhas, brl, data, dataHora } from '../lib/api';
import { getMitraErrorMessage } from '../lib/utils';

interface Produto {
  ID: number;
  NOME: string;
  MARCA: string | null;
  MODELO: string | null;
  TERMO_BUSCA: string | null;
  CARACTERISTICAS: string | null;
  LINK_ORIGEM: string;
  LOJA_ORIGEM: string | null;
  PRECO_DE_ORIGEM: number | null;
  PRECO_POR_ORIGEM: number | null;
  BUSCA_SIMILARES: number;
  INCLUIR_USADOS: number;
  DATA_FIM: string | null;
  STATUS: 'ATIVO' | 'ENCERRADO';
  MOTIVO_FIM: string | null;
  ULTIMA_RODADA_EM: string | null;
  VALOR_MERCADO: number | null;
  MELHOR_PRECO: number | null;
  OFERTA_ATIVA: number | null;
  FAIXA_ATUAL: string | null;
  TOTAL: number;
}

interface Edicao {
  buscaSimilares: boolean;
  incluirUsados: boolean;
  dataFim: string;
  marca: string;
  modelo: string;
  termo: string;
  caracteristicas: string;
}

const POR_PAGINA = 20;
const FILTROS = [
  { v: 'ATIVO', l: 'Em monitoramento' },
  { v: 'ENCERRADO', l: 'Encerrados' },
  { v: 'TODOS', l: 'Todos' },
] as const;

export default function Produtos() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [status, setStatus] = useState<'ATIVO' | 'ENCERRADO' | 'TODOS'>('ATIVO');
  const [pagina, setPagina] = useState(0);
  const [lista, setLista] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState<Produto | null>(null);
  const [form, setForm] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [cancelando, setCancelando] = useState<Produto | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setLista(await linhas<Produto>('telaProdutos', { status, limite: POR_PAGINA, offset: pagina * POR_PAGINA }));
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setCarregando(false);
    }
  }, [status, pagina]);

  useEffect(() => { carregar(); }, [carregar]);

  const total = lista[0]?.TOTAL ? Number(lista[0].TOTAL) : 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  function abrirEdicao(p: Produto) {
    setEditando(p);
    setForm({
      buscaSimilares: Number(p.BUSCA_SIMILARES) === 1,
      incluirUsados: Number(p.INCLUIR_USADOS) === 1,
      dataFim: p.DATA_FIM ? p.DATA_FIM.slice(0, 10) : '',
      marca: p.MARCA ?? '',
      modelo: p.MODELO ?? '',
      termo: p.TERMO_BUSCA ?? '',
      caracteristicas: p.CARACTERISTICAS ?? '',
    });
  }

  async function salvar() {
    if (!editando || !form) return;
    setSalvando(true);
    try {
      await chamar('salvarProduto', {
        produtoId: editando.ID,
        buscaSimilares: form.buscaSimilares ? 1 : 0,
        incluirUsados: form.incluirUsados ? 1 : 0,
        dataFim: form.dataFim,
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        termo: form.termo.trim(),
        caracteristicas: form.caracteristicas.trim(),
      });
      addToast('success', 'Opções do produto salvas. Valem a partir da próxima rodada.');
      setEditando(null);
      carregar();
    } catch (e) {
      addToast('error', getMitraErrorMessage(e));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarCancelamento() {
    if (!cancelando) return;
    setSalvando(true);
    try {
      await chamar('cancelarProduto', { produtoId: cancelando.ID });
      addToast('success', `"${cancelando.NOME}" saiu do monitoramento.`);
      setCancelando(null);
      carregar();
    } catch (e) {
      addToast('error', getMitraErrorMessage(e));
    } finally {
      setSalvando(false);
    }
  }

  const campo = (k: keyof Edicao, v: string | boolean) => setForm(f => (f ? { ...f, [k]: v } : f));

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: 'var(--fg)' }}>Produtos</h1>
          <p className="text-[13.5px]" style={{ color: 'var(--fg-muted)' }}>
            Para cadastrar um produto, mande o link dele na Conversa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <BuscarAgora variant="primary" onAviso={addToast} />
        <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: 'var(--surface-muted)' }}>
          {FILTROS.map(f => (
            <button
              key={f.v}
              type="button"
              onClick={() => { setStatus(f.v); setPagina(0); }}
              className="h-8 px-3 rounded-[10px] text-[13px] font-medium transition-colors"
              style={status === f.v
                ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--fg)', boxShadow: 'var(--shadow-sm)' }
                : { color: 'var(--fg-muted)' }}
            >
              {f.l}
            </button>
          ))}
        </div>
        </div>
      </div>

      {erro && (
        <Card className="p-4 text-[13.5px]" style={{ color: 'var(--danger-text)' }}>
          {erro} <Button variant="ghost" size="sm" onClick={carregar}>Tentar de novo</Button>
        </Card>
      )}

      {carregando ? (
        <SkeletonListItems count={4} />
      ) : lista.length === 0 && !erro ? (
        <Card className="p-8 text-center text-[14px]" style={{ color: 'var(--fg-muted)' }}>
          Nenhum produto aqui. Mande o link de um produto na Conversa para começar a monitorar.
        </Card>
      ) : (
        <div className="space-y-3">
          {lista.map(p => (
            <Card key={p.ID} className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <h3 className="font-semibold text-[15px] leading-snug break-words" style={{ color: 'var(--fg)' }} title={p.NOME}>{p.NOME}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {p.STATUS === 'ATIVO'
                      ? <Badge variant="success" dot>Em monitoramento</Badge>
                      : <Badge variant="neutral">Encerrado{p.MOTIVO_FIM ? ` · ${p.MOTIVO_FIM}` : ''}</Badge>}
                    {Number(p.OFERTA_ATIVA) === 1 && p.FAIXA_ATUAL && <Badge variant="accent">{p.FAIXA_ATUAL}</Badge>}
                    {Number(p.BUSCA_SIMILARES) === 1 && <Badge variant="info">similares</Badge>}
                    {Number(p.INCLUIR_USADOS) === 1 && <Badge variant="warning">inclui usados</Badge>}
                  </div>
                  <div className="text-[12.5px] flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'var(--fg-muted)' }}>
                    {(p.MARCA || p.MODELO) && <span>{[p.MARCA, p.MODELO].filter(Boolean).join(' · ')}</span>}
                    <span>Cadastro: {brl(p.PRECO_POR_ORIGEM)}{p.PRECO_DE_ORIGEM ? ` (De ${brl(p.PRECO_DE_ORIGEM)})` : ''} na {p.LOJA_ORIGEM ?? 'loja'}</span>
                    <span>Data de fim: {p.DATA_FIM ? data(p.DATA_FIM) : 'sem data'}</span>
                    <span>Última rodada: {dataHora(p.ULTIMA_RODADA_EM)}</span>
                  </div>
                </div>
                <div className="flex gap-6 lg:text-right shrink-0">
                  <div>
                    <div className="text-[11.5px] uppercase tracking-wide" style={{ color: 'var(--fg-subtle)' }}>Valor de mercado</div>
                    <div className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--fg)' }}>{brl(p.VALOR_MERCADO)}</div>
                  </div>
                  <div>
                    <div className="text-[11.5px] uppercase tracking-wide" style={{ color: 'var(--fg-subtle)' }}>Menor preço</div>
                    <div className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>{brl(p.MELHOR_PRECO)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:shrink-0 lg:max-w-[360px] lg:justify-end">
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/historico?produto=${p.ID}`)}><LineChart size={14} /> Histórico</Button>
                  <a href={p.LINK_ORIGEM} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="sm"><ExternalLink size={14} /> Link</Button>
                  </a>
                  {p.STATUS === 'ATIVO' && (
                    <>
                      <BuscarAgora produtoId={p.ID} variant="secondary" onAviso={addToast} />
                      <Button variant="secondary" size="sm" onClick={() => abrirEdicao(p)}><Pencil size={14} /> Opções</Button>
                      <Button variant="ghost" size="sm" onClick={() => setCancelando(p)}><XCircle size={14} /> Cancelar</Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {paginas > 1 && (
            <div className="flex items-center justify-end gap-2 text-[13px]" style={{ color: 'var(--fg-muted)' }}>
              <span>Página {pagina + 1} de {paginas} · {total} produtos</span>
              <Button variant="secondary" size="sm" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
              <Button variant="secondary" size="sm" disabled={pagina + 1 >= paginas} onClick={() => setPagina(pagina + 1)}>Próxima</Button>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={!!editando} onClose={() => setEditando(null)} title="Opções do monitoramento" size="lg">
        {form && editando && (
          <div className="space-y-4">
            <p className="text-[13.5px] font-medium" style={{ color: 'var(--fg)' }}>{editando.NOME}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Checkbox label="Buscar similares de outras marcas (até 3 por rodada)" checked={form.buscaSimilares} onChange={v => campo('buscaSimilares', v)} />
              <Checkbox label="Incluir produtos usados" checked={form.incluirUsados} onChange={v => campo('incluirUsados', v)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3 items-end">
              <DatePicker label="Data de fim (opcional)" value={form.dataFim} onChange={v => campo('dataFim', v)} />
              {form.dataFim && <Button variant="ghost" size="sm" onClick={() => campo('dataFim', '')}>Sem data de fim</Button>}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Marca" value={form.marca} onChange={e => campo('marca', e.target.value)} maxLength={80} />
              <Input label="Modelo" value={form.modelo} onChange={e => campo('modelo', e.target.value)} maxLength={80} />
            </div>
            <Input label="Termo de busca (em branco usa marca, modelo e nome)" value={form.termo} onChange={e => campo('termo', e.target.value)} maxLength={200} />
            <Input label="Características para os similares (ex.: superautomática com moedor)" value={form.caracteristicas} onChange={e => campo('caracteristicas', e.target.value)} maxLength={300} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditando(null)}>Fechar</Button>
              <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!cancelando}
        onClose={() => setCancelando(null)}
        onConfirm={confirmarCancelamento}
        title="Cancelar monitoramento"
        message={`"${cancelando?.NOME ?? ''}" deixa de ser buscado e não gera mais avisos. O histórico já registrado fica guardado.`}
        confirmLabel="Cancelar monitoramento"
        loading={salvando}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

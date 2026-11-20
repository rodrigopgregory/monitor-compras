import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Checkbox from '../components/ui/Checkbox';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { SkeletonCard } from '../components/ui/Skeleton';
import ExportarApp from '../components/ExportarApp';
import { ToastContainer } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { chamar, linhas } from '../lib/api';
import { getMitraErrorMessage } from '../lib/utils';

interface Linha {
  GRUPO: 'FAIXA' | 'CONFIG' | 'LOJA';
  ID: number;
  NOME: string;
  VALOR: string | null;
  ORDEM: number;
  DOMINIO: string | null;
  URL_BUSCA: string | null;
  PADRAO: number | null;
  ATIVA: number | null;
  TIPO: string | null;
}
interface FaixaForm { id: number; nome: string; minPct: string; }

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DOMINIO_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;

export default function Configuracoes() {
  const { toasts, addToast, removeToast } = useToast();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [faixas, setFaixas] = useState<FaixaForm[]>([]);
  const [hora, setHora] = useState('');
  const [lojas, setLojas] = useState<Linha[]>([]);
  const [novaLoja, setNovaLoja] = useState({ nome: '', dominio: '', urlBusca: '' });
  const [ocupado, setOcupado] = useState('');
  const [removendo, setRemovendo] = useState<Linha | null>(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const rows = await linhas<Linha>('telaConfig');
      setFaixas(rows.filter(r => r.GRUPO === 'FAIXA').map(r => ({ id: Number(r.ID), nome: r.NOME, minPct: String(Number(r.VALOR)).replace('.', ',') })));
      setHora(rows.find(r => r.GRUPO === 'CONFIG' && r.NOME === 'HORA_LEMBRETE')?.VALOR ?? '09:00');
      setLojas(rows.filter(r => r.GRUPO === 'LOJA'));
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const numFaixa = (s: string) => Number(s.replace(',', '.'));
  const faixasValidas = faixas.every(f => f.nome.trim() && numFaixa(f.minPct) > 0 && numFaixa(f.minPct) <= 100)
    && new Set(faixas.map(f => numFaixa(f.minPct))).size === faixas.length;

  async function salvarFaixas() {
    setOcupado('faixas');
    try {
      await chamar('salvarFaixas', { lista: JSON.stringify(faixas.map(f => ({ id: f.id, nome: f.nome.trim(), minPct: numFaixa(f.minPct) }))) });
      addToast('success', 'Faixas salvas. Valem a partir da próxima rodada.');
      carregar();
    } catch (e) {
      addToast('error', getMitraErrorMessage(e));
    } finally {
      setOcupado('');
    }
  }

  async function salvarHora() {
    if (!HORA_RE.test(hora)) return;
    setOcupado('hora');
    try {
      await chamar('intSalvarHorario', { hora });
      addToast('success', `Lembrete diário às ${hora} (horário de Brasília).`);
    } catch (e) {
      addToast('error', getMitraErrorMessage(e));
    } finally {
      setOcupado('');
    }
  }

  function digitarHora(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 4);
    setHora(d.length > 2 ? d.slice(0, 2) + ':' + d.slice(2) : d);
  }

  const dominioLimpo = novaLoja.dominio.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const urlOk = !novaLoja.urlBusca.trim() || (/^https:\/\//.test(novaLoja.urlBusca.trim()) && novaLoja.urlBusca.includes('{q}'));
  const lojaValida = novaLoja.nome.trim().length >= 2 && DOMINIO_RE.test(dominioLimpo) && urlOk;

  async function adicionarLoja() {
    if (!lojaValida) return;
    setOcupado('loja');
    try {
      await chamar('intAdicionarLoja', { nome: novaLoja.nome.trim(), dominio: dominioLimpo, urlBusca: novaLoja.urlBusca.trim() });
      addToast('success', `${novaLoja.nome.trim()} entra na próxima rodada.`);
      setNovaLoja({ nome: '', dominio: '', urlBusca: '' });
      carregar();
    } catch (e) {
      addToast('error', getMitraErrorMessage(e));
    } finally {
      setOcupado('');
    }
  }

  async function alternar(l: Linha, ativa: boolean) {
    setLojas(ls => ls.map(x => (x.ID === l.ID ? { ...x, ATIVA: ativa ? 1 : 0 } : x)));
    try {
      await chamar('alternarLoja', { lojaId: l.ID, ativa: ativa ? 1 : 0 });
    } catch (e) {
      addToast('error', getMitraErrorMessage(e));
      carregar();
    }
  }

  async function remover() {
    if (!removendo) return;
    setOcupado('remover');
    try {
      await chamar('removerLoja', { lojaId: removendo.ID });
      addToast('success', `${removendo.NOME} saiu da lista.`);
      setRemovendo(null);
      carregar();
    } catch (e) {
      addToast('error', getMitraErrorMessage(e));
    } finally {
      setOcupado('');
    }
  }

  if (carregando) return <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-4"><SkeletonCard /><SkeletonCard /></div>;

  const padrao = lojas.filter(l => Number(l.PADRAO) === 1);
  const minhas = lojas.filter(l => Number(l.PADRAO) !== 1);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold" style={{ color: 'var(--fg)' }}>Configurações</h1>
        <p className="text-[13.5px]" style={{ color: 'var(--fg-muted)' }}>Também dá para mudar tudo isso pela Conversa, por exemplo "lembrete às 20h" ou "adicionar loja Cobasi cobasi.com.br".</p>
      </div>
      {erro && <Card className="p-4 text-[13.5px]" style={{ color: 'var(--danger-text)' }}>{erro}</Card>}

      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>Faixas de oportunidade</h2>
          <p className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>Desconto mínimo sobre o valor de mercado. Abaixo da menor faixa não há aviso. Mudanças valem a partir da próxima rodada.</p>
        </div>
        <div className="space-y-2">
          {faixas.map((f, i) => (
            <div key={f.id} className="grid grid-cols-[1fr_140px] gap-3">
              <Input aria-label="Nome da faixa" value={f.nome} maxLength={60} onChange={e => setFaixas(fs => fs.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
              <Input aria-label="Desconto mínimo em %" value={f.minPct} inputMode="decimal" onChange={e => setFaixas(fs => fs.map((x, j) => (j === i ? { ...x, minPct: e.target.value.replace(/[^\d,]/g, '') } : x)))} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12.5px]" style={{ color: faixasValidas ? 'var(--fg-subtle)' : 'var(--danger-text)' }}>
            {faixasValidas ? 'Valores em % (ex.: 20 = 20% abaixo do valor de mercado).' : 'Cada faixa precisa de nome e de um percentual diferente entre 0 e 100.'}
          </span>
          <Button onClick={salvarFaixas} disabled={!faixasValidas || ocupado === 'faixas'}>{ocupado === 'faixas' ? 'Salvando…' : 'Salvar faixas'}</Button>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div>
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>Lembrete diário</h2>
          <p className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>Enquanto uma oferta continuar numa faixa, sai um lembrete por dia neste horário (Brasília).</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="w-32">
            <Input aria-label="Horário" value={hora} placeholder="HH:MM" inputMode="numeric" onChange={e => digitarHora(e.target.value)} error={hora && !HORA_RE.test(hora) ? 'Use HH:MM' : undefined} />
          </div>
          <Button onClick={salvarHora} disabled={!HORA_RE.test(hora) || ocupado === 'hora'}>{ocupado === 'hora' ? 'Salvando…' : 'Salvar horário'}</Button>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>Lojas consultadas</h2>
          <p className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>As lojas padrão e a busca aberta na web entram em toda rodada. As que você acrescenta entram a partir da rodada seguinte.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {padrao.map(l => <Badge key={l.ID} variant={l.TIPO === 'BUSCA' ? 'info' : 'neutral'}>{l.NOME}</Badge>)}
        </div>
        {minhas.length > 0 && (
          <div className="space-y-2">
            <div className="text-[13px] font-medium" style={{ color: 'var(--fg)' }}>Acrescentadas por você</div>
            {minhas.map(l => (
              <div key={l.ID} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--surface-muted)' }}>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium" style={{ color: 'var(--fg)' }}>{l.NOME}</div>
                  <div className="text-[12px] truncate" style={{ color: 'var(--fg-subtle)' }}>{l.DOMINIO}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox label="Ativa" checked={Number(l.ATIVA) === 1} onChange={v => alternar(l, v)} />
                  <Button variant="ghost" size="sm" onClick={() => setRemovendo(l)} aria-label={`Remover ${l.NOME}`}><Trash2 size={14} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="grid sm:grid-cols-[1fr_1fr] gap-3">
          <Input label="Nome da loja" value={novaLoja.nome} maxLength={60} placeholder="Ex.: Cobasi" onChange={e => setNovaLoja(n => ({ ...n, nome: e.target.value }))} />
          <Input label="Site" value={novaLoja.dominio} maxLength={120} placeholder="Ex.: cobasi.com.br" onChange={e => setNovaLoja(n => ({ ...n, dominio: e.target.value }))} />
        </div>
        <Input
          label="Endereço de busca da loja (opcional, use {q} no lugar do termo)"
          value={novaLoja.urlBusca}
          maxLength={500}
          placeholder="Ex.: https://www.cobasi.com.br/pesquisa?terms={q}"
          error={!urlOk ? 'Comece com https:// e inclua {q}' : undefined}
          onChange={e => setNovaLoja(n => ({ ...n, urlBusca: e.target.value }))}
        />
        <div className="flex justify-end">
          <Button onClick={adicionarLoja} disabled={!lojaValida || ocupado === 'loja'}><Plus size={14} /> {ocupado === 'loja' ? 'Adicionando…' : 'Adicionar loja'}</Button>
        </div>
      </Card>

      <ExportarApp onAviso={addToast} />

      <ConfirmDialog
        isOpen={!!removendo}
        onClose={() => setRemovendo(null)}
        onConfirm={remover}
        title="Remover loja"
        message={`${removendo?.NOME ?? ''} deixa de ser consultada nas rodadas. As ofertas já registradas continuam no histórico.`}
        confirmLabel="Remover"
        loading={ocupado === 'remover'}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

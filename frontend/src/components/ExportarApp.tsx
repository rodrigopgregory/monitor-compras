import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Github } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import { chamar, linhas, dataHora } from '../lib/api';
import { getMitraErrorMessage } from '../lib/utils';

interface Linha {
  GRUPO: 'ITEM' | 'GIT';
  ID: number;
  A: string | null;
  B: string | null;
  C: string | null;
  D: string | null;
  E: string | null;
  N: number | null;
  F: string | null;
  G: string | null;
}
interface Item { id: number; tipo: string; nome: string; estado: string; etapa: string; erro: string; tamanho: number; inicio: string; fim: string; }

interface ExportarAppProps {
  onAviso: (tipo: 'success' | 'error' | 'info', texto: string) => void;
}

function tamanhoTexto(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

export default function ExportarApp({ onAviso }: ExportarAppProps) {
  const [itens, setItens] = useState<Item[]>([]);
  const [git, setGit] = useState<Record<string, string>>({});
  const [iniciando, setIniciando] = useState('');
  const [baixando, setBaixando] = useState(0);
  const [erro, setErro] = useState('');
  const anterior = useRef<Record<string, string>>({});

  const atualizar = useCallback(async () => {
    try {
      const rows = await linhas<Linha>('telaExportar');
      setItens(rows.filter(r => r.GRUPO === 'ITEM').map(r => ({
        id: Number(r.ID), tipo: r.A ?? '', nome: r.B ?? '', estado: r.C ?? '', etapa: r.D ?? '', erro: r.E ?? '',
        tamanho: Number(r.N ?? 0), inicio: r.F ?? '', fim: r.G ?? '',
      })));
      const g: Record<string, string> = {};
      for (const r of rows.filter(x => x.GRUPO === 'GIT')) g[r.A ?? ''] = r.B ?? '';
      const antes = anterior.current;
      if (antes.ENVIO_ESTADO === 'ENVIANDO' && g.ENVIO_ESTADO === 'OK') onAviso('success', `Enviado ao GitHub: ${g.ENVIO_ARQUIVOS || ''} arquivos.`);
      if (antes.ENVIO_ESTADO === 'ENVIANDO' && g.ENVIO_ESTADO === 'ERRO') onAviso('error', g.ENVIO_ERRO || 'O envio ao GitHub falhou.');
      anterior.current = g;
      setGit(g);
      setErro('');
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    }
  }, [onAviso]);

  const ativo = itens.some(i => i.estado === 'ENVIANDO') || git.ENVIO_ESTADO === 'ENVIANDO';

  useEffect(() => { atualizar(); }, [atualizar]);
  useEffect(() => {
    if (!ativo) return;
    const timer = setInterval(atualizar, 4000);
    return () => clearInterval(timer);
  }, [ativo, atualizar]);

  async function gerar(tipo: 'LEVE' | 'COMPLETO') {
    setIniciando(tipo);
    try {
      await chamar('exportar', { acao: 'iniciar', tipo });
      await atualizar();
    } catch (e) {
      onAviso('error', getMitraErrorMessage(e));
    } finally {
      setIniciando('');
    }
  }

  async function baixar(id: number) {
    setBaixando(id);
    try {
      const r = await chamar<{ url: string; nome: string }>('exportar', { acao: 'link', id });
      const a = document.createElement('a');
      a.href = r.url;
      a.download = r.nome;
      a.rel = 'noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      onAviso('error', getMitraErrorMessage(e));
      atualizar();
    } finally {
      setBaixando(0);
    }
  }

  async function enviarGit() {
    setIniciando('GIT');
    try {
      const r = await chamar<{ jaEmAndamento?: boolean }>('exportarGit', { acao: 'iniciar' });
      if (r?.jaEmAndamento) onAviso('info', 'Já tem um envio em andamento.');
      await atualizar();
    } catch (e) {
      onAviso('error', getMitraErrorMessage(e));
    } finally {
      setIniciando('');
    }
  }

  const configurado = git.TOKEN_OK === '1' && !!git.REPO;
  const enviando = git.ENVIO_ESTADO === 'ENVIANDO';
  const repoUrl = git.REPO ? `https://github.com/${git.REPO.replace(/^https?:\/\/github\.com\//i, '').replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '')}` : '';

  function bloco(tipo: 'LEVE' | 'COMPLETO', titulo: string, texto: string) {
    const doTipo = itens.filter(i => i.tipo === tipo);
    const andamento = doTipo.find(i => i.estado === 'ENVIANDO');
    const pronto = doTipo.find(i => i.estado === 'PRONTO');
    const falhou = !andamento && !pronto && doTipo[0]?.estado === 'ERRO' ? doTipo[0] : null;
    return (
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--surface-muted)' }}>
        <div>
          <div className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>{titulo}</div>
          <p className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>{texto}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => gerar(tipo)} disabled={!!andamento || iniciando === tipo}>
            {andamento ? 'Gerando…' : iniciando === tipo ? 'Começando…' : 'Gerar agora'}
          </Button>
          {pronto && !andamento && (
            <Button variant="secondary" onClick={() => baixar(pronto.id)} disabled={baixando === pronto.id}>
              <Download size={14} /> {baixando === pronto.id ? 'Abrindo…' : `Baixar (${tamanhoTexto(pronto.tamanho)})`}
            </Button>
          )}
          {andamento && <span className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>{andamento.etapa || 'Trabalhando…'}</span>}
          {!andamento && pronto && <span className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>Gerado em {dataHora(pronto.fim)}</span>}
        </div>
        {falhou && <p className="text-[12.5px]" style={{ color: 'var(--danger-text)' }}>{falhou.erro || 'A geração falhou. Tente de novo.'}</p>}
      </div>
    );
  }

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>Exportar</h2>
        <p className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>Leve o código e os dados do app. Segredos e senhas nunca entram.</p>
      </div>
      {erro && <p className="text-[12.5px]" style={{ color: 'var(--danger-text)' }}>{erro}</p>}
      {bloco('LEVE', 'Código leve', 'ZIP com o código (sem node_modules e sem .env), a estrutura do banco e os dados das tabelas pequenas. Tabelas internas ou enormes entram só com a estrutura.')}
      {bloco('COMPLETO', 'Pacote completo', 'Tudo do código leve, com os dados de todas as tabelas e o histórico do git.')}
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--surface-muted)' }}>
        <div>
          <div className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>Enviar tudo para o GitHub</div>
          <p className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>Gera o código leve e grava num novo commit do seu repositório.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={enviarGit} disabled={!configurado || enviando || iniciando === 'GIT'}>
            <Github size={14} /> {enviando ? (git.ENVIO_ETAPA || 'Enviando ao GitHub…') : iniciando === 'GIT' ? 'Preparando os arquivos…' : 'Enviar tudo para o GitHub'}
          </Button>
          {repoUrl && (
            <a href={repoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] hover:underline" style={{ color: 'var(--accent-text)' }}>
              Abrir o repositório <ExternalLink size={12} />
            </a>
          )}
          {git.ULTIMO_COMMIT_URL && (
            <a href={git.ULTIMO_COMMIT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] hover:underline" style={{ color: 'var(--accent-text)' }}>
              Ver o último commit <ExternalLink size={12} />
            </a>
          )}
        </div>
        {!configurado && <p className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>O envio ao GitHub ainda não foi configurado.</p>}
        {configurado && !enviando && git.ENVIO_ESTADO === 'OK' && (
          <p className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>Enviado: {git.ENVIO_ARQUIVOS} arquivos{git.ULTIMO_ENVIO_EM ? ` em ${dataHora(git.ULTIMO_ENVIO_EM)}` : ''}.</p>
        )}
        {configurado && !enviando && git.ENVIO_ESTADO !== 'OK' && git.ULTIMO_ENVIO_EM && (
          <p className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>Último envio em {dataHora(git.ULTIMO_ENVIO_EM)}.</p>
        )}
        {!enviando && git.ENVIO_ESTADO === 'ERRO' && git.ENVIO_ERRO && (
          <p className="text-[12.5px]" style={{ color: 'var(--danger-text)' }}>{git.ENVIO_ERRO}</p>
        )}
      </div>
    </Card>
  );
}

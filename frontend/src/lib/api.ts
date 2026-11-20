import { executeServerFunctionMitra } from 'mitra-interactions-sdk';
import { SF } from './sf-ids';
import { getMitraErrorMessage } from './utils';

const PROJECT_ID = Number(import.meta.env.VITE_MITRA_PROJECT_ID);

type NomeSF = keyof typeof SF;

export async function chamar<T = any>(nome: NomeSF, input: Record<string, unknown> = {}): Promise<T> {
  let res: any;
  try {
    res = await executeServerFunctionMitra({ projectId: PROJECT_ID, serverFunctionId: SF[nome], input });
  } catch (err) {
    throw new Error(getMitraErrorMessage(err));
  }
  const r = res?.result;
  if (!r || r.executionStatus === 'FAILED') throw new Error(getMitraErrorMessage(r?.error ?? 'Falha ao executar'));
  let out = r.output;
  if (typeof out === 'string') {
    try { out = JSON.parse(out); } catch { /* texto */ }
  }
  if (out && typeof out === 'object' && 'error' in out && out.error) throw new Error(getMitraErrorMessage(out.error));
  return out as T;
}

export async function linhas<T = any>(nome: NomeSF, input: Record<string, unknown> = {}): Promise<T[]> {
  const out = await chamar<{ rows?: T[] }>(nome, input);
  return out?.rows ?? [];
}

const cacheLinks: Record<string, { url: string; ate: number }> = {};

export async function linksDePrints(ofertaIds: number[], produtoIds: number[] = []): Promise<Record<string, string>> {
  const agora = Date.now();
  const faltaO = [...new Set(ofertaIds)].filter(id => !(cacheLinks['o' + id]?.ate > agora));
  const faltaP = [...new Set(produtoIds)].filter(id => !(cacheLinks['p' + id]?.ate > agora));
  if (faltaO.length || faltaP.length) {
    const out = await chamar<{ links: Record<string, string>; validoAte: number }>('linksPrints', { ofertaIds: faltaO.slice(0, 50), produtoIds: faltaP.slice(0, 50) });
    for (const [k, url] of Object.entries(out?.links ?? {})) cacheLinks[k] = { url, ate: out.validoAte || agora + 25 * 60e3 };
  }
  const res: Record<string, string> = {};
  for (const id of ofertaIds) if (cacheLinks['o' + id]) res['o' + id] = cacheLinks['o' + id].url;
  for (const id of produtoIds) if (cacheLinks['p' + id]) res['p' + id] = cacheLinks['p' + id].url;
  return res;
}

export function brl(v: number | null | undefined): string {
  if (v == null || !isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function pct(v: number | null | undefined): string {
  if (v == null || !isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

export function dataHora(s: string | null | undefined): string {
  if (!s) return '—';
  const [d, h] = s.split('T');
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}${a !== String(new Date().getFullYear()) ? '/' + a : ''}${h ? ' ' + h.slice(0, 5) : ''}`;
}

export function data(s: string | null | undefined): string {
  if (!s) return '—';
  const [a, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

import { useState } from 'react';
import { Search } from 'lucide-react';
import Button from './ui/Button';
import { chamar } from '../lib/api';
import { getMitraErrorMessage } from '../lib/utils';

interface Resultado { iniciados: number; naFila: number; emRodada: number; }

interface BuscarAgoraProps {
  produtoId?: number;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'secondary';
  onAviso: (tipo: 'success' | 'error' | 'info', texto: string) => void;
}

export default function BuscarAgora({ produtoId, size = 'sm', variant = 'primary', onAviso }: BuscarAgoraProps) {
  const [rodando, setRodando] = useState(false);

  async function buscar() {
    setRodando(true);
    try {
      const r = await chamar<Resultado>('buscarAgora', { produtoId: produtoId ?? 0 });
      if (r.iniciados > 0) {
        const resto = r.naFila > 0 ? ` Mais ${r.naFila} na fila, em até 5 minutos cada.` : '';
        onAviso('success', `Busca na web começou${produtoId ? '' : ` para ${r.iniciados} produto${r.iniciados > 1 ? 's' : ''}`}. Leva uns 3 minutos; os avisos chegam na Conversa.${resto}`);
      } else if (r.emRodada > 0) {
        onAviso('info', 'Já tem uma busca rodando agora. O resultado chega em poucos minutos.');
      } else if (r.naFila > 0) {
        onAviso('info', `${r.naFila} produto${r.naFila > 1 ? 's' : ''} na fila. A busca começa em até 5 minutos.`);
      } else {
        onAviso('info', 'Nenhum produto em monitoramento para buscar.');
      }
    } catch (e) {
      onAviso('error', getMitraErrorMessage(e));
    } finally {
      setTimeout(() => setRodando(false), 4000);
    }
  }

  return (
    <Button variant={variant} size={size} onClick={buscar} disabled={rodando} title="Rodar agora a busca de preços nas lojas e na web">
      <Search size={14} /> {rodando ? 'Buscando…' : 'Buscar agora'}
    </Button>
  );
}

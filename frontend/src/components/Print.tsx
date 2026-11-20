import { useState } from 'react';
import { ImageOff, Maximize2 } from 'lucide-react';
import Modal from './ui/Modal';

interface PrintProps {
  url?: string;
  titulo: string;
  pequeno?: boolean;
}

export default function Print({ url, titulo, pequeno }: PrintProps) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState(false);
  if (!url || erro) {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-lg text-[12.5px] ${pequeno ? 'h-16 w-24' : 'h-40 w-full'}`}
        style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--fg-subtle)' }}
      >
        <ImageOff size={14} />
        {!pequeno && 'Print sendo gerado'}
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`group relative overflow-hidden rounded-lg border ${pequeno ? 'h-16 w-24' : 'h-40 w-full'}`}
        style={{ borderColor: 'var(--border)' }}
        title="Ver print da página"
      >
        <img src={url} alt={`Print: ${titulo}`} className="h-full w-full object-cover object-top" onError={() => setErro(true)} />
        <span
          className="absolute right-1.5 bottom-1.5 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--fg)' }}
        >
          <Maximize2 size={12} />
        </span>
      </button>
      <Modal isOpen={aberto} onClose={() => setAberto(false)} title={titulo} size="xl">
        <img src={url} alt={`Print: ${titulo}`} className="w-full rounded-lg" />
      </Modal>
    </>
  );
}

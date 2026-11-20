import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { MessageCircle, Package, LineChart, Settings, Bell } from 'lucide-react';

const ITENS = [
  { to: '/', label: 'Conversa', icone: MessageCircle, fim: true },
  { to: '/notificacoes', label: 'Notificações', icone: Bell },
  { to: '/produtos', label: 'Produtos', icone: Package },
  { to: '/historico', label: 'Histórico', icone: LineChart },
  { to: '/configuracoes', label: 'Configurações', icone: Settings },
];

export default function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ backgroundColor: 'var(--bg)' }}>
      <aside
        className="md:w-56 shrink-0 md:min-h-screen flex md:flex-col gap-1 p-3 overflow-x-auto"
        style={{ borderRight: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}
      >
        {ITENS.map(({ to, label, icone: Icone, fim }) => (
          <NavLink
            key={to}
            to={to}
            end={fim}
            className="nav-item md:w-full"
            data-active={fim ? pathname === to : pathname.startsWith(to)}
          >
            <Icone size={16} />
            {label}
          </NavLink>
        ))}
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

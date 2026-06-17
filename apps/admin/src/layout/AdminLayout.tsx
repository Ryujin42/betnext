import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Button, cn } from '@betnext/ui';
import { useAuth } from '../auth/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/users', label: 'Utilisateurs' },
  { to: '/events', label: 'Évènements' },
] as const;

export function AdminLayout() {
  const { user, logout } = useAuth();
  const router = useRouterState();
  const currentPath = router.location.pathname;

  return (
    <div className="flex h-full">
      <aside className="flex w-60 flex-col border-r border-surface-200 bg-surface-50 p-4">
        <div className="mb-6 px-2">
          <div className="text-xl font-bold text-ink-50">BetNext</div>
          <div className="text-xs uppercase tracking-wide text-brand-500">Admin</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active =
              currentPath === item.to || (item.to !== '/' && currentPath.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-brand-500/15 text-brand-100 font-medium'
                    : 'text-ink-300 hover:bg-surface-100 hover:text-ink-100',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-lg border border-surface-200 p-3">
          <div className="text-sm font-medium text-ink-100">{user?.name}</div>
          <div className="mb-2 text-xs text-ink-300">{user?.role}</div>
          <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-center">
            Déconnexion
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}

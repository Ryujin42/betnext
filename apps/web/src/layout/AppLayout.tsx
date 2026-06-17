import { useEffect } from 'react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button, cn } from '@betnext/ui';
import { useAuth } from '../auth/AuthContext';
import { getBalance, type Balance } from '../api/wallet';
import { useWalletStore } from '../store/wallet';

const NAV = [
  { to: '/', label: 'Catalogue' },
  { to: '/profile', label: 'Mon profil' },
] as const;

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const setBalance = useWalletStore((s) => s.setBalance);
  const balance = useWalletStore((s) => s.balance);

  const balanceQ = useQuery<Balance>({ queryKey: ['wallet', 'balance'], queryFn: getBalance });

  useEffect(() => {
    if (balanceQ.data) setBalance(balanceQ.data.amount);
  }, [balanceQ.data, setBalance]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-surface-200 bg-surface-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink-50">BetNext</span>
            <span className="text-xs uppercase tracking-wide text-brand-500">e-sport</span>
          </Link>
          <nav className="hidden gap-4 md:flex">
            {NAV.map((item) => {
              const active =
                currentPath === item.to || (item.to !== '/' && currentPath.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm transition-colors',
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
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-ink-300">Solde</div>
              <div className="text-sm font-semibold text-ink-50">
                {balance !== null ? formatEur(balance) : '—'}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={logout}>
              {user?.name ?? 'Déconnexion'}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

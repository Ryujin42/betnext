import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button, Card } from '@betnext/ui';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { ApiException } from '../api/client';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(email, password);
      if (!isAdminRole(user.role)) {
        await navigate({ to: '/forbidden' });
        return;
      }
      await navigate({ to: '/' });
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.body?.message ?? 'Identifiants invalides.');
      } else {
        setError('Erreur réseau, réessaie.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-ink-50">BetNext Admin</h1>
        <p className="mb-6 text-sm text-ink-300">Accès réservé aux rôles internes.</p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-300">Email</span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-300">Mot de passe</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
            />
          </label>
          {error && (
            <div className="rounded-lg bg-danger-500/15 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <Button type="submit" loading={busy} className="w-full justify-center">
            Se connecter
          </Button>
        </form>
      </Card>
    </div>
  );
}

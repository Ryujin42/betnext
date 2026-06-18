import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button, Card } from '@betnext/ui';
import { useAuth } from '../auth/AuthContext';
import { ApiException } from '../api/client';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      await navigate({ to: '/' });
    } catch (err) {
      setError(
        err instanceof ApiException
          ? (err.body?.message ?? 'Identifiants invalides.')
          : 'Erreur réseau.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-ink-50">Connexion</h1>
        <p className="mb-6 text-sm text-ink-300">Pas encore inscrit ? Crée un compte joueur.</p>
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
          <Link to="/register" className="text-center text-sm text-ink-300 hover:text-brand-500">
            Créer un compte
          </Link>
        </form>
      </Card>
    </div>
  );
}

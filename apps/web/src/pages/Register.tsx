import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button, Card } from '@betnext/ui';
import { useAuth } from '../auth/AuthContext';
import { ApiException } from '../api/client';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [acceptTos, setAcceptTos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!acceptTos) {
      setError('Tu dois accepter les conditions générales.');
      return;
    }
    setBusy(true);
    try {
      await register({ name, email, password, birthDate, acceptTos });
      await navigate({ to: '/' });
    } catch (err) {
      setError(
        err instanceof ApiException
          ? (err.body?.message ?? 'Inscription refusée.')
          : 'Erreur réseau.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-2xl font-bold text-ink-50">Créer un compte</h1>
        <p className="mb-6 text-sm text-ink-300">
          Inscription réservée aux majeurs (≥ 18 ans, législation ARJEL).
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-300">Pseudo</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-300">Email</span>
            <input
              type="email"
              required
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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-300">Date de naissance</span>
            <input
              type="date"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-ink-300">
            <input
              type="checkbox"
              checked={acceptTos}
              onChange={(e) => setAcceptTos(e.target.checked)}
              className="mt-0.5"
            />
            J'accepte les CGU et confirme avoir au moins 18 ans.
          </label>
          {error && (
            <div className="rounded-lg bg-danger-500/15 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <Button type="submit" loading={busy} className="w-full justify-center">
            Créer mon compte
          </Button>
          <Link to="/login" className="text-center text-sm text-ink-300 hover:text-brand-500">
            J'ai déjà un compte
          </Link>
        </form>
      </Card>
    </div>
  );
}

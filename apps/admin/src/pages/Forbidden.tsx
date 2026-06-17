import { Link } from '@tanstack/react-router';
import { Button, Card } from '@betnext/ui';
import { useAuth } from '../auth/AuthContext';

export function ForbiddenPage() {
  const { logout } = useAuth();
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <h1 className="mb-2 text-2xl font-bold text-ink-50">Accès refusé</h1>
        <p className="mb-6 text-sm text-ink-300">
          Cet espace est réservé aux rôles internes (administrateur, gestionnaire). Votre compte n'a
          pas les permissions requises.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              logout();
            }}
          >
            Se déconnecter
          </Button>
          <Link to="/login">
            <Button>Reconnexion</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

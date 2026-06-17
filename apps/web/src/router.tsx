import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { tokenStore } from './api/tokens';
import { AppLayout } from './layout/AppLayout';
import { CatalogPage } from './pages/Catalog';
import { EventPage } from './pages/Event';
import { LoginPage } from './pages/Login';
import { ProfilePage } from './pages/Profile';
import { RegisterPage } from './pages/Register';

const rootRoute = createRootRoute({ component: () => <Outlet /> });

/** Si l'utilisateur est déjà connecté, on l'envoie sur le catalogue. */
function redirectIfAuth() {
  const user = tokenStore.getUser();
  if (user) throw redirect({ to: '/' });
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
  beforeLoad: redirectIfAuth,
});
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
  beforeLoad: redirectIfAuth,
});

/**
 * Branche protégée : exige un utilisateur authentifié. ROLE_USER (par défaut)
 * est suffisant — admin/manager passent aussi (rien à interdire ici, ils ont
 * juste leur propre SPA).
 */
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  component: AppLayout,
  beforeLoad: () => {
    const user = tokenStore.getUser();
    if (!user) throw redirect({ to: '/login' });
  },
});

const catalogRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/',
  component: CatalogPage,
});
const eventRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/events/$eventId',
  component: EventPage,
});
const profileRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/profile',
  component: ProfilePage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  protectedRoute.addChildren([catalogRoute, eventRoute, profileRoute]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

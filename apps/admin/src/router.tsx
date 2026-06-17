import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { AdminLayout } from './layout/AdminLayout';
import { Dashboard } from './pages/Dashboard';
import { EventsPage } from './pages/Events';
import { ForbiddenPage } from './pages/Forbidden';
import { LoginPage } from './pages/Login';
import { UsersPage } from './pages/Users';
import { tokenStore } from './api/tokens';
import { isAdminRole } from './auth/roles';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
  // Si déjà connecté en admin/manager → redirige vers le dashboard.
  beforeLoad: () => {
    const user = tokenStore.getUser();
    if (user && isAdminRole(user.role)) {
      throw redirect({ to: '/' });
    }
  },
});

const forbiddenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forbidden',
  component: ForbiddenPage,
});

/**
 * Branche protégée : exige un user authentifié ET un rôle admin/manager.
 * Si pas authentifié → /login ; si authentifié mais ROLE_USER → /forbidden
 * (DoD T8.1 : un `ROLE_USER` ne peut pas accéder à l'admin).
 */
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  component: AdminLayout,
  beforeLoad: () => {
    const user = tokenStore.getUser();
    if (!user) {
      throw redirect({ to: '/login' });
    }
    if (!isAdminRole(user.role)) {
      throw redirect({ to: '/forbidden' });
    }
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/',
  component: Dashboard,
});
const usersRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/users',
  component: UsersPage,
});
const eventsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/events',
  component: EventsPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  forbiddenRoute,
  protectedRoute.addChildren([dashboardRoute, usersRoute, eventsRoute]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

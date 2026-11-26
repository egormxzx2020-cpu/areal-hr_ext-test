import { route } from 'quasar/wrappers';
import {
  createRouter,
  createMemoryHistory,
  createWebHistory,
  createWebHashHistory,
} from 'vue-router';
import routes from './routes';
import { useAuth } from '../composables/useAuth';

export default route(function () {
  const routerMode = import.meta.env.VUE_ROUTER_MODE || 'hash';
  const routerBase = import.meta.env.VUE_ROUTER_BASE || '/';

  const createHistory = import.meta.env.SSR
    ? createMemoryHistory
    : routerMode === 'history'
      ? createWebHistory
      : createWebHashHistory;

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(routerBase),
  });

  Router.beforeEach(async (to) => {
    const { isAuthChecked, isAuthenticated, isAdmin, fetchCurrentUser } = useAuth();

    if (!isAuthChecked.value) {
      await fetchCurrentUser();
    }

    if (to.meta.requiresAuth && !isAuthenticated.value) {
      return '/login';
    }

    if (to.meta.guestOnly && isAuthenticated.value) {
      return '/';
    }

    if (to.meta.requiresAdmin && !isAdmin.value) {
      return '/';
    }

    return true;
  });

  return Router;
});
import { boot } from 'quasar/wrappers';
import axios from 'axios';
import { Notify } from 'quasar';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
});

let unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

export default boot(({ app, router }) => {
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error?.response?.status;
      const requestUrl = error?.config?.url || '';

      if (
        status === 401 &&
        !requestUrl.includes('/auth/login') &&
        !requestUrl.includes('/auth/me')
      ) {
        if (unauthorizedHandler) {
          unauthorizedHandler();
        }
        if (router.currentRoute.value.path !== '/login') {
          router.push('/login');
        }
      } else if (status === 403) {
        Notify.create({
          type: 'negative',
          message:
            error?.response?.data?.message ||
            'Недостаточно прав для выполнения операции',
        });
      }

      return Promise.reject(error);
    },
  );

  app.config.globalProperties.$axios = axios;
  app.config.globalProperties.$api = api;
});

export { api };
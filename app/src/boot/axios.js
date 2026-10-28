import { boot } from 'quasar/wrappers';
import axios from 'axios';

// В Vite переменные окружения читаются через import.meta.env
const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || 'http://localhost:3000',
});

export default boot(({ app }) => {
  app.config.globalProperties.$axios = axios;
  app.config.globalProperties.$api = api;
});

export { api };
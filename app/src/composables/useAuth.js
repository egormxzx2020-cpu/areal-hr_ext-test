import { ref, computed } from 'vue';
import { api, setUnauthorizedHandler } from '../boot/axios';

const currentUser = ref(null);
const isAuthChecked = ref(false);
let pendingCheck = null;

function clearAuthState() {
  currentUser.value = null;
  isAuthChecked.value = true;
}

setUnauthorizedHandler(clearAuthState);

export function useAuth() {
  const isAuthenticated = computed(() => Boolean(currentUser.value));
  const isAdmin = computed(() => currentUser.value?.role === 'admin');

  const userFullName = computed(() => {
    const u = currentUser.value;
    if (!u) return '';
    return [u.last_name, u.first_name, u.middle_name].filter(Boolean).join(' ');
  });

  const roleLabel = computed(() => {
    if (!currentUser.value) return '';
    return currentUser.value.role === 'admin'
      ? 'Администратор'
      : 'Менеджер по персоналу';
  });

  async function fetchCurrentUser(force = false) {
    if (isAuthChecked.value && !force) {
      return currentUser.value;
    }

    if (pendingCheck) {
      return pendingCheck;
    }

    pendingCheck = api
      .get('/auth/me')
      .then((res) => {
        currentUser.value = res.data;
        isAuthChecked.value = true;
        return currentUser.value;
      })
      .catch(() => {
        currentUser.value = null;
        isAuthChecked.value = true;
        return null;
      })
      .finally(() => {
        pendingCheck = null;
      });

    return pendingCheck;
  }

  async function login(loginValue, password) {
    const res = await api.post('/auth/login', {
      login: loginValue,
      password,
    });
    currentUser.value = res.data;
    isAuthChecked.value = true;
    return res.data;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      currentUser.value = null;
      isAuthChecked.value = true;
    }
  }

  return {
    user: currentUser,
    isAuthChecked,
    isAuthenticated,
    isAdmin,
    userFullName,
    roleLabel,
    fetchCurrentUser,
    login,
    logout,
    clearAuthState,
  };
}
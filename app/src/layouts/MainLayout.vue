<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-icon name="badge" size="28px" class="q-mr-sm" />
        <q-toolbar-title>
          Areal HR — Система кадрового учета
        </q-toolbar-title>

        <div v-if="user" class="row items-center q-gutter-sm">
          <div class="text-right gt-xs">
            <div class="text-body2 text-weight-medium">{{ userFullName }}</div>
            <div class="text-caption text-blue-1">@{{ user.login }}</div>
          </div>

          <q-badge
            :color="isAdmin ? 'deep-orange' : 'teal-7'"
            :label="roleLabel"
            class="q-py-xs q-px-sm"
          />

          <q-btn
            flat
            dense
            icon="logout"
            label="Выйти"
            @click="handleLogout"
          />
        </div>
      </q-toolbar>

      <q-tabs
        align="left"
        class="bg-white text-grey-8"
        active-color="primary"
        indicator-color="primary"
        dense
      >
        <q-route-tab to="/" exact icon="people" label="Сотрудники" />
        <q-route-tab to="/organizations" icon="business" label="Организации" />
        <q-route-tab to="/departments" icon="account_tree" label="Отделы" />
        <q-route-tab to="/positions" icon="work" label="Должности" />
        <q-route-tab to="/history" icon="history" label="История изменений" />
        <q-route-tab
          v-if="isAdmin"
          to="/users"
          icon="manage_accounts"
          label="Пользователи"
        />
      </q-tabs>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useAuth } from '../composables/useAuth';

const router = useRouter();
const $q = useQuasar();
const { user, isAdmin, userFullName, roleLabel, logout } = useAuth();

async function handleLogout() {
  await logout();
  $q.notify({
    type: 'info',
    message: 'Вы вышли из системы',
  });
  await router.push('/login');
}
</script>
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
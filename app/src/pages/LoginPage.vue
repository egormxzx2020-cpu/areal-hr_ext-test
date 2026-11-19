<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="flex flex-center bg-grey-2 q-pa-md">
        <q-card style="width: 100%; max-width: 420px" class="shadow-4">
          <q-card-section class="bg-primary text-white text-center q-py-lg">
            <q-icon name="badge" size="42px" class="q-mb-sm" />
            <div class="text-h5 text-weight-medium">Areal HR</div>
            <div class="text-caption text-blue-1">
              Система кадрового учета — Вход в систему
            </div>
          </q-card-section>

          <q-card-section class="q-pt-lg q-px-lg">
            <q-banner
              v-if="errorMessage"
              dense
              rounded
              class="bg-negative text-white q-mb-md"
            >
              <template #avatar>
                <q-icon name="error" />
              </template>
              {{ errorMessage }}
            </q-banner>

            <q-form @submit.prevent="handleLogin" class="q-gutter-md">
              <q-input
                v-model.trim="form.login"
                label="Логин"
                outlined
                autofocus
                :disable="submitting"
                :rules="[(val) => Boolean(val) || 'Введите логин']"
              >
                <template #prepend>
                  <q-icon name="person" />
                </template>
              </q-input>

              <q-input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                label="Пароль"
                outlined
                :disable="submitting"
                :rules="[(val) => Boolean(val) || 'Введите пароль']"
              >
                <template #prepend>
                  <q-icon name="lock" />
                </template>
                <template #append>
                  <q-icon
                    :name="showPassword ? 'visibility_off' : 'visibility'"
                    class="cursor-pointer"
                    @click="showPassword = !showPassword"
                  />
                </template>
              </q-input>

              <div class="q-pt-sm">
                <q-btn
                  type="submit"
                  color="primary"
                  label="Войти"
                  icon="login"
                  class="full-width"
                  size="md"
                  :loading="submitting"
                />
              </div>
            </q-form>
          </q-card-section>
        </q-card>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useAuth } from '../composables/useAuth'

const router = useRouter();
const $q = useQuasar();
const { login } = useAuth();

const form = ref({
  login: '',
  password: '',
});
const showPassword = ref(false);
const submitting = ref(false);
const errorMessage = ref('');

async function handleLogin() {
  errorMessage.value = '';
  submitting.value = true;
  try {
    const user = await login(form.value.login, form.value.password);
    $q.notify({
      type: 'positive',
      message: `Добро пожаловать, ${user.first_name} ${user.last_name}!`,
    });
    await router.push('/');
  } catch (err) {
    errorMessage.value =
      err?.response?.data?.message || 'Неверный логин или пароль';
  } finally {
    submitting.value = false;
  }
}
</script>
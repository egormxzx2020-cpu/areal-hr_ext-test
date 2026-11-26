<template>
  <q-page class="q-pa-md bg-grey-1">
    <q-card flat bordered class="q-pa-md">
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h6">Пользователи системы</div>
        <div class="row items-center q-gutter-md">
          <q-toggle
            v-model="showDeleted"
            label="Показывать удаленных"
            color="negative"
            dense
          />
          <q-btn
            color="primary"
            icon="person_add"
            label="Добавить пользователя"
            @click="openCreateDialog"
          />
        </div>
      </div>

      <q-table
        :rows="filteredUsers"
        :columns="columns"
        row-key="id"
        :loading="loading"
        flat
        bordered
        :pagination="{ rowsPerPage: 10 }"
        no-data-label="Пользователи не найдены"
      >
        <template #body-cell-full_name="props">
          <q-td :props="props">
            <span class="text-weight-medium">{{ formatFullName(props.row) }}</span>
            <q-badge
              v-if="currentUser?.id === props.row.id"
              outline
              color="primary"
              label="Вы"
              class="q-ml-xs"
            />
          </q-td>
        </template>

        <template #body-cell-role="props">
          <q-td :props="props">
            <q-badge
              :color="props.row.role === 'admin' ? 'deep-orange' : 'teal-7'"
              :label="props.row.role === 'admin' ? 'Администратор' : 'Менеджер по персоналу'"
            />
          </q-td>
        </template>

        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge
              :color="props.row.deleted_at ? 'negative' : 'positive'"
              :label="props.row.deleted_at ? 'Удален' : 'Активен'"
            />
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props" class="q-gutter-xs">
            <q-btn
              v-if="!props.row.deleted_at"
              flat
              round
              dense
              color="primary"
              icon="edit"
              @click="openEditDialog(props.row)"
            >
              <q-tooltip>Редактировать</q-tooltip>
            </q-btn>
            <q-btn
              v-if="!props.row.deleted_at"
              flat
              round
              dense
              color="negative"
              icon="delete"
              :disable="currentUser?.id === props.row.id"
              @click="confirmDelete(props.row)"
            >
              <q-tooltip>
                {{
                  currentUser?.id === props.row.id
                    ? 'Нельзя удалить свою учетную запись'
                    : 'Удалить пользователя'
                }}
              </q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-card>

    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="width: 480px; max-width: 95vw">
        <q-card-section class="row items-center bg-primary text-white">
          <div class="text-h6">
            {{ editingId ? 'Редактировать пользователя' : 'Новый пользователь' }}
          </div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-form @submit.prevent="saveUser">
          <q-card-section class="q-gutter-sm">
            <q-input
              v-model="form.last_name"
              label="Фамилия *"
              outlined
              dense
              :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
            />
            <q-input
              v-model="form.first_name"
              label="Имя *"
              outlined
              dense
              :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
            />
            <q-input
              v-model="form.middle_name"
              label="Отчество"
              outlined
              dense
            />
            <q-input
              v-model="form.login"
              label="Логин *"
              outlined
              dense
              :rules="[
                (val) => (val && val.trim().length >= 3) || 'Минимум 3 символа',
                (val) =>
                  /^[a-zA-Z0-9._-]+$/.test(val.trim()) ||
                  'Только латиница, цифры, точка, дефис или _',
              ]"
            />
            <q-select
              v-model="form.role"
              :options="roleOptions"
              option-value="value"
              option-label="label"
              emit-value
              map-options
              outlined
              dense
              label="Роль *"
            />
            <q-input
              v-model="form.password"
              :label="editingId ? 'Новый пароль (оставьте пустым, если не меняете)' : 'Пароль *'"
              type="password"
              outlined
              dense
              :rules="
                editingId
                  ? [(val) => !val || val.length >= 8 || 'Минимум 8 символов']
                  : [(val) => (val && val.length >= 8) || 'Минимум 8 символов']
              "
            />
          </q-card-section>

          <q-separator />
          <q-card-actions align="right" class="q-pa-md">
            <q-btn v-close-popup flat label="Отмена" color="grey-7" />
            <q-btn
              type="submit"
              color="primary"
              label="Сохранить"
              :loading="saving"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { useAuth } from '../composables/useAuth';
import { notifySuccess, notifyError } from '../utils/formatters';

const $q = useQuasar();
const { user: currentUser } = useAuth();

const users = ref([]);
const loading = ref(false);
const showDeleted = ref(false);

const dialogOpen = ref(false);
const editingId = ref(null);
const saving = ref(false);
const form = ref({
  last_name: '',
  first_name: '',
  middle_name: '',
  login: '',
  role: 'hr_manager',
  password: '',
});

const roleOptions = [
  { label: 'Менеджер по персоналу', value: 'hr_manager' },
  { label: 'Администратор', value: 'admin' },
];

const columns = [
  { name: 'full_name', label: 'ФИО', field: 'last_name', align: 'left', sortable: true },
  { name: 'login', label: 'Логин', field: 'login', align: 'left', sortable: true },
  { name: 'role', label: 'Роль', field: 'role', align: 'left' },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'left' },
  { name: 'actions', label: 'Действия', field: 'id', align: 'right' },
];

const filteredUsers = computed(() =>
  showDeleted.value ? users.value : users.value.filter((u) => !u.deleted_at),
);

function formatFullName(u) {
  return [u.last_name, u.first_name, u.middle_name].filter(Boolean).join(' ');
}

async function fetchUsers() {
  loading.value = true;
  try {
    const { data } = await api.get('/users');
    users.value = data;
  } catch (err) {
    notifyError($q, err, 'Не удалось загрузить список пользователей');
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  editingId.value = null;
  form.value = {
    last_name: '',
    first_name: '',
    middle_name: '',
    login: '',
    role: 'hr_manager',
    password: '',
  };
  dialogOpen.value = true;
}

function openEditDialog(u) {
  editingId.value = u.id;
  form.value = {
    last_name: u.last_name,
    first_name: u.first_name,
    middle_name: u.middle_name || '',
    login: u.login,
    role: u.role,
    password: '',
  };
  dialogOpen.value = true;
}

async function saveUser() {
  saving.value = true;
  try {
    const payload = {
      last_name: form.value.last_name.trim(),
      first_name: form.value.first_name.trim(),
      middle_name: form.value.middle_name?.trim() || null,
      login: form.value.login.trim(),
      role: form.value.role,
    };

    if (form.value.password) {
      payload.password = form.value.password;
    }

    if (editingId.value) {
      await api.put(`/users/${editingId.value}`, payload);
      notifySuccess($q, 'Данные пользователя обновлены');
    } else {
      await api.post('/users', payload);
      notifySuccess($q, 'Пользователь создан');
    }

    dialogOpen.value = false;
    await fetchUsers();
  } catch (err) {
    notifyError($q, err, 'Ошибка при сохранении пользователя');
  } finally {
    saving.value = false;
  }
}

function confirmDelete(u) {
  $q.dialog({
    title: 'Удаление пользователя',
    message: `Удалить учетную запись «${formatFullName(u)}» (@${u.login})?`,
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Удалить', color: 'negative' },
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/users/${u.id}`);
      notifySuccess($q, 'Пользователь удален');
      await fetchUsers();
    } catch (err) {
      notifyError($q, err, 'Не удалось удалить пользователя');
    }
  });
}

onMounted(fetchUsers);
</script>
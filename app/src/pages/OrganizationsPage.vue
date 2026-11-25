<template>
  <q-page class="q-pa-md bg-grey-1">
    <q-card flat bordered class="q-pa-md">
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h6">Организации</div>
        <div class="row items-center q-gutter-md">
          <q-toggle
            v-model="showDeleted"
            label="Показывать удаленные"
            color="negative"
            dense
          />
          <q-btn
            color="primary"
            icon="add"
            label="Добавить организацию"
            @click="openCreateDialog"
          />
        </div>
      </div>

      <q-table
        :rows="filteredOrganizations"
        :columns="columns"
        row-key="id"
        :loading="loading"
        flat
        bordered
        :pagination="{ rowsPerPage: 10 }"
        no-data-label="Организации не найдены"
      >
        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge
              :color="props.row.deleted_at ? 'negative' : 'positive'"
              :label="props.row.deleted_at ? 'Удалена' : 'Активна'"
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
              @click="confirmDelete(props.row)"
            >
              <q-tooltip>Удалить</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-card>

    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="width: 460px; max-width: 95vw">
        <q-card-section class="row items-center bg-primary text-white">
          <div class="text-h6">
            {{ editingId ? 'Редактировать организацию' : 'Новая организация' }}
          </div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-form @submit.prevent="saveOrganization">
          <q-card-section class="q-gutter-sm">
            <q-input
              v-model="form.name"
              label="Наименование *"
              outlined
              dense
              :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
            />
            <q-input
              v-model="form.comment"
              label="Комментарий"
              type="textarea"
              rows="3"
              outlined
              dense
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
import { notifySuccess, notifyError } from '../utils/formatters';

const $q = useQuasar();

const organizations = ref([]);
const loading = ref(false);
const showDeleted = ref(false);

const dialogOpen = ref(false);
const editingId = ref(null);
const saving = ref(false);
const form = ref({ name: '', comment: '' });

const columns = [
  { name: 'name', label: 'Наименование', field: 'name', align: 'left', sortable: true },
  { name: 'comment', label: 'Комментарий', field: (row) => row.comment || '—', align: 'left' },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'left' },
  { name: 'actions', label: 'Действия', field: 'id', align: 'right' },
];

const filteredOrganizations = computed(() =>
  showDeleted.value
    ? organizations.value
    : organizations.value.filter((o) => !o.deleted_at),
);

async function fetchOrganizations() {
  loading.value = true;
  try {
    const { data } = await api.get('/organizations');
    organizations.value = data;
  } catch (err) {
    notifyError($q, err, 'Не удалось загрузить организации');
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  editingId.value = null;
  form.value = { name: '', comment: '' };
  dialogOpen.value = true;
}

function openEditDialog(org) {
  editingId.value = org.id;
  form.value = { name: org.name, comment: org.comment || '' };
  dialogOpen.value = true;
}

async function saveOrganization() {
  saving.value = true;
  try {
    const payload = {
      name: form.value.name.trim(),
      comment: form.value.comment?.trim() || null,
    };
    if (editingId.value) {
      await api.put(`/organizations/${editingId.value}`, payload);
      notifySuccess($q, 'Организация обновлена');
    } else {
      await api.post('/organizations', payload);
      notifySuccess($q, 'Организация создана');
    }
    dialogOpen.value = false;
    await fetchOrganizations();
  } catch (err) {
    notifyError($q, err, 'Ошибка при сохранении организации');
  } finally {
    saving.value = false;
  }
}

function confirmDelete(org) {
  $q.dialog({
    title: 'Удаление организации',
    message: `Удалить организацию «${org.name}»?`,
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Удалить', color: 'negative' },
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/organizations/${org.id}`);
      notifySuccess($q, 'Организация удалена');
      await fetchOrganizations();
    } catch (err) {
      notifyError($q, err, 'Не удалось удалить организацию');
    }
  });
}

onMounted(fetchOrganizations);
</script>
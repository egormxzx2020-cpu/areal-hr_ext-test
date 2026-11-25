<template>
  <q-page class="q-pa-md bg-grey-1">
    <q-card flat bordered class="q-pa-md">
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h6">Должности</div>
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
            label="Добавить должность"
            @click="openCreateDialog"
          />
        </div>
      </div>

      <q-table
        :rows="filteredPositions"
        :columns="columns"
        row-key="id"
        :loading="loading"
        flat
        bordered
        :pagination="{ rowsPerPage: 10 }"
        no-data-label="Должности не найдены"
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
      <q-card style="width: 440px; max-width: 95vw">
        <q-card-section class="row items-center bg-primary text-white">
          <div class="text-h6">
            {{ editingId ? 'Редактировать должность' : 'Новая должность' }}
          </div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-form @submit.prevent="savePosition">
          <q-card-section>
            <q-input
              v-model="form.name"
              label="Наименование должности *"
              outlined
              dense
              :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
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

const positions = ref([]);
const loading = ref(false);
const showDeleted = ref(false);

const dialogOpen = ref(false);
const editingId = ref(null);
const saving = ref(false);
const form = ref({ name: '' });

const columns = [
  { name: 'name', label: 'Должность', field: 'name', align: 'left', sortable: true },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'left' },
  { name: 'actions', label: 'Действия', field: 'id', align: 'right' },
];

const filteredPositions = computed(() =>
  showDeleted.value
    ? positions.value
    : positions.value.filter((p) => !p.deleted_at),
);

async function fetchPositions() {
  loading.value = true;
  try {
    const { data } = await api.get('/positions');
    positions.value = data;
  } catch (err) {
    notifyError($q, err, 'Не удалось загрузить должности');
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  editingId.value = null;
  form.value = { name: '' };
  dialogOpen.value = true;
}

function openEditDialog(pos) {
  editingId.value = pos.id;
  form.value = { name: pos.name };
  dialogOpen.value = true;
}

async function savePosition() {
  saving.value = true;
  try {
    const payload = { name: form.value.name.trim() };
    if (editingId.value) {
      await api.put(`/positions/${editingId.value}`, payload);
      notifySuccess($q, 'Должность обновлена');
    } else {
      await api.post('/positions', payload);
      notifySuccess($q, 'Должность создана');
    }
    dialogOpen.value = false;
    await fetchPositions();
  } catch (err) {
    notifyError($q, err, 'Ошибка при сохранении должности');
  } finally {
    saving.value = false;
  }
}

function confirmDelete(pos) {
  $q.dialog({
    title: 'Удаление должности',
    message: `Удалить должность «${pos.name}»?`,
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Удалить', color: 'negative' },
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/positions/${pos.id}`);
      notifySuccess($q, 'Должность удалена');
      await fetchPositions();
    } catch (err) {
      notifyError($q, err, 'Не удалось удалить должность');
    }
  });
}

onMounted(fetchPositions);
</script>
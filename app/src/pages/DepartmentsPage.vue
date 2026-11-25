<template>
  <q-page class="q-pa-md bg-grey-1">
    <q-card flat bordered class="q-pa-md">
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h6">Отделы</div>
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
            label="Добавить отдел"
            @click="openCreateDialog"
          />
        </div>
      </div>

      <q-table
        :rows="filteredDepartments"
        :columns="columns"
        row-key="id"
        :loading="loading"
        flat
        bordered
        :pagination="{ rowsPerPage: 10 }"
        no-data-label="Отделы не найдены"
      >
        <template #body-cell-parent_name="props">
          <q-td :props="props">
            {{ props.row.parent_name || '— (Корневой отдел)' }}
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
              @click="confirmDelete(props.row)"
            >
              <q-tooltip>Удалить</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-card>

    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="width: 500px; max-width: 95vw">
        <q-card-section class="row items-center bg-primary text-white">
          <div class="text-h6">
            {{ editingId ? 'Редактировать отдел' : 'Новый отдел' }}
          </div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-form @submit.prevent="saveDepartment">
          <q-card-section class="q-gutter-sm">
            <q-select
              v-model="form.organization_id"
              :options="activeOrganizations"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              outlined
              dense
              label="Организация *"
              :rules="[(val) => !!val || 'Выберите организацию']"
              @update:model-value="form.parent_id = null"
            />
            <q-select
              v-model="form.parent_id"
              :options="availableParentDepartments"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              outlined
              dense
              clearable
              label="Родительский отдел (необязательно)"
              :disable="!form.organization_id"
            />
            <q-input
              v-model="form.name"
              label="Наименование отдела *"
              outlined
              dense
              :rules="[(val) => !!val?.trim() || 'Обязательное поле']"
            />
            <q-input
              v-model="form.comment"
              label="Комментарий"
              type="textarea"
              rows="2"
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

const departments = ref([]);
const organizations = ref([]);
const loading = ref(false);
const showDeleted = ref(false);

const dialogOpen = ref(false);
const editingId = ref(null);
const saving = ref(false);
const form = ref({
  organization_id: null,
  parent_id: null,
  name: '',
  comment: '',
});

const columns = [
  { name: 'name', label: 'Отдел', field: 'name', align: 'left', sortable: true },
  { name: 'organization_name', label: 'Организация', field: 'organization_name', align: 'left', sortable: true },
  { name: 'parent_name', label: 'Родительский отдел', field: 'parent_name', align: 'left' },
  { name: 'comment', label: 'Комментарий', field: (row) => row.comment || '—', align: 'left' },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'left' },
  { name: 'actions', label: 'Действия', field: 'id', align: 'right' },
];

const filteredDepartments = computed(() =>
  showDeleted.value
    ? departments.value
    : departments.value.filter((d) => !d.deleted_at),
);

const activeOrganizations = computed(() =>
  organizations.value.filter((o) => !o.deleted_at),
);

// Исключаем сам отдел и всех его потомков при выборе родителя (защита от циклов A -> B -> A)
const availableParentDepartments = computed(() => {
  if (!form.value.organization_id) return [];

  const orgDepts = departments.value.filter(
    (d) => !d.deleted_at && d.organization_id === form.value.organization_id,
  );

  if (!editingId.value) return orgDepts;

  const excludedIds = new Set([editingId.value]);
  let added = true;
  while (added) {
    added = false;
    for (const dept of orgDepts) {
      if (dept.parent_id && excludedIds.has(dept.parent_id) && !excludedIds.has(dept.id)) {
        excludedIds.add(dept.id);
        added = true;
      }
    }
  }

  return orgDepts.filter((d) => !excludedIds.has(d.id));
});

async function fetchData() {
  loading.value = true;
  try {
    const [deptsRes, orgsRes] = await Promise.all([
      api.get('/departments'),
      api.get('/organizations'),
    ]);
    departments.value = deptsRes.data;
    organizations.value = orgsRes.data;
  } catch (err) {
    notifyError($q, err, 'Не удалось загрузить отделы');
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  editingId.value = null;
  form.value = {
    organization_id: activeOrganizations.value[0]?.id || null,
    parent_id: null,
    name: '',
    comment: '',
  };
  dialogOpen.value = true;
}

function openEditDialog(dept) {
  editingId.value = dept.id;
  form.value = {
    organization_id: dept.organization_id,
    parent_id: dept.parent_id || null,
    name: dept.name,
    comment: dept.comment || '',
  };
  dialogOpen.value = true;
}

async function saveDepartment() {
  saving.value = true;
  try {
    const payload = {
      organization_id: form.value.organization_id,
      parent_id: form.value.parent_id || null,
      name: form.value.name.trim(),
      comment: form.value.comment?.trim() || null,
    };
    if (editingId.value) {
      await api.put(`/departments/${editingId.value}`, payload);
      notifySuccess($q, 'Отдел обновлен');
    } else {
      await api.post('/departments', payload);
      notifySuccess($q, 'Отдел создан');
    }
    dialogOpen.value = false;
    await fetchData();
  } catch (err) {
    notifyError($q, err, 'Ошибка при сохранении отдела');
  } finally {
    saving.value = false;
  }
}

function confirmDelete(dept) {
  $q.dialog({
    title: 'Удаление отдела',
    message: `Удалить отдел «${dept.name}»?`,
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Удалить', color: 'negative' },
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/departments/${dept.id}`);
      notifySuccess($q, 'Отдел удален');
      await fetchData();
    } catch (err) {
      notifyError($q, err, 'Не удалось удалить отдел');
    }
  });
}

onMounted(fetchData);
</script>
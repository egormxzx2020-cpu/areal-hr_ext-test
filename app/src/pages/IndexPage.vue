<template>
  <q-page class="q-pa-lg bg-grey-1">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <div class="text-h5 text-weight-bold">Справочники структуры компании</div>
        <div class="text-subtitle2 text-grey-7">Управление организациями, подразделениями и должностями</div>
      </div>
    </div>

    <q-card flat bordered class="shadow-1">
      <q-tabs
        v-model="activeTab"
        dense
        class="text-grey-7 bg-white"
        active-color="primary"
        indicator-color="primary"
        align="left"
        narrow-indicator
      >
        <q-tab name="organizations" icon="domain" label="Организации" />
        <q-tab name="departments" icon="account_tree" label="Отделы" />
        <q-tab name="positions" icon="work_outline" label="Должности" />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated class="bg-white q-pa-none">
        
        <!-- ================= ВКЛАДКА: ОРГАНИЗАЦИИ ================= -->
        <q-tab-panel name="organizations" class="q-pa-md">
          <div class="row justify-between items-center q-mb-md">
            <div class="text-subtitle1 text-weight-medium">Список организаций</div>
            <q-btn color="primary" icon="add" label="Добавить организацию" @click="openOrgDialog()" />
          </div>

          <q-table
            flat
            bordered
            :rows="organizations"
            :columns="orgColumns"
            row-key="id"
            :loading="loadingOrgs"
            no-data-label="Организации не найдены"
          >
            <template v-slot:body-cell-actions="props">
              <q-td :props="props" align="right">
                <q-btn flat round dense color="primary" icon="edit" @click="openOrgDialog(props.row)" />
                <q-btn flat round dense color="negative" icon="delete" @click="confirmDelete('org', props.row)" />
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- ================= ВКЛАДКА: ОТДЕЛЫ ================= -->
        <q-tab-panel name="departments" class="q-pa-md">
          <div class="row justify-between items-center q-mb-md">
            <div class="row q-gutter-md items-center">
              <div class="text-subtitle1 text-weight-medium">Подразделения</div>
              <q-select
                v-model="selectedOrgFilter"
                :options="orgFilterOptions"
                dense
                outlined
                emit-value
                map-options
                style="min-width: 240px"
                label="Фильтр по компании"
                @update:model-value="fetchDepartments"
              />
            </div>
            <q-btn color="primary" icon="add" label="Добавить отдел" @click="openDeptDialog()" />
          </div>

          <q-table
            flat
            bordered
            :rows="departments"
            :columns="deptColumns"
            row-key="id"
            :loading="loadingDepts"
            no-data-label="Отделы не найдены"
          >
            <template v-slot:body-cell-actions="props">
              <q-td :props="props" align="right">
                <q-btn flat round dense color="primary" icon="edit" @click="openDeptDialog(props.row)" />
                <q-btn flat round dense color="negative" icon="delete" @click="confirmDelete('dept', props.row)" />
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- ================= ВКЛАДКА: ДОЛЖНОСТИ ================= -->
        <q-tab-panel name="positions" class="q-pa-md">
          <div class="row justify-between items-center q-mb-md">
            <div class="text-subtitle1 text-weight-medium">Список должностей</div>
            <q-btn color="primary" icon="add" label="Добавить должность" @click="openPosDialog()" />
          </div>

          <q-table
            flat
            bordered
            :rows="positions"
            :columns="posColumns"
            row-key="id"
            :loading="loadingPositions"
            no-data-label="Должности не найдены"
          >
            <template v-slot:body-cell-actions="props">
              <q-td :props="props" align="right">
                <q-btn flat round dense color="primary" icon="edit" @click="openPosDialog(props.row)" />
                <q-btn flat round dense color="negative" icon="delete" @click="confirmDelete('pos', props.row)" />
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

      </q-tab-panels>
    </q-card>

    <!-- ДИАЛОГ: ОРГАНИЗАЦИЯ -->
    <q-dialog v-model="orgDialog.show" persistent>
      <q-card style="min-width: 420px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ orgDialog.isEdit ? 'Редактировать организацию' : 'Новая организация' }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-form @submit.prevent="saveOrganization">
          <q-card-section class="q-gutter-y-md">
            <q-input
              v-model="orgForm.name"
              label="Наименование компании *"
              outlined
              dense
              :rules="[val => !!val && val.trim().length >= 2 || 'Минимум 2 символа']"
            />
            <q-input
              v-model="orgForm.comment"
              label="Комментарий"
              type="textarea"
              outlined
              dense
              rows="3"
            />
          </q-card-section>
          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat label="Отмена" color="grey" v-close-popup />
            <q-btn label="Сохранить" color="primary" type="submit" :loading="saving" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <!-- ДИАЛОГ: ОТДЕЛ -->
    <q-dialog v-model="deptDialog.show" persistent>
      <q-card style="min-width: 460px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ deptDialog.isEdit ? 'Редактировать отдел' : 'Новый отдел' }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-form @submit.prevent="saveDepartment">
          <q-card-section class="q-gutter-y-md">
            <q-select
              v-model="deptForm.organization_id"
              :options="orgSelectOptions"
              label="Организация *"
              outlined
              dense
              emit-value
              map-options
              :rules="[val => !!val || 'Выберите организацию']"
              @update:model-value="deptForm.parent_id = null"
            />
            <q-select
              v-model="deptForm.parent_id"
              :options="availableParentDeptOptions"
              label="Родительский отдел (при наличии)"
              outlined
              dense
              emit-value
              map-options
              clearable
            />
            <q-input
              v-model="deptForm.name"
              label="Наименование отдела *"
              outlined
              dense
              :rules="[val => !!val && val.trim().length >= 2 || 'Минимум 2 символа']"
            />
            <q-input
              v-model="deptForm.comment"
              label="Комментарий"
              type="textarea"
              outlined
              dense
              rows="3"
            />
          </q-card-section>
          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat label="Отмена" color="grey" v-close-popup />
            <q-btn label="Сохранить" color="primary" type="submit" :loading="saving" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <!-- ДИАЛОГ: ДОЛЖНОСТЬ -->
    <q-dialog v-model="posDialog.show" persistent>
      <q-card style="min-width: 400px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ posDialog.isEdit ? 'Редактировать должность' : 'Новая должность' }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-form @submit.prevent="savePosition">
          <q-card-section class="q-gutter-y-md">
            <q-input
              v-model="posForm.name"
              label="Наименование должности *"
              outlined
              dense
              :rules="[val => !!val && val.trim().length >= 2 || 'Минимум 2 символа']"
            />
          </q-card-section>
          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat label="Отмена" color="grey" v-close-popup />
            <q-btn label="Сохранить" color="primary" type="submit" :loading="saving" />
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

const $q = useQuasar();
const activeTab = ref('organizations');
const saving = ref(false);

// =================== ОРГАНИЗАЦИИ ===================
const organizations = ref([]);
const loadingOrgs = ref(false);
const orgDialog = ref({ show: false, isEdit: false, id: null });
const orgForm = ref({ name: '', comment: '' });

const orgColumns = [
  { name: 'name', label: 'Наименование', field: 'name', align: 'left', sortable: true },
  { name: 'comment', label: 'Комментарий', field: 'comment', align: 'left' },
  { 
    name: 'created_at', 
    label: 'Дата создания', 
    field: row => new Date(row.created_at).toLocaleString('ru-RU'), 
    align: 'left', 
    sortable: true 
  },
  { name: 'actions', label: 'Действия', align: 'right' }
];

const orgSelectOptions = computed(() => {
  return organizations.value.map(o => ({ label: o.name, value: o.id }));
});

const orgFilterOptions = computed(() => {
  return [{ label: 'Все компании', value: null }, ...orgSelectOptions.value];
});

async function fetchOrganizations() {
  loadingOrgs.value = true;
  try {
    const res = await api.get('/organizations');
    organizations.value = res.data;
  } catch (err) {
    showError('Не удалось загрузить организации');
  } finally {
    loadingOrgs.value = false;
  }
}

function openOrgDialog(row = null) {
  if (row) {
    orgDialog.value = { show: true, isEdit: true, id: row.id };
    orgForm.value = { name: row.name, comment: row.comment || '' };
  } else {
    orgDialog.value = { show: true, isEdit: false, id: null };
    orgForm.value = { name: '', comment: '' };
  }
}

async function saveOrganization() {
  saving.value = true;
  try {
    if (orgDialog.value.isEdit) {
      await api.put(`/organizations/${orgDialog.value.id}`, orgForm.value);
      showSuccess('Организация обновлена');
    } else {
      await api.post('/organizations', orgForm.value);
      showSuccess('Организация добавлена');
    }
    orgDialog.value.show = false;
    await fetchOrganizations();
    await fetchDepartments();
  } catch (err) {
    showError(err.response?.data?.message || 'Ошибка при сохранении организации');
  } finally {
    saving.value = false;
  }
}

// =================== ОТДЕЛЫ ===================
const departments = ref([]);
const loadingDepts = ref(false);
const selectedOrgFilter = ref(null);
const deptDialog = ref({ show: false, isEdit: false, id: null });
const deptForm = ref({ organization_id: null, parent_id: null, name: '', comment: '' });

const deptColumns = [
  { name: 'name', label: 'Наименование', field: 'name', align: 'left', sortable: true },
  { name: 'organization_name', label: 'Компания', field: 'organization_name', align: 'left', sortable: true },
  { name: 'parent_name', label: 'Вышестоящий отдел', field: row => row.parent_name || '—', align: 'left' },
  { name: 'comment', label: 'Комментарий', field: 'comment', align: 'left' },
  { name: 'actions', label: 'Действия', align: 'right' }
];

// Рекурсивный поиск всех ID потомков выбранного отдела
function getAllDescendantIds(deptId, allDepts) {
  const result = new Set();
  const findChildren = (parentId) => {
    for (const d of allDepts) {
      if (d.parent_id === parentId) {
        result.add(d.id);
        findChildren(d.id);
      }
    }
  };
  findChildren(deptId);
  return result;
}

// Исключение текущего отдела и всех его потомков из селектора выбора родителя
const availableParentDeptOptions = computed(() => {
  if (!deptForm.value.organization_id) return [];

  const orgDepts = departments.value.filter(
    d => d.organization_id === deptForm.value.organization_id
  );

  if (!deptDialog.value.isEdit || !deptDialog.value.id) {
    return orgDepts.map(d => ({ label: d.name, value: d.id }));
  }

  const descendantIds = getAllDescendantIds(deptDialog.value.id, orgDepts);
  descendantIds.add(deptDialog.value.id);

  return orgDepts
    .filter(d => !descendantIds.has(d.id))
    .map(d => ({ label: d.name, value: d.id }));
});

async function fetchDepartments() {
  loadingDepts.value = true;
  try {
    const params = selectedOrgFilter.value ? { organization_id: selectedOrgFilter.value } : {};
    const res = await api.get('/departments', { params });
    departments.value = res.data;
  } catch (err) {
    showError('Не удалось загрузить отделы');
  } finally {
    loadingDepts.value = false;
  }
}

function openDeptDialog(row = null) {
  if (row) {
    deptDialog.value = { show: true, isEdit: true, id: row.id };
    deptForm.value = {
      organization_id: row.organization_id,
      parent_id: row.parent_id || null,
      name: row.name,
      comment: row.comment || ''
    };
  } else {
    deptDialog.value = { show: true, isEdit: false, id: null };
    deptForm.value = {
      organization_id: selectedOrgFilter.value || (organizations.value[0]?.id || null),
      parent_id: null,
      name: '',
      comment: ''
    };
  }
}

async function saveDepartment() {
  saving.value = true;
  try {
    const payload = {
      organization_id: deptForm.value.organization_id,
      parent_id: deptForm.value.parent_id || null,
      name: deptForm.value.name,
      comment: deptForm.value.comment || null
    };

    if (deptDialog.value.isEdit) {
      await api.put(`/departments/${deptDialog.value.id}`, payload);
      showSuccess('Отдел обновлен');
    } else {
      await api.post('/departments', payload);
      showSuccess('Отдел добавлен');
    }
    deptDialog.value.show = false;
    await fetchDepartments();
  } catch (err) {
    showError(err.response?.data?.message || 'Ошибка при сохранении отдела');
  } finally {
    saving.value = false;
  }
}

// =================== ДОЛЖНОСТИ ===================
const positions = ref([]);
const loadingPositions = ref(false);
const posDialog = ref({ show: false, isEdit: false, id: null });
const posForm = ref({ name: '' });

const posColumns = [
  { name: 'name', label: 'Наименование должности', field: 'name', align: 'left', sortable: true },
  { 
    name: 'created_at', 
    label: 'Дата создания', 
    field: row => new Date(row.created_at).toLocaleString('ru-RU'), 
    align: 'left', 
    sortable: true 
  },
  { name: 'actions', label: 'Действия', align: 'right' }
];

async function fetchPositions() {
  loadingPositions.value = true;
  try {
    const res = await api.get('/positions');
    positions.value = res.data;
  } catch (err) {
    showError('Не удалось загрузить должности');
  } finally {
    loadingPositions.value = false;
  }
}

function openPosDialog(row = null) {
  if (row) {
    posDialog.value = { show: true, isEdit: true, id: row.id };
    posForm.value = { name: row.name };
  } else {
    posDialog.value = { show: true, isEdit: false, id: null };
    posForm.value = { name: '' };
  }
}

async function savePosition() {
  saving.value = true;
  try {
    if (posDialog.value.isEdit) {
      await api.put(`/positions/${posDialog.value.id}`, posForm.value);
      showSuccess('Должность обновлена');
    } else {
      await api.post('/positions', posForm.value);
      showSuccess('Должность добавлена');
    }
    posDialog.value.show = false;
    await fetchPositions();
  } catch (err) {
    showError(err.response?.data?.message || 'Ошибка при сохранении должности');
  } finally {
    saving.value = false;
  }
}

// =================== УДАЛЕНИЕ (SOFT DELETE) ===================
function confirmDelete(type, row) {
  const titles = { org: 'организацию', dept: 'отдел', pos: 'должность' };
  $q.dialog({
    title: 'Подтверждение удаления',
    message: `Вы уверены, что хотите удалить ${titles[type]} «${row.name}»? Запись будет помечена как удаленная.`,
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Удалить', color: 'negative' },
    persistent: true
  }).onOk(async () => {
    try {
      if (type === 'org') {
        await api.delete(`/organizations/${row.id}`);
        await fetchOrganizations();
        await fetchDepartments();
      } else if (type === 'dept') {
        await api.delete(`/departments/${row.id}`);
        await fetchDepartments();
      } else if (type === 'pos') {
        await api.delete(`/positions/${row.id}`);
        await fetchPositions();
      }
      showSuccess('Запись успешно помечена как удаленная');
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        'Не удалось удалить запись: возможно, у неё есть связанные активные данные';
      showError(errorMsg);
    }
  });
}

function showSuccess(message) {
  $q.notify({ type: 'positive', message, position: 'top-right', timeout: 2500 });
}

function showError(message) {
  $q.notify({ type: 'negative', message, position: 'top-right', timeout: 3500 });
}

onMounted(() => {
  fetchOrganizations();
  fetchDepartments();
  fetchPositions();
});
</script>
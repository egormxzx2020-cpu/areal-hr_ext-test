<template>
  <q-page class="q-pa-lg bg-grey-1">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <div class="text-h5 text-weight-bold">Кадровый учет и структура компании</div>
        <div class="text-subtitle2 text-grey-7">Управление реестром сотрудников, организациями, отделами и должностями</div>
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
        <q-tab name="employees" icon="badge" label="Сотрудники" />
        <q-tab name="organizations" icon="domain" label="Организации" />
        <q-tab name="departments" icon="account_tree" label="Отделы" />
        <q-tab name="positions" icon="work_outline" label="Должности" />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated class="bg-white q-pa-none">
        
        <!-- ================= ВКЛАДКА 1: СОТРУДНИКИ ================= -->
        <q-tab-panel name="employees" class="q-pa-md">
          <div class="row justify-between items-center q-mb-md q-col-gutter-sm">
            <div class="row items-center q-gutter-x-md">
              <div class="text-subtitle1 text-weight-medium">Реестр сотрудников</div>
              <q-input
                v-model="employeeSearch"
                dense
                outlined
                placeholder="Поиск по ФИО или номеру паспорта..."
                clearable
                style="min-width: 320px"
                @update:model-value="onSearchInput"
              >
                <template v-slot:append>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
            <q-btn color="primary" icon="person_add" label="Добавить сотрудника" @click="openCreateEmployeeNotice" />
          </div>

          <q-table
            flat
            bordered
            :rows="employees"
            :columns="empColumns"
            row-key="id"
            :loading="loadingEmployees"
            no-data-label="Сотрудники не найдены"
          >
            <!-- Отображение ФИО -->
            <template v-slot:body-cell-fio="props">
              <q-td :props="props">
                <span :class="props.row.deleted_at ? 'text-strike text-grey-6' : 'text-weight-medium'">
                  {{ props.row.last_name }} {{ props.row.first_name }} {{ props.row.middle_name || '' }}
                </span>
              </q-td>
            </template>

            <!-- Отображение количества сканов -->
            <template v-slot:body-cell-files_count="props">
              <q-td :props="props" align="center">
                <q-chip
                  dense
                  :color="props.row.files_count > 0 ? 'primary' : 'grey-4'"
                  :text-color="props.row.files_count > 0 ? 'white' : 'grey-8'"
                  icon="attach_file"
                  clickable
                  @click="openViewEmployee(props.row)"
                >
                  {{ props.row.files_count > 0 ? `${props.row.files_count} файл(ов)` : 'Нет сканов' }}
                </q-chip>
              </q-td>
            </template>

            <!-- Отображение статуса -->
            <template v-slot:body-cell-status="props">
              <q-td :props="props" align="center">
                <q-badge v-if="props.row.deleted_at" color="negative" label="Удален" />
                <q-badge v-else color="positive" label="Активен" />
              </q-td>
            </template>

            <!-- Действия -->
            <template v-slot:body-cell-actions="props">
              <q-td :props="props" align="right">
                <q-btn
                  flat
                  round
                  dense
                  color="info"
                  icon="visibility"
                  @click="openViewEmployee(props.row)"
                >
                  <q-tooltip>Просмотр анкеты и документов</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  round
                  dense
                  color="primary"
                  icon="edit"
                  :disable="!!props.row.deleted_at"
                  @click="openCreateEmployeeNotice"
                >
                  <q-tooltip v-if="props.row.deleted_at">Нельзя редактировать удаленного сотрудника</q-tooltip>
                  <q-tooltip v-else>Редактировать анкету</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  round
                  dense
                  color="negative"
                  icon="delete"
                  :disable="!!props.row.deleted_at"
                  @click="confirmDelete('emp', props.row)"
                >
                  <q-tooltip v-if="props.row.deleted_at">Сотрудник уже удален</q-tooltip>
                  <q-tooltip v-else>Мягкое удаление сотрудника</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- ================= ВКЛАДКА 2: ОРГАНИЗАЦИИ ================= -->
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
            <template v-slot:body-cell-name="props">
              <q-td :props="props">
                <span :class="props.row.deleted_at ? 'text-strike text-grey-6' : 'text-weight-medium'">
                  {{ props.row.name }}
                </span>
              </q-td>
            </template>

            <template v-slot:body-cell-status="props">
              <q-td :props="props" align="center">
                <q-badge v-if="props.row.deleted_at" color="negative" label="Удалена" />
                <q-badge v-else color="positive" label="Активна" />
              </q-td>
            </template>

            <template v-slot:body-cell-actions="props">
              <q-td :props="props" align="right">
                <q-btn
                  flat
                  round
                  dense
                  color="primary"
                  icon="edit"
                  :disable="!!props.row.deleted_at"
                  @click="openOrgDialog(props.row)"
                />
                <q-btn
                  flat
                  round
                  dense
                  color="negative"
                  icon="delete"
                  :disable="!!props.row.deleted_at"
                  @click="confirmDelete('org', props.row)"
                />
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- ================= ВКЛАДКА 3: ОТДЕЛЫ ================= -->
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
                style="min-width: 250px"
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
            <template v-slot:body-cell-name="props">
              <q-td :props="props">
                <span :class="props.row.deleted_at ? 'text-strike text-grey-6' : 'text-weight-medium'">
                  {{ props.row.name }}
                </span>
              </q-td>
            </template>

            <template v-slot:body-cell-status="props">
              <q-td :props="props" align="center">
                <q-badge v-if="props.row.deleted_at" color="negative" label="Удален" />
                <q-badge v-else color="positive" label="Активен" />
              </q-td>
            </template>

            <template v-slot:body-cell-actions="props">
              <q-td :props="props" align="right">
                <q-btn
                  flat
                  round
                  dense
                  color="primary"
                  icon="edit"
                  :disable="!!props.row.deleted_at"
                  @click="openDeptDialog(props.row)"
                />
                <q-btn
                  flat
                  round
                  dense
                  color="negative"
                  icon="delete"
                  :disable="!!props.row.deleted_at"
                  @click="confirmDelete('dept', props.row)"
                />
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- ================= ВКЛАДКА 4: ДОЛЖНОСТИ ================= -->
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
            <template v-slot:body-cell-name="props">
              <q-td :props="props">
                <span :class="props.row.deleted_at ? 'text-strike text-grey-6' : 'text-weight-medium'">
                  {{ props.row.name }}
                </span>
              </q-td>
            </template>

            <template v-slot:body-cell-status="props">
              <q-td :props="props" align="center">
                <q-badge v-if="props.row.deleted_at" color="negative" label="Удалена" />
                <q-badge v-else color="positive" label="Активна" />
              </q-td>
            </template>

            <template v-slot:body-cell-actions="props">
              <q-td :props="props" align="right">
                <q-btn
                  flat
                  round
                  dense
                  color="primary"
                  icon="edit"
                  :disable="!!props.row.deleted_at"
                  @click="openPosDialog(props.row)"
                />
                <q-btn
                  flat
                  round
                  dense
                  color="negative"
                  icon="delete"
                  :disable="!!props.row.deleted_at"
                  @click="confirmDelete('pos', props.row)"
                />
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

      </q-tab-panels>
    </q-card>

    <!-- МОДАЛЬНОЕ ОКНО: ПРОСМОТР АНКЕТЫ СОТРУДНИКА И СКАНОВ -->
    <q-dialog v-model="viewEmpDialog.show">
      <q-card style="min-width: 650px; max-width: 800px">
        <q-card-section class="row items-center bg-primary text-white q-py-sm">
          <div class="text-h6">Личное дело сотрудника</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section v-if="viewEmpDialog.loading" class="text-center q-pa-xl">
          <q-spinner color="primary" size="3em" />
          <div class="q-mt-md text-grey-7">Загрузка данных анкеты...</div>
        </q-card-section>

        <q-card-section v-else-if="viewEmpDialog.data" class="q-pa-md q-gutter-y-md">
          <!-- Личные данные -->
          <div>
            <div class="text-subtitle2 text-primary text-weight-bold">Личные данные</div>
            <div class="row q-col-gutter-sm q-mt-xs">
              <div class="col-12 col-sm-8"><strong>ФИО:</strong> {{ viewEmpDialog.data.last_name }} {{ viewEmpDialog.data.first_name }} {{ viewEmpDialog.data.middle_name || '' }}</div>
              <div class="col-12 col-sm-4"><strong>Дата рождения:</strong> {{ formatDate(viewEmpDialog.data.birth_date) }}</div>
            </div>
          </div>
          <q-separator />

          <!-- Паспортные данные -->
          <div>
            <div class="text-subtitle2 text-primary text-weight-bold">Паспортные данные РФ</div>
            <div class="row q-col-gutter-sm q-mt-xs">
              <div class="col-6 col-sm-3"><strong>Серия:</strong> {{ viewEmpDialog.data.passport_series }}</div>
              <div class="col-6 col-sm-3"><strong>Номер:</strong> {{ viewEmpDialog.data.passport_number }}</div>
              <div class="col-6 col-sm-3"><strong>Дата выдачи:</strong> {{ formatDate(viewEmpDialog.data.passport_issue_date) }}</div>
              <div class="col-6 col-sm-3"><strong>Код подр.:</strong> {{ viewEmpDialog.data.passport_department_code }}</div>
              <div class="col-12 q-mt-xs"><strong>Кем выдан:</strong> {{ viewEmpDialog.data.passport_issued_by }}</div>
            </div>
          </div>
          <q-separator />

          <!-- Адрес регистрации -->
          <div>
            <div class="text-subtitle2 text-primary text-weight-bold">Адрес постоянной регистрации</div>
            <div class="q-mt-xs">
              {{ formatAddress(viewEmpDialog.data) }} ({{ viewEmpDialog.data.reg_region }})
            </div>
          </div>
          <q-separator />

          <!-- Прикрепленные сканы -->
          <div>
            <div class="text-subtitle2 text-primary text-weight-bold q-mb-sm">
              Прикрепленные сканы паспорта ({{ viewEmpDialog.data.passport_files?.length || 0 }})
            </div>
            <div v-if="!viewEmpDialog.data.passport_files || viewEmpDialog.data.passport_files.length === 0" class="text-grey-7 italic">
              Сканы документов не были загружены
            </div>
            <q-list v-else bordered separator dense class="rounded-borders">
              <q-item v-for="file in viewEmpDialog.data.passport_files" :key="file.id">
                <q-item-section avatar>
                  <q-icon :name="file.mime_type.includes('pdf') ? 'picture_as_pdf' : 'image'" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ file.name }}</q-item-label>
                  <q-item-label caption>{{ (file.size / 1024).toFixed(1) }} КБ • {{ file.mime_type }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn
                    flat
                    dense
                    round
                    icon="open_in_new"
                    color="primary"
                    @click="openFileDownload(file.id)"
                  >
                    <q-tooltip>Открыть файл</q-tooltip>
                  </q-btn>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md bg-grey-1">
          <q-btn flat label="Закрыть" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

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
      <q-card style="min-width: 480px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ deptDialog.isEdit ? 'Редактировать отдел' : 'Новый отдел' }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-form @submit.prevent="saveDepartment">
          <q-card-section class="q-gutter-y-md">
            <q-select
              v-model="deptForm.organization_id"
              :options="activeOrgSelectOptions"
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
const activeTab = ref('employees');
const saving = ref(false);

// Вспомогательные функции форматирования
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('ru-RU');
}

function formatAddress(row) {
  if (!row) return '—';
  const parts = [
    row.reg_city || row.reg_region,
    row.reg_street ? `ул. ${row.reg_street}` : '',
    row.reg_house ? `д. ${row.reg_house}` : '',
    row.reg_building ? `корп. ${row.reg_building}` : '',
    row.reg_apartment ? `кв. ${row.reg_apartment}` : ''
  ];
  return parts.filter(Boolean).join(', ') || '—';
}

// =================== 1. СОТРУДНИКИ ===================
const employees = ref([]);
const loadingEmployees = ref(false);
const employeeSearch = ref('');
let searchTimer = null;

const viewEmpDialog = ref({
  show: false,
  loading: false,
  data: null
});

const empColumns = [
  { name: 'fio', label: 'ФИО сотрудника', field: row => `${row.last_name} ${row.first_name}`, align: 'left', sortable: true },
  { name: 'birth_date', label: 'Дата рождения', field: row => formatDate(row.birth_date), align: 'center', sortable: true },
  { name: 'passport', label: 'Паспорт РФ', field: row => `${row.passport_series} ${row.passport_number}`, align: 'center' },
  { name: 'address', label: 'Адрес регистрации', field: row => formatAddress(row), align: 'left' },
  { name: 'files_count', label: 'Сканы паспорта', field: 'files_count', align: 'center', sortable: true },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'center', sortable: true },
  { name: 'actions', label: 'Действия', align: 'right' }
];

async function fetchEmployees() {
  loadingEmployees.value = true;
  try {
    const params = {};
    if (employeeSearch.value && employeeSearch.value.trim()) {
      params.search = employeeSearch.value.trim();
    }
    const res = await api.get('/employees', { params });
    employees.value = res.data;
  } catch (err) {
    showError('Не удалось загрузить реестр сотрудников');
  } finally {
    loadingEmployees.value = false;
  }
}

function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    fetchEmployees();
  }, 350);
}

async function openViewEmployee(row) {
  viewEmpDialog.value = { show: true, loading: true, data: null };
  try {
    const res = await api.get(`/employees/${row.id}`);
    viewEmpDialog.value.data = res.data;
  } catch (err) {
    showError('Не удалось загрузить данные сотрудника');
    viewEmpDialog.value.show = false;
  } finally {
    viewEmpDialog.value.loading = false;
  }
}

function openFileDownload(fileId) {
  const baseURL = api.defaults.baseURL || 'http://localhost:3000';
  window.open(`${baseURL}/files/${fileId}/download`, '_blank');
}

function openCreateEmployeeNotice() {
  $q.notify({
    type: 'info',
    message: 'Полная форма ввода всех 15 полей с загрузчиком сканов подключается на Этапе 5',
    position: 'top-right',
    timeout: 3000
  });
}

// =================== 2. ОРГАНИЗАЦИИ ===================
const organizations = ref([]);
const loadingOrgs = ref(false);
const orgDialog = ref({ show: false, isEdit: false, id: null });
const orgForm = ref({ name: '', comment: '' });

const orgColumns = [
  { name: 'name', label: 'Наименование', field: 'name', align: 'left', sortable: true },
  { name: 'comment', label: 'Комментарий', field: 'comment', align: 'left' },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'center', sortable: true },
  { 
    name: 'created_at', 
    label: 'Дата создания', 
    field: row => row.created_at ? new Date(row.created_at).toLocaleString('ru-RU') : '—', 
    align: 'left', 
    sortable: true 
  },
  { name: 'actions', label: 'Действия', align: 'right' }
];

const activeOrgSelectOptions = computed(() => {
  return organizations.value
    .filter(o => !o.deleted_at)
    .map(o => ({ label: o.name, value: o.id }));
});

const orgFilterOptions = computed(() => {
  const options = organizations.value.map(o => ({
    label: o.name + (o.deleted_at ? ' (удалена)' : ''),
    value: o.id
  }));
  return [{ label: 'Все компании', value: null }, ...options];
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

// =================== 3. ОТДЕЛЫ ===================
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
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'center', sortable: true },
  { name: 'actions', label: 'Действия', align: 'right' }
];

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

const availableParentDeptOptions = computed(() => {
  if (!deptForm.value.organization_id) return [];

  const orgDepts = departments.value.filter(
    d => d.organization_id === deptForm.value.organization_id && !d.deleted_at
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
      organization_id: selectedOrgFilter.value || (activeOrgSelectOptions.value[0]?.value || null),
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

// =================== 4. ДОЛЖНОСТИ ===================
const positions = ref([]);
const loadingPositions = ref(false);
const posDialog = ref({ show: false, isEdit: false, id: null });
const posForm = ref({ name: '' });

const posColumns = [
  { name: 'name', label: 'Наименование должности', field: 'name', align: 'left', sortable: true },
  { name: 'status', label: 'Статус', field: 'deleted_at', align: 'center', sortable: true },
  { 
    name: 'created_at', 
    label: 'Дата создания', 
    field: row => row.created_at ? new Date(row.created_at).toLocaleString('ru-RU') : '—', 
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

// =================== 5. УДАЛЕНИЕ (SOFT DELETE) ===================
function confirmDelete(type, row) {
  const titles = { org: 'организацию', dept: 'отдел', pos: 'должность', emp: 'сотрудника' };
  const label = type === 'emp' ? `${row.last_name} ${row.first_name}` : row.name;

  $q.dialog({
    title: 'Подтверждение удаления',
    message: `Вы уверены, что хотите удалить ${titles[type]} «${label}»? Запись перейдет в статус удаленной.`,
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
      } else if (type === 'emp') {
        await api.delete(`/employees/${row.id}`);
        await fetchEmployees();
      }
      showSuccess('Запись успешно помечена как удаленная');
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        'Не удалось удалить запись: возможно, у неё есть связанные подразделения или операции';
      showError(errorMsg);
    }
  });
}

function showSuccess(message) {
  $q.notify({ type: 'positive', message, position: 'top-right', timeout: 2500 });
}

function showError(message) {
  $q.notify({ type: 'negative', message, position: 'top-right', timeout: 4000 });
}

onMounted(() => {
  fetchEmployees();
  fetchOrganizations();
  fetchDepartments();
  fetchPositions();
});
</script>